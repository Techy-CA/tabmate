-- Migration 008 — reminders, recurring auto-post, itemized bills, notes,
-- edit history, trip mode, kitty.
--
-- Run AFTER migration_007 in the Supabase SQL Editor. Safe to re-run.
-- For the scheduled jobs, enable the pg_cron extension first
-- (Database -> Extensions -> pg_cron). Without it everything else still
-- works and the app posts due recurring expenses itself when opened.

-- ============================================================
-- columns
-- ============================================================
alter table expenses add column if not exists notes text;

alter table groups add column if not exists group_type text not null default 'other';
alter table groups add column if not exists start_date date;
alter table groups add column if not exists end_date date;
alter table groups add column if not exists budget_cents bigint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_type_check') then
    alter table groups add constraint groups_type_check check (group_type in ('trip', 'home', 'couple', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_budget_check') then
    alter table groups add constraint groups_budget_check check (budget_cents is null or budget_cents > 0);
  end if;
end $$;

-- A kitty is a group's common pool, modelled as a special member: putting
-- money in is a payment to it, spending from it is an expense it "paid".
-- Everyone's balances then work with no special cases.
alter table users add column if not exists is_kitty boolean not null default false;

-- ============================================================
-- edit history
-- ============================================================
create table if not exists expense_history (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  changed_by uuid references users(id) on delete set null,
  action text not null check (action in ('created', 'edited', 'deleted', 'restored')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists expense_history_idx on expense_history (expense_id, created_at);
alter table expense_history enable row level security;
drop policy if exists expense_history_select on expense_history;
create policy expense_history_select on expense_history for select using (is_expense_party(expense_id));

create or replace function expense_snapshot(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'description', e.description, 'amount_cents', e.amount_cents, 'category', e.category,
    'expense_date', e.expense_date, 'notes', e.notes, 'split_type', e.split_type,
    'shares', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'paid_cents', s.paid_share_cents,
                                                             'owed_cents', s.owed_share_cents) order by s.user_id)
                        from expense_shares s where s.expense_id = e.id), '[]'::jsonb))
  from expenses e where e.id = p_id;
$$;
revoke execute on function expense_snapshot(uuid) from public, anon, authenticated;

create or replace function log_expense_delete_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    insert into expense_history (expense_id, changed_by, action) values (new.id, auth.uid(), 'deleted');
  elsif new.deleted_at is null and old.deleted_at is not null then
    insert into expense_history (expense_id, changed_by, action) values (new.id, auth.uid(), 'restored');
  end if;
  return null;
end;
$$;
drop trigger if exists expenses_delete_history on expenses;
create trigger expenses_delete_history after update of deleted_at on expenses
  for each row execute function log_expense_delete_history();

