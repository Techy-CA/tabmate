-- Tabmate — full schema + RLS + RPC functions
-- Postgres on Supabase. Money is always integer minor units (cents/paise) + a currency code.
-- All timestamps are timestamptz in UTC. Paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once against a fresh project.

create extension if not exists "pgcrypto";

-- ============================================================
-- users  (mirrors auth.users; trigger below keeps it in sync)
-- ============================================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  avatar_url text,
  default_currency char(3) not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keeps public.users in sync with auth.users automatically — every sign-up
-- (email or Google) creates its matching row here with no client round-trip.
create or replace function handle_new_auth_user() returns trigger as $$
begin
  insert into public.users (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ============================================================
-- groups
-- ============================================================
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_photo_url text,
  default_currency char(3) not null default 'INR',
  simplify_debts boolean not null default true,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on groups (created_by);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id)
);
create index on group_members (user_id);

create table group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
create index on group_invites (group_id);

-- ============================================================
-- friendships (1:1 relationship outside any group)
-- ============================================================
create table friendships (
  user_id_a uuid not null references users(id) on delete cascade,
  user_id_b uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id_a, user_id_b),
  constraint ordered_pair check (user_id_a < user_id_b)
);
-- A friendship row is created automatically the first time two users share a
-- non-group expense (see create_expense below), or explicitly via
-- add_friend_by_email — both insert with least()/greatest() so the ordered
-- pair constraint is always satisfied regardless of call order.

-- ============================================================
-- expenses
-- ============================================================
create type split_type as enum ('equal','exact','percentage','shares','adjustment','itemized');
create type repeat_interval as enum ('none','weekly','fortnightly','monthly','yearly');

create table expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,      -- null = one-off / friend expense
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency_code char(3) not null,
  category text not null default 'general',
  expense_date date not null default current_date,
  split_type split_type not null default 'equal',
  repeat_interval repeat_interval not null default 'none',
  recurring_template_id uuid references expenses(id) on delete set null, -- set on generated instances
  receipt_url text,
  created_by uuid not null references users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on expenses (group_id, expense_date);
create index on expenses (created_by);
create index on expenses (recurring_template_id);

create table expense_shares (
  expense_id uuid not null references expenses(id) on delete cascade,
  user_id uuid not null references users(id) on delete restrict,
  paid_share_cents bigint not null default 0 check (paid_share_cents >= 0),
  owed_share_cents bigint not null default 0 check (owed_share_cents >= 0),
  primary key (expense_id, user_id)
);
create index on expense_shares (user_id);

create table expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  name text not null,
  amount_cents bigint not null check (amount_cents > 0),
  kind text not null default 'item' check (kind in ('item','tax','tip','discount')),
  created_at timestamptz not null default now()
);
create index on expense_items (expense_id);

