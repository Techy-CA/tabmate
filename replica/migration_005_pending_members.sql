-- Migration 005 — people who aren't on Tabmate yet, as real (pending) members.
--
-- Run AFTER migration_004 in the Supabase SQL Editor. Safe to re-run.
--
-- Before: adding an email/number that isn't on Tabmate only saved an invite
-- note — that person couldn't be put in a group or an expense until they
-- signed up. Now it creates a *pending* user (users.is_placeholder) with the
-- name you give them. They show up as a friend, can be added to groups,
-- split with and settled with, like anyone else, marked "Invited".
--
-- When they sign up with that email (or later set that number on their
-- profile), the pending user is merged into their real account: every
-- group, expense share, payment, friendship and notification moves over, so
-- everything is already there on first login.
--
-- Placeholders have no auth account, so users.id can no longer reference
-- auth.users, and email becomes optional (number-only invites).

alter table users drop constraint if exists users_id_fkey;
alter table users alter column email drop not null;
alter table users add column if not exists is_placeholder boolean not null default false;
alter table users add column if not exists invited_by uuid references users(id) on delete set null;
create index if not exists users_email_lower_idx on users (lower(email));

-- ============================================================
-- merge a pending user into a real account
-- ============================================================
create or replace function merge_placeholder(p_ph uuid, p_real uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_ph = p_real or not exists (select 1 from users where id = p_ph and is_placeholder) then return; end if;

  -- group memberships (keep the real one if both exist; active wins)
  update group_members gm set left_at = null
    where gm.user_id = p_real and gm.left_at is not null
      and exists (select 1 from group_members x where x.group_id = gm.group_id and x.user_id = p_ph and x.left_at is null);
  update group_members set user_id = p_real
    where user_id = p_ph and group_id not in (select group_id from group_members where user_id = p_real);
  delete from group_members where user_id = p_ph;

  -- expense shares (if both were in one expense, combine their shares)
  for r in select s.* from expense_shares s
           where s.user_id = p_ph and exists (select 1 from expense_shares t where t.expense_id = s.expense_id and t.user_id = p_real)
  loop
    update expense_shares set paid_share_cents = paid_share_cents + r.paid_share_cents,
                              owed_share_cents = owed_share_cents + r.owed_share_cents
      where expense_id = r.expense_id and user_id = p_real;
    delete from expense_shares where expense_id = r.expense_id and user_id = p_ph;
  end loop;
  update expense_shares set user_id = p_real where user_id = p_ph;

  update expense_item_assignees set user_id = p_real
    where user_id = p_ph and expense_item_id not in (select expense_item_id from expense_item_assignees where user_id = p_real);
  delete from expense_item_assignees where user_id = p_ph;

  update payments set from_user_id = p_real where from_user_id = p_ph and to_user_id <> p_real;
  update payments set to_user_id = p_real where to_user_id = p_ph and from_user_id <> p_real;
  -- a payment between the pending user and the real user themselves (only
  -- possible if someone settled with both) would become self-to-self: drop it
  delete from payments where p_ph in (from_user_id, to_user_id);

  -- friendships: re-key (ordered pair), skipping self-friendship and duplicates
  for r in select case when user_id_a = p_ph then user_id_b else user_id_a end as other
           from friendships where p_ph in (user_id_a, user_id_b)
  loop
    if r.other <> p_real then
      insert into friendships (user_id_a, user_id_b) values (least(p_real, r.other), greatest(p_real, r.other))
        on conflict do nothing;
    end if;
  end loop;
  delete from friendships where p_ph in (user_id_a, user_id_b);

  update expense_comments set user_id = p_real where user_id = p_ph;
  update expenses set created_by = p_real where created_by = p_ph;
  update groups set created_by = p_real where created_by = p_ph;
  update group_invites set created_by = p_real where created_by = p_ph;
  update activity_items set actor_user_id = p_real where actor_user_id = p_ph;
  update notifications set user_id = p_real where user_id = p_ph;
  update notifications set actor_user_id = p_real where actor_user_id = p_ph;
  -- invited twice (e.g. by email and by number) -> identical notifications; keep the first
  delete from notifications n using notifications m
    where n.user_id = p_real and m.user_id = p_real and n.id <> m.id
      and n.type = m.type and n.title = m.title and n.data = m.data
      and (n.created_at, n.id) > (m.created_at, m.id);
  update friend_invites set inviter_id = p_real where inviter_id = p_ph;
  update users set invited_by = p_real where invited_by = p_ph;

  delete from users where id = p_ph;
end;
$$;
revoke execute on function merge_placeholder(uuid, uuid) from public, anon, authenticated;

-- ============================================================
-- sign-up: claim pending users with this email/number
-- ============================================================
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := normalize_phone(new.raw_user_meta_data->>'phone');
  v_ph uuid[];
  ph uuid;
begin
  select array_agg(id) into v_ph from users
    where is_placeholder
      and (lower(email) = lower(new.email) or (v_phone is not null and phone = v_phone));
  -- free the email/number so the real row doesn't collide with the pending one
  update users set email = null, phone = null where id = any(coalesce(v_ph, '{}'));

  if v_phone is not null and exists (select 1 from users where phone = v_phone) then v_phone := null; end if;
  insert into public.users (id, name, email, avatar_url, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    v_phone
  );

  foreach ph in array coalesce(v_ph, '{}') loop
    perform merge_placeholder(ph, new.id);
  end loop;
  perform accept_pending_invites(new.id);  -- invites saved before this migration
  return new;
end;
$$;

-- A real user adding a number on their profile claims a pending user with it.
create or replace function claim_placeholders_by_phone(p_real uuid, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare ph uuid;
begin
  for ph in select id from users where is_placeholder and phone = p_phone and id <> p_real loop
    update users set phone = null where id = ph;
    perform merge_placeholder(ph, p_real);
  end loop;
end;
$$;
revoke execute on function claim_placeholders_by_phone(uuid, text) from public, anon, authenticated;

-- SECURITY DEFINER: claiming a pending user touches rows the signed-in
-- user can't write directly.
create or replace function users_normalize_phone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.phone is not null and trim(new.phone) = '' then new.phone := null; end if;
  if new.phone is not null then
    new.phone := normalize_phone(new.phone);
    if new.phone is null then raise exception 'invalid phone number' using errcode = '22023'; end if;
    if tg_op = 'UPDATE' and not new.is_placeholder and new.phone is distinct from old.phone then
      perform claim_placeholders_by_phone(new.id, new.phone);
    end if;
  end if;
  return new;
end;
$$;

-- Pending users can't change themselves (no login), and nobody else may
-- edit them except through the RPCs below.
drop policy if exists users_update_self on users;
create policy users_update_self on users for update using (id = auth.uid() and not is_placeholder);

-- ============================================================
-- add_friend: unknown email/number -> ask for a name, then create pending
-- ============================================================
drop function if exists add_friend(text);
create or replace function add_friend(p_identifier text, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_raw text := trim(coalesce(p_identifier, ''));
  v_email text;
  v_phone text;
  target users;
  n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  if position('@' in v_raw) > 0 then
    v_email := lower(v_raw);
    if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      return jsonb_build_object('status', 'invalid');
    end if;
    select * into target from users where lower(email) = v_email order by is_placeholder limit 1;
  else
    v_phone := normalize_phone(v_raw);
    if v_phone is null then return jsonb_build_object('status', 'invalid'); end if;
    select * into target from users where phone = v_phone order by is_placeholder limit 1;
  end if;

  if target.id is null then
    -- Not on Tabmate: we need a name to show them by before creating them.
    if coalesce(trim(p_name), '') = '' then
      return jsonb_build_object('status', 'needs_name', 'email', v_email, 'phone', v_phone);
    end if;
    insert into users (id, name, email, phone, is_placeholder, invited_by)
    values (gen_random_uuid(), left(trim(p_name), 80), v_email, v_phone, true, auth.uid())
    returning * into target;
  end if;
  if target.id = auth.uid() then return jsonb_build_object('status', 'self'); end if;

  insert into friendships (user_id_a, user_id_b)
  values (least(auth.uid(), target.id), greatest(auth.uid(), target.id))
  on conflict do nothing;
  get diagnostics n = row_count;

  if n > 0 then
    -- for a pending user this waits in their inbox until they sign up
    perform notify_user(target.id, auth.uid(), 'friend_added',
      user_name(auth.uid()) || ' added you as a friend',
      'You can now split expenses together on Tabmate.',
      jsonb_build_object('url', '/friend/' || auth.uid()));
  end if;

  return jsonb_build_object(
    'status', case when target.is_placeholder then 'invited' when n > 0 then 'added' else 'already' end,
    'user', jsonb_build_object('id', target.id, 'name', target.name, 'pending', target.is_placeholder),
    -- only what the caller typed (plus a pending user's own contact, which
    -- the inviter needs to send the invite) — never a real user's other details
    'email', coalesce(v_email, case when target.is_placeholder then target.email end),
    'phone', coalesce(v_phone, case when target.is_placeholder then target.phone end)
  );
end;
$$;

create or replace function add_friend_by_email(p_email text)
returns jsonb language sql security definer set search_path = public as $$
  select add_friend(p_email);
$$;

-- ============================================================
-- add someone to a group: an existing friend, or by email/number
-- ============================================================
create or replace function add_group_member(
  p_group_id uuid, p_user_id uuid default null, p_identifier text default null, p_name text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := p_user_id;
  res jsonb := '{}'::jsonb;
begin
  if not is_group_member(p_group_id) then raise exception 'not a member of this group'; end if;
  if v_user is null then
    res := add_friend(p_identifier, p_name);
    if res->>'status' in ('invalid', 'needs_name', 'self') then return res; end if;
    v_user := (res->'user'->>'id')::uuid;
  elsif not shares_connection(v_user) then
    raise exception 'you can only add your friends';
  end if;

  if exists (select 1 from group_members where group_id = p_group_id and user_id = v_user and left_at is null) then
    return res || jsonb_build_object('status', 'already_member', 'user_id', v_user);
  end if;
  insert into group_members (group_id, user_id) values (p_group_id, v_user)
    on conflict (group_id, user_id) do update set left_at = null, joined_at = now();
  return res || jsonb_build_object('status', 'added_to_group', 'user_id', v_user);
end;
$$;

-- ============================================================
-- contacts: only real accounts count as "on Tabmate"
-- ============================================================
create or replace function match_contacts(p_phones text[], p_emails text[])
returns table (input text, user_id uuid, name text, is_friend boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(array_length(p_phones, 1), 0) + coalesce(array_length(p_emails, 1), 0) > 3000 then
    raise exception 'too many contacts in one request';
  end if;
  return query
  with wanted as (
    select x as input, normalize_phone(x) as phone, null::text as email from unnest(coalesce(p_phones, '{}')) x
    union all
    select x, null, lower(trim(x)) from unnest(coalesce(p_emails, '{}')) x
  )
  select w.input, u.id, u.name,
         exists (select 1 from friendships f
                 where f.user_id_a = least(auth.uid(), u.id) and f.user_id_b = greatest(auth.uid(), u.id))
  from wanted w
  join users u on (w.phone is not null and u.phone = w.phone) or (w.email is not null and lower(u.email) = w.email)
  where u.id <> auth.uid() and not u.is_placeholder;
end;
$$;
