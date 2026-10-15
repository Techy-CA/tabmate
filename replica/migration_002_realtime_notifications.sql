-- Migration 002 — realtime, notifications, friend invites, security fixes.
--
-- Run AFTER schema.sql and migration_payment_handles.sql, in the Supabase
-- SQL Editor (Project -> SQL Editor -> New query -> paste -> Run). Safe to
-- re-run: every statement is idempotent.
--
-- What it does:
--   1. Adds every app table to the `supabase_realtime` publication. Without
--      this the app's realtime subscription connects but never receives a
--      single event — which is why changes only showed up after a restart.
--   2. Makes the activity-feed triggers SECURITY DEFINER. They insert into
--      activity_items, which has RLS on and no insert policy, so every
--      direct client write that fired them (soft-delete/restore an expense,
--      add a comment, remove a member, leave a group) was rejected.
--   3. Pins search_path on every SECURITY DEFINER function.
--   4. Closes authorization holes in the RPCs (update_expense had no check
--      at all; create_expense/create_payment didn't check group membership;
--      get_group_balances leaked any group's balances; group_members let any
--      user insert themselves into any group without an invite code).
--   5. create_group now adds the chosen members atomically.
--   6. Invite codes are a fixed 8 characters from an unambiguous alphabet,
--      with per-user rate limiting on preview/join.
--   7. Friend invites by email for people who aren't on Tabmate yet — they're
--      auto-friended the moment they sign up with that email.
--   8. A notifications table (in-app, realtime) + push delivery through the
--      Expo push service via pg_net, gated by per-user preferences.

create extension if not exists pg_net with schema extensions;

-- ============================================================
-- new columns / tables
-- ============================================================
alter table users add column if not exists notification_prefs jsonb not null
  default '{"push": true, "expense": true, "payment": true, "comment": true, "group": true, "friend": true}'::jsonb;

create table if not exists friend_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (inviter_id, email)
);
create index if not exists friend_invites_email_idx on friend_invites (email);
alter table friend_invites enable row level security;
drop policy if exists friend_invites_select on friend_invites;
create policy friend_invites_select on friend_invites for select using (inviter_id = auth.uid());

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
alter table notifications enable row level security;
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on notifications;
create policy notifications_delete on notifications for delete using (user_id = auth.uid());