-- ============================================================
-- notify_user: never notify a kitty
-- ============================================================
create or replace function notify_user(
  p_user uuid, p_actor uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare prefs jsonb; kitty boolean;
begin
  if p_user is null or p_user = p_actor then return; end if;
  select notification_prefs, is_kitty into prefs, kitty from users where id = p_user;
  if kitty then return; end if;
  if prefs is not null and (prefs ->> split_part(p_type, '_', 1)) = 'false' then return; end if;
  insert into notifications (user_id, actor_user_id, type, title, body, data)
  values (p_user, p_actor, p_type, p_title, coalesce(p_body, ''), coalesce(p_data, '{}'));
end;
$$;
revoke execute on function notify_user(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;

-- ============================================================
-- itemized bills: items + who had each
-- payload.items = [{ name, amount_cents, kind: item|tax|tip|discount, user_ids: [...] }]
-- (the per-person shares are computed by the app and sent as usual; items
-- are stored so the bill can be shown and edited)
-- ============================================================
create or replace function save_expense_items(p_expense uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare it jsonb; v_item uuid; uid text;
begin
  delete from expense_items where expense_id = p_expense;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    continue when coalesce((it->>'amount_cents')::bigint, 0) <= 0;
    insert into expense_items (expense_id, name, amount_cents, kind)
    values (p_expense, left(coalesce(nullif(trim(it->>'name'), ''), 'Item'), 120), (it->>'amount_cents')::bigint,
            coalesce(it->>'kind', 'item'))
    returning id into v_item;
    for uid in select jsonb_array_elements_text(coalesce(it->'user_ids', '[]'::jsonb)) loop
      insert into expense_item_assignees (expense_item_id, user_id) values (v_item, uid::uuid) on conflict do nothing;
    end loop;
  end loop;
end;
$$;
revoke execute on function save_expense_items(uuid, jsonb) from public, anon, authenticated;

-- ============================================================
-- create / update expense (002 versions + notes, date, items, history)
-- ============================================================
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
    split_type, repeat_interval, notes, created_by)
  values (
    (payload->>'group_id')::uuid, payload->>'description', (payload->>'amount_cents')::bigint,
    coalesce(payload->>'currency_code', 'INR'), coalesce(payload->>'category', 'general'),
    coalesce((payload->>'expense_date')::date, current_date),
    coalesce((payload->>'split_type')::split_type, 'equal'),
    coalesce((payload->>'repeat_interval')::repeat_interval, 'none'),
    nullif(trim(coalesce(payload->>'notes', '')), ''),
    auth.uid()
  ) returning * into e;

  for share in select * from jsonb_array_elements(payload->'shares') loop
    insert into expense_shares (expense_id, user_id, paid_share_cents, owed_share_cents)
    values (e.id, (share->>'user_id')::uuid, coalesce((share->>'paid_cents')::bigint, 0), coalesce((share->>'owed_cents')::bigint, 0));
  end loop;
  if payload ? 'items' then perform save_expense_items(e.id, payload->'items'); end if;

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

  insert into expense_history (expense_id, changed_by, action, after) values (e.id, auth.uid(), 'created', expense_snapshot(e.id));
  return e;
end;
$$;

create or replace function update_expense(p_id uuid, payload jsonb)
returns expenses language plpgsql security definer set search_path = public as $$
declare e expenses; share jsonb; v_before jsonb; v_after jsonb;
begin
  if not is_expense_party(p_id) then raise exception 'expense not found or not yours to edit'; end if;
  if payload ? 'shares' then
    perform validate_expense_shares((select group_id from expenses where id = p_id), payload->'shares');
  end if;
  v_before := expense_snapshot(p_id);

  update expenses set
    description = coalesce(payload->>'description', description),
    amount_cents = coalesce((payload->>'amount_cents')::bigint, amount_cents),
    category = coalesce(payload->>'category', category),
    split_type = coalesce((payload->>'split_type')::split_type, split_type),
    repeat_interval = coalesce((payload->>'repeat_interval')::repeat_interval, repeat_interval),
    expense_date = coalesce((payload->>'expense_date')::date, expense_date),
    notes = case when payload ? 'notes' then nullif(trim(coalesce(payload->>'notes', '')), '') else notes end,
    updated_at = now()
  where id = p_id returning * into e;

  if payload ? 'shares' then
    delete from expense_shares where expense_id = p_id;
    for share in select * from jsonb_array_elements(payload->'shares') loop
      insert into expense_shares (expense_id, user_id, paid_share_cents, owed_share_cents)
      values (p_id, (share->>'user_id')::uuid, coalesce((share->>'paid_cents')::bigint, 0), coalesce((share->>'owed_cents')::bigint, 0));
    end loop;
  end if;
  if payload ? 'items' then perform save_expense_items(p_id, payload->'items'); end if;

  v_after := expense_snapshot(p_id);
  if v_after is distinct from v_before then
    insert into expense_history (expense_id, changed_by, action, before, after) values (p_id, auth.uid(), 'edited', v_before, v_after);
  end if;
  return e;
end;
$$;

-- ============================================================
-- recurring expenses: post every due occurrence
-- ============================================================
create or replace function post_recurring_expenses() returns int
language plpgsql security definer set search_path = public as $$
declare
  t expenses;
  k int;
  due date;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  v_new uuid;
  posted int := 0;
  s record;
  net bigint;
  step interval;
begin
  for t in
    select e.* from expenses e left join groups g on g.id = e.group_id
    where e.repeat_interval <> 'none' and e.deleted_at is null and e.recurring_template_id is null
      and (e.group_id is null or g.deleted_at is null)
  loop
    step := case t.repeat_interval when 'weekly' then interval '7 days' when 'fortnightly' then interval '14 days'
                                   when 'monthly' then interval '1 month' else interval '1 year' end;
    -- counted from the original date (no month-end drift); deleted copies
    -- still count, so deleting one occurrence doesn't make it post again
    select count(*) + 1 into k from expenses where recurring_template_id = t.id;
    loop
      due := (t.expense_date + step * k)::date;
      exit when due > today or k > 400;
      insert into expenses (group_id, description, amount_cents, currency_code, category, expense_date,
        split_type, repeat_interval, recurring_template_id, notes, created_by)
      values (t.group_id, t.description, t.amount_cents, t.currency_code, t.category, due,
        t.split_type, 'none', t.id, t.notes, t.created_by)
      returning id into v_new;
      insert into expense_shares (expense_id, user_id, paid_share_cents, owed_share_cents)
        select v_new, user_id, paid_share_cents, owed_share_cents from expense_shares where expense_id = t.id;
      insert into expense_history (expense_id, changed_by, action, after)
        values (v_new, null, 'created', expense_snapshot(v_new));
      for s in select user_id, paid_share_cents, owed_share_cents from expense_shares where expense_id = v_new loop
        net := s.paid_share_cents - s.owed_share_cents;
        perform notify_user(s.user_id, null, 'expense_added',
          '"' || t.description || '" added automatically',
          'Repeats ' || t.repeat_interval || ' · ' ||
          case when net < 0 then 'you owe ' || fmt_money(-net, t.currency_code)
               when net > 0 then 'you get back ' || fmt_money(net, t.currency_code)
               else 'total ' || fmt_money(t.amount_cents, t.currency_code) end,
          jsonb_build_object('url', '/expense/' || v_new));
      end loop;
      posted := posted + 1;
      k := k + 1;
    end loop;
  end loop;
  return posted;
end;
$$;
-- idempotent and cheap: the app also calls it on open, as a fallback for
-- projects without pg_cron
grant execute on function post_recurring_expenses() to authenticated;

-- ============================================================
-- reminders
-- ============================================================
create or replace function send_payment_reminder(p_user uuid, p_amount_cents bigint, p_currency text default 'INR')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not shares_connection(p_user) then raise exception 'you can only remind your friends'; end if;
  -- one nudge per person per day
  if exists (select 1 from notifications where user_id = p_user and actor_user_id = auth.uid()
             and type = 'payment_reminder' and created_at > now() - interval '20 hours') then
    return jsonb_build_object('status', 'too_soon');
  end if;
  perform notify_user(p_user, auth.uid(), 'payment_reminder',
    user_name(auth.uid()) || ' sent you a reminder',
    'You owe them ' || fmt_money(greatest(p_amount_cents, 0), p_currency) || '. Tap to settle up.',
    jsonb_build_object('url', '/settle/' || auth.uid()));
  return jsonb_build_object('status', 'sent');
end;
$$;

-- Weekly nudge: everyone with an open balance hears about it once a week.
create or replace function send_weekly_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select u.id,
      coalesce((select sum(s.paid_share_cents - s.owed_share_cents) from expense_shares s
                join expenses e on e.id = s.expense_id where s.user_id = u.id and e.deleted_at is null), 0)
      + coalesce((select sum(amount_cents) from payments where from_user_id = u.id and status = 'confirmed'), 0)
      - coalesce((select sum(amount_cents) from payments where to_user_id = u.id and status = 'confirmed'), 0) as net
    from users u where not u.is_placeholder
  loop
    if r.net <= -100 then
      perform notify_user(r.id, null, 'payment_weekly', 'Weekly check-in: you owe ' || fmt_money((-r.net)::bigint, 'INR'),
        'Settle up with your friends to keep things square.', jsonb_build_object('url', '/'));
      n := n + 1;
    elsif r.net >= 100 then
      perform notify_user(r.id, null, 'payment_weekly', 'Weekly check-in: you are owed ' || fmt_money(r.net::bigint, 'INR'),
        'Send a friendly reminder from a friend''s page.', jsonb_build_object('url', '/'));
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function send_weekly_reminders() from public, anon, authenticated;

-- ============================================================
-- kitty
-- ============================================================
create or replace function enable_kitty(p_group_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_kitty uuid;
begin
  if not is_group_member(p_group_id) then raise exception 'not a member of this group'; end if;
  select u.id into v_kitty from users u join group_members gm on gm.user_id = u.id
    where gm.group_id = p_group_id and u.is_kitty limit 1;
  if v_kitty is not null then
    update group_members set left_at = null where group_id = p_group_id and user_id = v_kitty;
    return v_kitty;
  end if;
  insert into users (id, name, is_placeholder, is_kitty, invited_by)
    values (gen_random_uuid(), 'Kitty', true, true, auth.uid()) returning id into v_kitty;
  insert into group_members (group_id, user_id) values (p_group_id, v_kitty);
  return v_kitty;
end;
$$;

-- ============================================================
-- scheduled jobs (if pg_cron is enabled)
-- ============================================================
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available (%). Enable it under Database -> Extensions to schedule jobs.', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tabmate-recurring', '35 18 * * *', 'select public.post_recurring_expenses()');    -- 00:05 IST daily
    perform cron.schedule('tabmate-weekly-reminder', '30 4 * * 0', 'select public.send_weekly_reminders()'); -- Sun 10:00 IST
  end if;
end $$;

-- realtime for the new table
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'expense_history') then
    alter publication supabase_realtime add table public.expense_history;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'expense_items') then
    alter publication supabase_realtime add table public.expense_items;
  end if;
end $$;

-- make the API see the new functions/columns right away (avoids "not in the schema cache")
notify pgrst, 'reload schema';