create table expense_item_assignees (
  expense_item_id uuid not null references expense_items(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (expense_item_id, user_id)
);

create table expense_comments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  user_id uuid not null references users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on expense_comments (expense_id, created_at);

-- ============================================================
-- payments (settle up) — Tabmate only ever records a payment made outside
-- the app (cash, bank transfer, UPI the user did themselves). It's an
-- expense tracker between friends, not a payment processor: no gateway
-- integration, no payment method, no async pending/failed state.
-- ============================================================
create type payment_status as enum ('confirmed','cancelled');

create table payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete set null,
  from_user_id uuid not null references users(id) on delete restrict,
  to_user_id uuid not null references users(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency_code char(3) not null,
  status payment_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  constraint different_people check (from_user_id <> to_user_id)
);
create index on payments (from_user_id);
create index on payments (to_user_id);
create index on payments (group_id);

-- ============================================================
-- activity feed (populated only by triggers — never written directly)
-- ============================================================
create table activity_items (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  group_id uuid references groups(id) on delete cascade,
  type text not null check (type in
    ('expense_added','expense_updated','expense_deleted','payment_recorded',
     'comment_added','member_joined','member_left','group_updated')),
  ref_id uuid not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on activity_items (group_id, created_at desc);
create index on activity_items (actor_user_id, created_at desc);

-- ============================================================
-- helper functions — centralize the RLS membership checks so policies don't
-- self-reference their own table in a subquery (recursion/perf footgun).
-- ============================================================
create or replace function is_group_member(gid uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid() and left_at is null
  );
$$;

create or replace function is_expense_party(eid uuid) returns boolean
language sql security definer stable as $$
  select exists (select 1 from expense_shares where expense_id = eid and user_id = auth.uid())
    or exists (
      select 1 from expenses e
      where e.id = eid and e.group_id is not null and is_group_member(e.group_id)
    );
$$;

create or replace function shares_connection(other_user uuid) returns boolean
language sql security definer stable as $$
  select other_user = auth.uid()
    or exists (
      select 1 from group_members a join group_members b on a.group_id = b.group_id
      where a.user_id = auth.uid() and b.user_id = other_user and a.left_at is null and b.left_at is null
    )
    or exists (
      select 1 from friendships
      where (user_id_a = auth.uid() and user_id_b = other_user)
         or (user_id_b = auth.uid() and user_id_a = other_user)
    )
    or exists (
      select 1 from expense_shares s1 join expense_shares s2 on s1.expense_id = s2.expense_id
      where s1.user_id = auth.uid() and s2.user_id = other_user
    );
$$;

-- ============================================================
-- balancing trigger — the database guarantees a split adds up, the UI just can't prevent it
-- ============================================================
create or replace function check_expense_shares_balance() returns trigger as $$
declare
  total_amount bigint;
  sum_paid bigint;
  sum_owed bigint;
begin
  select amount_cents into total_amount from expenses where id = coalesce(new.expense_id, old.expense_id);
  select coalesce(sum(paid_share_cents),0), coalesce(sum(owed_share_cents),0)
    into sum_paid, sum_owed
    from expense_shares where expense_id = coalesce(new.expense_id, old.expense_id);
  if sum_paid <> total_amount or sum_owed <> total_amount then
    raise exception 'expense_shares for % do not balance: paid=%, owed=%, expected=%',
      coalesce(new.expense_id, old.expense_id), sum_paid, sum_owed, total_amount;
  end if;
  return null;
end;
$$ language plpgsql;

create constraint trigger expense_shares_balance
  after insert or update or delete on expense_shares
  deferrable initially deferred
  for each row execute function check_expense_shares_balance();

-- ============================================================
-- activity-logging triggers — one place generates the feed, so no RPC can forget to log an event
-- ============================================================
create or replace function log_expense_activity() returns trigger as $$
begin
  insert into activity_items (actor_user_id, group_id, type, ref_id, metadata)
  values (
    coalesce(new.created_by, old.created_by),
    coalesce(new.group_id, old.group_id),
    case when tg_op = 'INSERT' then 'expense_added'
         when tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then 'expense_deleted'
         else 'expense_updated' end,
    coalesce(new.id, old.id),
    jsonb_build_object('description', coalesce(new.description, old.description))
  );
  return null;
end;
$$ language plpgsql;

create trigger expenses_activity
  after insert or update on expenses
  for each row execute function log_expense_activity();

create or replace function log_payment_activity() returns trigger as $$
begin
  insert into activity_items (actor_user_id, group_id, type, ref_id, metadata)
  values (auth.uid(), new.group_id, 'payment_recorded', new.id, jsonb_build_object('amount_cents', new.amount_cents));
  return new;
end;
$$ language plpgsql;

create trigger payments_activity
  after insert on payments
  for each row execute function log_payment_activity();

create or replace function log_comment_activity() returns trigger as $$
declare
  gid uuid;
begin
  select group_id into gid from expenses where id = new.expense_id;
  insert into activity_items (actor_user_id, group_id, type, ref_id, metadata)
  values (new.user_id, gid, 'comment_added', new.expense_id, jsonb_build_object('body', left(new.body, 40)));
  return new;
end;
$$ language plpgsql;

create trigger comments_activity
  after insert on expense_comments
  for each row execute function log_comment_activity();

create or replace function log_group_member_activity() returns trigger as $$
begin
  insert into activity_items (actor_user_id, group_id, type, ref_id, metadata)
  values (
    new.user_id, new.group_id,
    case when tg_op = 'INSERT' then 'member_joined' else 'member_left' end,
    new.user_id, '{}'::jsonb
  );
  return new;
end;
$$ language plpgsql;

create trigger group_members_activity
  after insert or update of left_at on group_members
  for each row execute function log_group_member_activity();

-- ============================================================
-- row level security
-- ============================================================
alter table users enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_invites enable row level security;
alter table friendships enable row level security;
alter table expenses enable row level security;
alter table expense_shares enable row level security;
alter table expense_items enable row level security;
alter table expense_item_assignees enable row level security;
alter table expense_comments enable row level security;
alter table payments enable row level security;
alter table activity_items enable row level security;

create policy users_select on users for select using (shares_connection(id));
create policy users_update_self on users for update using (id = auth.uid());

create policy groups_select on groups for select using (is_group_member(id));
create policy groups_update on groups for update using (is_group_member(id));

create policy group_members_select on group_members for select using (is_group_member(group_id));
create policy group_members_insert on group_members for insert with check (is_group_member(group_id) or user_id = auth.uid());
create policy group_members_update on group_members for update using (is_group_member(group_id));

-- Deliberately NOT "using (true)": that would let any authenticated user
-- list every group's invite codes directly from the table, defeating the
-- "need the code" secrecy entirely. preview_group_by_code and join_group
-- are SECURITY DEFINER, so they resolve a code without needing this policy
-- to allow it — this just gates direct table reads to members only.
create policy group_invites_select on group_invites for select using (is_group_member(group_id));
create policy group_invites_insert on group_invites for insert with check (is_group_member(group_id));

create policy friendships_select on friendships for select using (auth.uid() in (user_id_a, user_id_b));
create policy friendships_insert on friendships for insert with check (auth.uid() in (user_id_a, user_id_b));

create policy expenses_select on expenses for select using (is_expense_party(id));
create policy expenses_update on expenses for update using (is_expense_party(id));
create policy expenses_insert on expenses for insert with check (created_by = auth.uid());

create policy expense_shares_select on expense_shares for select using (is_expense_party(expense_id));
create policy expense_shares_write on expense_shares for all using (is_expense_party(expense_id));

create policy expense_items_select on expense_items for select using (is_expense_party(expense_id));
create policy expense_items_write on expense_items for all using (is_expense_party(expense_id));

create policy expense_item_assignees_select on expense_item_assignees for select using (
  exists (select 1 from expense_items where id = expense_item_id and is_expense_party(expense_id))
);

create policy expense_comments_select on expense_comments for select using (is_expense_party(expense_id));
create policy expense_comments_insert on expense_comments for insert with check (is_expense_party(expense_id) and user_id = auth.uid());

create policy payments_select on payments for select using (
  auth.uid() in (from_user_id, to_user_id) or (group_id is not null and is_group_member(group_id))
);
create policy payments_insert on payments for insert with check (auth.uid() in (from_user_id, to_user_id));

create policy activity_select on activity_items for select using (
  (group_id is not null and is_group_member(group_id))
  or (group_id is null and shares_connection(actor_user_id))
);

-- ============================================================
-- RPC functions — anything atomic or multi-table lives here instead of
-- being assembled client-side from separate round-trips.
-- ============================================================

create or replace function create_group(p_name text, p_cover_photo_url text default null)
returns groups language plpgsql security definer as $$
declare g groups;
begin
  insert into groups (name, cover_photo_url, created_by) values (p_name, p_cover_photo_url, auth.uid()) returning * into g;
  insert into group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end;
$$;

create or replace function create_group_invite(p_group_id uuid)
returns text language plpgsql security definer as $$
declare v_code text;
begin
  if not is_group_member(p_group_id) then raise exception 'not a member of this group'; end if;
  v_code := upper(substr(encode(gen_random_bytes(6), 'base64'), 1, 6));
  v_code := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');
  insert into group_invites (group_id, code, created_by) values (p_group_id, v_code, auth.uid());
  return v_code;
end;
$$;

create or replace function preview_group_by_code(p_code text)
returns table (group_id uuid, name text, cover_photo_url text)
language sql security definer stable as $$
  select g.id, g.name, g.cover_photo_url
  from group_invites i join groups g on g.id = i.group_id
  where i.code = upper(p_code) and i.expires_at > now();
$$;

create or replace function join_group(p_code text)
returns groups language plpgsql security definer as $$
declare v_group_id uuid; g groups;
begin
  select group_id into v_group_id from group_invites where code = upper(p_code) and expires_at > now();
  if v_group_id is null then raise exception 'invalid or expired invite code'; end if;
  insert into group_members (group_id, user_id) values (v_group_id, auth.uid())
    on conflict (group_id, user_id) do update set left_at = null;
  select * into g from groups where id = v_group_id;
  return g;
end;
$$;

-- payload shape (jsonb): { group_id, description, amount_cents, currency_code, category,
-- expense_date, split_type, repeat_interval, shares: [{user_id, paid_cents, owed_cents}] }
create or replace function create_expense(payload jsonb)
returns expenses language plpgsql security definer as $$
declare
  e expenses;
  share jsonb;
  other_user uuid;
begin
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

  -- One-off (non-group) expense: make sure a friendship row exists between
  -- every pair of participants, matching how the original behaves.
  if e.group_id is null then
    for other_user in select user_id from expense_shares where expense_id = e.id and user_id <> auth.uid() loop
      insert into friendships (user_id_a, user_id_b) values (least(auth.uid(), other_user), greatest(auth.uid(), other_user))
        on conflict do nothing;
    end loop;
  end if;

  return e;
end;
$$;

create or replace function update_expense(p_id uuid, payload jsonb)
returns expenses language plpgsql security definer as $$
declare e expenses; share jsonb;
begin
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
language sql security definer stable as $$
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
  group by u.user_id
  having sum(u.net) <> 0;
$$;

create or replace function get_simplified_transfers(p_group_id uuid)
returns table ("from" uuid, "to" uuid, amount_cents bigint)
language plpgsql security definer as $$
declare
  debtors record; creditors record;
  d_cursor refcursor; c_cursor refcursor;
  d record; c record;
  d_remaining bigint; c_remaining bigint;
  transfer_amount bigint;
begin
  create temp table t_debtors on commit drop as
    select user_id, -balance_cents as owed from get_group_balances(p_group_id) where balance_cents < 0 order by balance_cents asc;
  create temp table t_creditors on commit drop as
    select user_id, balance_cents as owed from get_group_balances(p_group_id) where balance_cents > 0 order by balance_cents desc;

  open d_cursor for select * from t_debtors;
  fetch d_cursor into d;
  open c_cursor for select * from t_creditors;
  fetch c_cursor into c;
  d_remaining := d.owed;
  c_remaining := c.owed;

  while found and d_remaining is not null and c_remaining is not null loop
    transfer_amount := least(d_remaining, c_remaining);
    if transfer_amount > 0 then
      "from" := d.user_id; "to" := c.user_id; amount_cents := transfer_amount;
      return next;
      d_remaining := d_remaining - transfer_amount;
      c_remaining := c_remaining - transfer_amount;
    end if;
    if d_remaining = 0 then
      fetch d_cursor into d;
      d_remaining := d.owed;
    end if;
    if c_remaining = 0 then
      fetch c_cursor into c;
      c_remaining := c.owed;
    end if;
  end loop;
  close d_cursor;
  close c_cursor;
  return;
end;
$$;

create or replace function create_payment(p_group_id uuid, p_from_user_id uuid, p_to_user_id uuid, p_amount_cents bigint, p_currency_code text default 'INR')
returns payments language plpgsql security definer as $$
declare p payments;
begin
  if auth.uid() not in (p_from_user_id, p_to_user_id) then raise exception 'not a party to this payment'; end if;
  insert into payments (group_id, from_user_id, to_user_id, amount_cents, currency_code)
  values (p_group_id, p_from_user_id, p_to_user_id, p_amount_cents, p_currency_code)
  returning * into p;
  return p;
end;
$$;

create or replace function cancel_payment(p_id uuid)
returns payments language plpgsql security definer as $$
declare p payments;
begin
  update payments set status = 'cancelled' where id = p_id and auth.uid() in (from_user_id, to_user_id) returning * into p;
  if p.id is null then raise exception 'payment not found or not yours to cancel'; end if;
  return p;
end;
$$;

create or replace function get_activity_feed(p_group_id uuid default null, p_cursor timestamptz default null)
returns setof activity_items language sql security definer stable as $$
  select * from activity_items
  where (p_group_id is not null and group_id = p_group_id)
     or (p_group_id is null and group_id is null and shares_connection(actor_user_id))
     or (p_group_id is null and group_id is not null and is_group_member(group_id))
  order by created_at desc
  limit 50;
$$;

-- Looks up an existing user by email and adds an explicit friendship.
-- Returns null if no account exists with that email yet (there's no real
-- invite-email send until Resend is wired up).
create or replace function add_friend_by_email(p_email text)
returns users language plpgsql security definer as $$
declare target users;
begin
  select * into target from users where lower(email) = lower(p_email);
  if target.id is null then return null; end if;
  if target.id = auth.uid() then raise exception 'cannot add yourself'; end if;
  insert into friendships (user_id_a, user_id_b)
  values (least(auth.uid(), target.id), greatest(auth.uid(), target.id))
  on conflict do nothing;
  return target;
end;
$$;