create table if not exists push_tokens (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on push_tokens (user_id);
alter table push_tokens enable row level security;
drop policy if exists push_tokens_select on push_tokens;
create policy push_tokens_select on push_tokens for select using (user_id = auth.uid());

create table if not exists invite_attempts (
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists invite_attempts_idx on invite_attempts (user_id, created_at);
alter table invite_attempts enable row level security; -- no policies: only definer functions touch it

-- ============================================================
-- policy fixes
-- ============================================================
-- Was "is_group_member(group_id) or user_id = auth.uid()" — the second half
-- let anyone add themselves to any group by id, skipping the invite code.
-- Self-joins go through join_group (SECURITY DEFINER) instead.
drop policy if exists group_members_insert on group_members;
create policy group_members_insert on group_members for insert with check (is_group_member(group_id));

-- Expenses are only ever created through create_expense (which writes the
-- shares in the same transaction). A direct insert could create an expense
-- with no shares at all, which the balance trigger never sees.
drop policy if exists expenses_insert on expenses;

-- ============================================================
-- helpers
-- ============================================================
create or replace function fmt_money(p_cents bigint, p_code text) returns text
language sql immutable set search_path = public as $$
  select case upper(coalesce(p_code, 'INR'))
           when 'INR' then '₹' when 'USD' then '$' when 'EUR' then '€' when 'GBP' then '£'
           else upper(p_code) || ' ' end
         || to_char(p_cents / 100.0, 'FM999999999990.00');
$$;

create or replace function user_name(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select name from users where id = p_id), 'Someone');
$$;
revoke execute on function user_name(uuid) from public, anon, authenticated;

-- Category = first word of the type (expense_added -> expense), matched
-- against users.notification_prefs. Never notifies the actor themselves.
create or replace function notify_user(
  p_user uuid, p_actor uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare prefs jsonb;
begin
  if p_user is null or p_user = p_actor then return; end if;
  select notification_prefs into prefs from users where id = p_user;
  if prefs is not null and (prefs ->> split_part(p_type, '_', 1)) = 'false' then return; end if;
  insert into notifications (user_id, actor_user_id, type, title, body, data)
  values (p_user, p_actor, p_type, p_title, coalesce(p_body, ''), coalesce(p_data, '{}'));
end;
$$;

-- Internal only — clients must not be able to send arbitrary notifications.
revoke execute on function notify_user(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;

-- ============================================================
-- push delivery: every notification row fans out to the user's devices via
-- the Expo push service. pg_net is async, so a slow/failed push never blocks
-- or rolls back the write that caused it.
-- ============================================================
create or replace function send_push_for_notification() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  msgs jsonb;
  prefs jsonb;
begin
  select notification_prefs into prefs from users where id = new.user_id;
  if prefs is not null and (prefs ->> 'push') = 'false' then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', new.title,
           'body', new.body,
           'sound', 'default',
           'priority', 'high',
           'channelId', 'default',
           'data', new.data || jsonb_build_object('notification_id', new.id)))
    into msgs
    from push_tokens t where t.user_id = new.user_id;
  if msgs is null then return null; end if;

  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := msgs,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  exception when others then
    raise warning 'push send failed: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists notifications_push on notifications;
create trigger notifications_push after insert on notifications
  for each row execute function send_push_for_notification();

create or replace function register_push_token(p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  -- A device that switches accounts must stop receiving the old account's pushes.
  delete from push_tokens where token = p_token;
  insert into push_tokens (token, user_id, platform) values (p_token, auth.uid(), coalesce(p_platform, 'android'));
end;
$$;

create or replace function unregister_push_token(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

-- ============================================================
-- sign-up: accept pending friend invites for this email
-- ============================================================
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  insert into public.users (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );

  for inv in select * from friend_invites where email = lower(new.email) and accepted_at is null loop
    insert into friendships (user_id_a, user_id_b)
    values (least(new.id, inv.inviter_id), greatest(new.id, inv.inviter_id))
    on conflict do nothing;
    update friend_invites set accepted_at = now() where id = inv.id;
    perform notify_user(
      inv.inviter_id, new.id, 'friend_joined',
      user_name(new.id) || ' joined Tabmate',
      'You invited them — you can now split expenses together.',
      jsonb_build_object('url', '/friend/' || new.id)
    );
  end loop;
  return new;
end;
$$;

-- ============================================================
-- activity triggers — now SECURITY DEFINER (see header, point 2)
-- ============================================================
create or replace function log_expense_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_items (actor_user_id, group_id, type, ref_id, metadata)
  values (
    coalesce(auth.uid(), new.created_by),
    new.group_id,
    case when tg_op = 'INSERT' then 'expense_added'
         when new.deleted_at is not null and old.deleted_at is null then 'expense_deleted'
         else 'expense_updated' end,
    new.id,
    jsonb_build_object('description', new.description)
  );
  return null;
end;
$$;

create or replace function log_payment_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_items (actor_user_id, group_id, type, ref_id, metadata)
  values (coalesce(auth.uid(), new.from_user_id), new.group_id, 'payment_recorded', new.id,
          jsonb_build_object('amount_cents', new.amount_cents));
  return null;
end;
$$;

create or replace function log_comment_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare gid uuid; descr text;
begin
  select group_id, description into gid, descr from expenses where id = new.expense_id;
  insert into activity_items (actor_user_id, group_id, type, ref_id, metadata)
  values (new.user_id, gid, 'comment_added', new.expense_id,
          jsonb_build_object('description', descr, 'body', left(new.body, 40)));
  return null;
end;
$$;

create or replace function log_group_member_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.left_at is not distinct from new.left_at then return null; end if;
  insert into activity_items (actor_user_id, group_id, type, ref_id, metadata)
  values (
    new.user_id, new.group_id,
    case when tg_op = 'INSERT' or new.left_at is null then 'member_joined' else 'member_left' end,
    new.user_id, '{}'::jsonb
  );
  return null;
end;
$$;

-- ============================================================
-- notification triggers
-- ============================================================
create or replace function notify_expense_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(auth.uid(), new.created_by);
  t text; verb text; s record;
begin
  if new.deleted_at is not null and old.deleted_at is null then
    t := 'expense_deleted'; verb := ' deleted "';
  elsif new.deleted_at is null and old.deleted_at is not null then
    t := 'expense_restored'; verb := ' restored "';
  elsif new.updated_at is distinct from old.updated_at then
    t := 'expense_updated'; verb := ' edited "';
  else
    return null;
  end if;
  for s in select user_id from expense_shares where expense_id = new.id loop
    perform notify_user(s.user_id, actor, t, user_name(actor) || verb || new.description || '"',
      'Total ' || fmt_money(new.amount_cents, new.currency_code),
      jsonb_build_object('url', '/expense/' || new.id));
  end loop;
  return null;
end;
$$;

drop trigger if exists expenses_notify_update on expenses;
create trigger expenses_notify_update after update on expenses
  for each row execute function notify_expense_update();

create or replace function notify_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(auth.uid(), new.from_user_id);
  other uuid := case when actor = new.from_user_id then new.to_user_id else new.from_user_id end;
  amt text := fmt_money(new.amount_cents, new.currency_code);
begin
  if tg_op = 'INSERT' then
    perform notify_user(other, actor, 'payment_recorded',
      case when actor = new.from_user_id
           then user_name(actor) || ' paid you ' || amt
           else user_name(actor) || ' recorded that you paid them ' || amt end,
      'Recorded in Tabmate — balances are updated.',
      jsonb_build_object('url', '/payment/' || new.id));
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    perform notify_user(other, actor, 'payment_cancelled',
      user_name(actor) || ' cancelled a payment of ' || amt, 'Balances are updated.',
      jsonb_build_object('url', '/payment/' || new.id));
  end if;
  return null;
end;
$$;

drop trigger if exists payments_notify on payments;
create trigger payments_notify after insert or update of status on payments
  for each row execute function notify_payment();

create or replace function notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record; descr text;
begin
  select description into descr from expenses where id = new.expense_id;
  for s in select user_id from expense_shares where expense_id = new.expense_id loop
    perform notify_user(s.user_id, new.user_id, 'comment_added',
      user_name(new.user_id) || ' commented on "' || descr || '"', left(new.body, 140),
      jsonb_build_object('url', '/expense/' || new.expense_id));
  end loop;
  return null;
end;
$$;

drop trigger if exists comments_notify on expense_comments;
create trigger comments_notify after insert on expense_comments
  for each row execute function notify_comment();

create or replace function notify_group_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(auth.uid(), new.user_id);
  gname text;
  m record;
begin
  if tg_op = 'UPDATE' and old.left_at is not distinct from new.left_at then return null; end if;
  select name into gname from groups where id = new.group_id;

  if tg_op = 'INSERT' or new.left_at is null then
    if actor <> new.user_id then
      perform notify_user(new.user_id, actor, 'group_added',
        user_name(actor) || ' added you to "' || gname || '"', 'Tap to open the group.',
        jsonb_build_object('url', '/group/' || new.group_id));
    else
      -- joined by invite code: tell everyone already in the group
      for m in select user_id from group_members where group_id = new.group_id and left_at is null and user_id <> new.user_id loop
        perform notify_user(m.user_id, actor, 'group_joined',
          user_name(actor) || ' joined "' || gname || '"', 'Tap to open the group.',
          jsonb_build_object('url', '/group/' || new.group_id));
      end loop;
    end if;
  elsif actor <> new.user_id then
    perform notify_user(new.user_id, actor, 'group_removed',
      user_name(actor) || ' removed you from "' || gname || '"', '', '{}'::jsonb);
  end if;
  return null;
end;
$$;

drop trigger if exists group_members_notify on group_members;
create trigger group_members_notify after insert or update of left_at on group_members
  for each row execute function notify_group_member();

-- ============================================================
-- RPCs (recreated with auth checks + pinned search_path)
-- ============================================================
drop function if exists create_group(text, text);
create or replace function create_group(p_name text, p_member_ids uuid[] default '{}', p_cover_photo_url text default null)
returns groups language plpgsql security definer set search_path = public as $$
declare g groups; mid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'group name is required'; end if;
  insert into groups (name, cover_photo_url, created_by) values (trim(p_name), p_cover_photo_url, auth.uid()) returning * into g;
  insert into group_members (group_id, user_id) values (g.id, auth.uid());
  foreach mid in array coalesce(p_member_ids, '{}'::uuid[]) loop
    -- only people you're already connected to — not arbitrary user ids
    if mid <> auth.uid() and shares_connection(mid) then
      insert into group_members (group_id, user_id) values (g.id, mid) on conflict do nothing;
    end if;
  end loop;
  return g;
end;
$$;

create or replace function create_group_invite(p_group_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  i int;
begin
  if not is_group_member(p_group_id) then raise exception 'not a member of this group'; end if;
  -- Reuse a live code so "Invite" doesn't mint a new one on every tap.
  select code into v_code from group_invites
    where group_id = p_group_id and expires_at > now() + interval '1 day'
    order by created_at desc limit 1;
  if v_code is not null then return v_code; end if;
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from group_invites where code = v_code);
  end loop;
  insert into group_invites (group_id, code, created_by) values (p_group_id, v_code, auth.uid());
  return v_code;
end;
$$;

create or replace function check_invite_rate_limit() returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from invite_attempts where user_id = auth.uid() and created_at > now() - interval '15 minutes') >= 20 then
    raise exception 'too many invite code attempts — try again in a few minutes';
  end if;
end;
$$;
revoke execute on function check_invite_rate_limit() from public, anon, authenticated;

-- Failed lookups return empty/null instead of raising, so the recorded
-- attempt isn't rolled back with the error.
create or replace function preview_group_by_code(p_code text)
returns table (group_id uuid, name text, cover_photo_url text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform check_invite_rate_limit();
  return query
    select g.id, g.name, g.cover_photo_url
    from group_invites i join groups g on g.id = i.group_id
    where i.code = upper(trim(p_code)) and i.expires_at > now() and g.deleted_at is null;
  if not found then insert into invite_attempts (user_id) values (auth.uid()); end if;
end;
$$;

create or replace function join_group(p_code text)
returns groups language plpgsql security definer set search_path = public as $$
declare v_group_id uuid; g groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform check_invite_rate_limit();
  select i.group_id into v_group_id from group_invites i join groups gr on gr.id = i.group_id
    where i.code = upper(trim(p_code)) and i.expires_at > now() and gr.deleted_at is null;
  if v_group_id is null then
    insert into invite_attempts (user_id) values (auth.uid());
    return null;
  end if;
  if not is_group_member(v_group_id) then
    insert into group_members (group_id, user_id) values (v_group_id, auth.uid())
      on conflict (group_id, user_id) do update set left_at = null, joined_at = now();
  end if;
  select * into g from groups where id = v_group_id;
  return g;
end;
$$;

create or replace function validate_expense_shares(p_group_id uuid, p_shares jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_shares is null or jsonb_array_length(p_shares) = 0 then raise exception 'an expense needs at least one person'; end if;
  if p_group_id is not null then
    if not is_group_member(p_group_id) then raise exception 'not a member of this group'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_shares) s
      where not exists (select 1 from group_members gm
                        where gm.group_id = p_group_id and gm.user_id = (s->>'user_id')::uuid and gm.left_at is null)
    ) then raise exception 'everyone in the split must be in the group'; end if;
  else
    if not exists (select 1 from jsonb_array_elements(p_shares) s where (s->>'user_id')::uuid = auth.uid()) then
      raise exception 'you must be part of the expense';
    end if;
    if exists (select 1 from jsonb_array_elements(p_shares) s where not shares_connection((s->>'user_id')::uuid)) then
      raise exception 'you can only split with your friends';
    end if;
  end if;
end;
$$;
revoke execute on function validate_expense_shares(uuid, jsonb) from public, anon, authenticated;

create or replace function create_expense(payload jsonb)
returns expenses language plpgsql security definer set search_path = public as $$
declare
  e expenses;
  share jsonb;
  other_user uuid;
  s record;
  net bigint;
  gname text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform validate_expense_shares((payload->>'group_id')::uuid, payload->'shares');

  insert into expenses (group_id, description, amount_cents, currency_code, category, expense_date,
    split_type, repeat_interval, created_by)
  values (
    (payload->>'group_id')::uuid, payload->>'description', (payload->>'amount_cents')::bigint,
    coalesce(payload->>'currency_code', 'INR'), coalesce(payload->>'category', 'general'),
    coalesce((payload->>'expense_date')::date, current_date),
    coalesce((payload->>'split_type')::split_type, 'equal'),
    coalesce((payload->>'repeat_interval')::repeat_interval, 'none'),
    auth.uid()
  ) returning * into e;

  for share in select * from jsonb_array_elements(payload->'shares') loop
    insert into expense_shares (expense_id, user_id, paid_share_cents, owed_share_cents)
    values (e.id, (share->>'user_id')::uuid, coalesce((share->>'paid_cents')::bigint, 0), coalesce((share->>'owed_cents')::bigint, 0));
  end loop;

  if e.group_id is null then
    for other_user in select user_id from expense_shares where expense_id = e.id and user_id <> auth.uid() loop
      insert into friendships (user_id_a, user_id_b) values (least(auth.uid(), other_user), greatest(auth.uid(), other_user))
        on conflict do nothing;
    end loop;
  else
    select name into gname from groups where id = e.group_id;
  end if;

  for s in select user_id, paid_share_cents, owed_share_cents from expense_shares where expense_id = e.id loop
    net := s.paid_share_cents - s.owed_share_cents;
    perform notify_user(s.user_id, auth.uid(), 'expense_added',
      user_name(auth.uid()) || ' added "' || e.description || '"',
      case when net < 0 then 'You owe ' || fmt_money(-net, e.currency_code)
           when net > 0 then 'You get back ' || fmt_money(net, e.currency_code)
           else 'Total ' || fmt_money(e.amount_cents, e.currency_code) end
        || coalesce(' in ' || gname, ''),
      jsonb_build_object('url', '/expense/' || e.id));
  end loop;

  return e;
end;
$$;

create or replace function update_expense(p_id uuid, payload jsonb)
returns expenses language plpgsql security definer set search_path = public as $$
declare e expenses; share jsonb;
begin
  if not is_expense_party(p_id) then raise exception 'expense not found or not yours to edit'; end if;
  if payload ? 'shares' then
    perform validate_expense_shares((select group_id from expenses where id = p_id), payload->'shares');
  end if;

  update expenses set
    description = coalesce(payload->>'description', description),
    amount_cents = coalesce((payload->>'amount_cents')::bigint, amount_cents),
    category = coalesce(payload->>'category', category),
    split_type = coalesce((payload->>'split_type')::split_type, split_type),
    repeat_interval = coalesce((payload->>'repeat_interval')::repeat_interval, repeat_interval),
    updated_at = now()
  where id = p_id returning * into e;

  if payload ? 'shares' then
    delete from expense_shares where expense_id = p_id;
    for share in select * from jsonb_array_elements(payload->'shares') loop
      insert into expense_shares (expense_id, user_id, paid_share_cents, owed_share_cents)
      values (p_id, (share->>'user_id')::uuid, coalesce((share->>'paid_cents')::bigint, 0), coalesce((share->>'owed_cents')::bigint, 0));
    end loop;
  end if;
  return e;
end;
$$;

create or replace function get_group_balances(p_group_id uuid)
returns table (user_id uuid, balance_cents bigint)
language sql security definer stable set search_path = public as $$
  with expense_net as (
    select s.user_id, sum(s.paid_share_cents - s.owed_share_cents) as net
    from expense_shares s join expenses e on e.id = s.expense_id
    where e.group_id = p_group_id and e.deleted_at is null
    group by s.user_id
  ),
  payment_net as (
    select from_user_id as user_id, sum(amount_cents) as net from payments
      where group_id = p_group_id and status = 'confirmed' group by from_user_id
    union all
    select to_user_id as user_id, -sum(amount_cents) as net from payments
      where group_id = p_group_id and status = 'confirmed' group by to_user_id
  )
  select u.user_id, sum(u.net)::bigint as balance_cents
  from (select * from expense_net union all select * from payment_net) u
  where is_group_member(p_group_id)
  group by u.user_id
  having sum(u.net) <> 0;
$$;

create or replace function create_payment(p_group_id uuid, p_from_user_id uuid, p_to_user_id uuid, p_amount_cents bigint, p_currency_code text default 'INR')
returns payments language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  if auth.uid() is null or auth.uid() not in (p_from_user_id, p_to_user_id) then raise exception 'not a party to this payment'; end if;
  if p_group_id is not null and not is_group_member(p_group_id) then raise exception 'not a member of this group'; end if;
  if not shares_connection(case when auth.uid() = p_from_user_id then p_to_user_id else p_from_user_id end) then
    raise exception 'you can only record payments with your friends';
  end if;
  insert into payments (group_id, from_user_id, to_user_id, amount_cents, currency_code)
  values (p_group_id, p_from_user_id, p_to_user_id, p_amount_cents, p_currency_code)
  returning * into p;
  return p;
end;
$$;

drop function if exists add_friend_by_email(text);
create or replace function add_friend_by_email(p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target users;
  v_email text := lower(trim(p_email));
  n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into target from users where lower(email) = v_email;
  if target.id is null then
    insert into friend_invites (inviter_id, email) values (auth.uid(), v_email)
      on conflict (inviter_id, email) do nothing;
    return jsonb_build_object('status', 'invited', 'email', v_email);
  end if;
  if target.id = auth.uid() then return jsonb_build_object('status', 'self'); end if;

  insert into friendships (user_id_a, user_id_b)
  values (least(auth.uid(), target.id), greatest(auth.uid(), target.id))
  on conflict do nothing;
  get diagnostics n = row_count;

  if n > 0 then
    perform notify_user(target.id, auth.uid(), 'friend_added',
      user_name(auth.uid()) || ' added you as a friend',
      'You can now split expenses together on Tabmate.',
      jsonb_build_object('url', '/friend/' || auth.uid()));
  end if;

  return jsonb_build_object(
    'status', case when n > 0 then 'added' else 'already' end,
    'user', jsonb_build_object('id', target.id, 'name', target.name, 'email', target.email)
  );
end;
$$;

-- remaining SECURITY DEFINER functions from schema.sql: pin search_path
alter function is_group_member(uuid) set search_path = public;
alter function is_expense_party(uuid) set search_path = public;
alter function shares_connection(uuid) set search_path = public;
alter function get_simplified_transfers(uuid) set search_path = public;
alter function cancel_payment(uuid) set search_path = public;
alter function get_activity_feed(uuid, timestamptz) set search_path = public;

-- ============================================================
-- realtime: publish every table the app subscribes to
-- ============================================================
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['users', 'groups', 'group_members', 'friendships', 'expenses', 'expense_shares',
                           'payments', 'expense_comments', 'activity_items', 'notifications'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
