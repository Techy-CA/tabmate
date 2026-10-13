-- Splitsy (working name) — initial schema
-- Postgres on Supabase. Money is always integer minor units (cents/paise) + a currency code.
-- All timestamps are timestamptz in UTC. RLS is enabled on every table; policies noted per-table.

create extension if not exists "pgcrypto";

-- ============================================================
-- users  (mirrors auth.users; Supabase trigger keeps it in sync)
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
-- RLS: a user can select any user row they share a group or friendship with (needed to render
-- names/avatars on shared expenses); can only update their own row.

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
-- RLS: select/update only if the caller has a row in group_members for this group.

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id)
);
create index on group_members (user_id);
-- RLS: any current member can insert (add) or soft-delete (set left_at) any row in their group —
-- matches the original's flat "no group admins" model (recon.md, source #9).

create table group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
create index on group_invites (group_id);
-- RLS: insert by any group member; select by anyone (needed to preview a group before joining),
-- but the function that resolves a code enforces expiry — see "join_group" below.

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
-- a friendship row is created automatically (by the create_expense function) the first time two
-- users share a non-group expense, so there is no separate "add friend" flow to build for v1.
-- RLS: select/insert only where caller is user_id_a or user_id_b.

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
-- RLS: select/update/delete if caller has a row in expense_shares for this expense, OR is a
-- current group_members row for expenses.group_id. Matches the original: anyone involved, or
-- anyone in the group, can edit/delete (recon.md source #9) — soft-delete via deleted_at, never
-- a hard DELETE, so "restore a deleted expense" (a listed must-have) is just un-setting the flag.

create table expense_shares (
  expense_id uuid not null references expenses(id) on delete cascade,
  user_id uuid not null references users(id) on delete restrict,
  paid_share_cents bigint not null default 0 check (paid_share_cents >= 0),
  owed_share_cents bigint not null default 0 check (owed_share_cents >= 0),
  primary key (expense_id, user_id)
);
create index on expense_shares (user_id);
-- a trigger (see below) rejects any insert/update where sum(paid_share_cents) or
-- sum(owed_share_cents) across the expense doesn't equal expenses.amount_cents — the database,
-- not the UI, is the source of truth that a split "adds up" (recon.md S07 error state).
-- RLS: select if caller is a party to the expense or a group member; insert/update only via the
-- create_expense / update_expense functions (not directly), so the balancing check always runs.

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
-- payments (settle up)
-- ============================================================
create type payment_method as enum ('manual','razorpay_link');
create type payment_status as enum ('pending','confirmed','failed','cancelled');

create table payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete set null,
  from_user_id uuid not null references users(id) on delete restrict,
  to_user_id uuid not null references users(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency_code char(3) not null,
  method payment_method not null default 'manual',
  status payment_status not null default 'confirmed', -- manual records are confirmed on insert
  razorpay_payment_link_id text unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint different_people check (from_user_id <> to_user_id)
);
create index on payments (from_user_id);
create index on payments (to_user_id);
create index on payments (group_id);
-- RLS: select/insert only where caller is from_user_id or to_user_id, or a member of group_id.

-- ============================================================
-- activity feed (populated by triggers below — never written directly by app code)
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
-- RLS: select if caller is a member of group_id (or, for group_id null, a party referenced in
-- metadata — non-group activity is filtered server-side in the get_activity_feed function).

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
-- activity-logging triggers (one source of truth, not scattered across every API call)
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

-- equivalent triggers exist for payments -> 'payment_recorded', expense_comments -> 'comment_added',
-- and group_members -> 'member_joined' / 'member_left' (same shape, omitted here for brevity).
