-- Migration 003 — settle-ups recorded outside a group now settle the groups.
--
-- Run AFTER migration_002 in the Supabase SQL Editor. Safe to re-run.
--
-- The bug: A pays B ₹800 for dinner in a group (B owes A ₹400). B then
-- settles ₹300 from B's friend screen. That payment was stored with
-- group_id = null, so the friend balance showed ₹100 but the group still
-- showed ₹400 — two different answers to "how much does B owe A".
--
-- The fix: a payment recorded without a group is allocated across the
-- contexts where the two people actually owe each other — non-group
-- expenses first, then each shared group (largest debt first, capped so no
-- group is over-settled). Anything left over (an advance) stays non-group.
-- Each piece is a normal payment row in its context, linked by batch_id so
-- the pieces cancel and notify as one payment.
--
-- Existing non-group payments are re-allocated the same way, so data
-- recorded before this fix becomes consistent too.

alter table payments add column if not exists batch_id uuid;
create index if not exists payments_batch_idx on payments (batch_id);

-- How much p_from owes p_to in each context (group_id null = non-group),
-- from expenses and payments between just these two people. Positive = p_from
-- owes p_to. For multi-payer expenses each person's share is owed to the
-- payers in proportion to what they paid.
create or replace function pair_context_debts(p_from uuid, p_to uuid, p_currency text, p_exclude uuid default null)
returns table (group_id uuid, debt_cents bigint)
language sql stable security definer set search_path = public as $$
  with exp as (
    select e.group_id,
           (sf.owed_share_cents::numeric * st.paid_share_cents
            - st.owed_share_cents::numeric * sf.paid_share_cents) / e.amount_cents as d
    from expenses e
    join expense_shares sf on sf.expense_id = e.id and sf.user_id = p_from
    join expense_shares st on st.expense_id = e.id and st.user_id = p_to
    where e.deleted_at is null and e.currency_code = p_currency
  ),
  pay as (
    select p.group_id,
           (case when p.from_user_id = p_from then -p.amount_cents else p.amount_cents end)::numeric as d
    from payments p
    where p.status = 'confirmed' and p.currency_code = p_currency
      and ((p.from_user_id = p_from and p.to_user_id = p_to) or (p.from_user_id = p_to and p.to_user_id = p_from))
      and (p_exclude is null or p.id <> p_exclude)
  )
  select x.group_id, round(sum(x.d))::bigint
  from (select * from exp union all select * from pay) x
  group by x.group_id;
$$;
revoke execute on function pair_context_debts(uuid, uuid, text, uuid) from public, anon, authenticated;

-- A member's net position in a group (positive = the group owes them).
create or replace function group_net(p_group uuid, p_user uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(s.paid_share_cents - s.owed_share_cents)
                   from expense_shares s join expenses e on e.id = s.expense_id
                   where e.group_id = p_group and e.deleted_at is null and s.user_id = p_user), 0)
       + coalesce((select sum(case when from_user_id = p_user then amount_cents else -amount_cents end)
                   from payments
                   where group_id = p_group and status = 'confirmed' and p_user in (from_user_id, to_user_id)), 0);
$$;
revoke execute on function group_net(uuid, uuid) from public, anon, authenticated;

-- Where a non-group payment of p_amount from p_from to p_to should land.
create or replace function plan_payment_allocation(
  p_from uuid, p_to uuid, p_amount bigint, p_currency text, p_exclude uuid default null
) returns table (group_id uuid, amount_cents bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  remaining bigint := p_amount;
  nongroup_amount bigint;
  r record;
  cap bigint;
  take bigint;
begin
  -- 1. non-group expenses between the two
  select greatest(coalesce(max(d.debt_cents) filter (where d.group_id is null), 0), 0)
    into nongroup_amount
    from pair_context_debts(p_from, p_to, p_currency, p_exclude) d;
  nongroup_amount := least(remaining, nongroup_amount);
  remaining := remaining - nongroup_amount;

  -- 2. shared groups, largest debt first
  for r in
    select d.group_id as gid, d.debt_cents as debt
    from pair_context_debts(p_from, p_to, p_currency, p_exclude) d
    join groups g on g.id = d.group_id
    where d.group_id is not null and d.debt_cents > 0 and g.deleted_at is null
    order by d.debt_cents desc, g.created_at
  loop
    exit when remaining <= 0;
    -- Never push either person past zero in the group: with Simplify Debts
    -- a pairwise debt can be larger than what they owe the group overall.
    cap := least(r.debt, -group_net(r.gid, p_from), group_net(r.gid, p_to));
    continue when cap <= 0;
    take := least(remaining, cap);
    group_id := r.gid;
    amount_cents := take;
    return next;
    remaining := remaining - take;
  end loop;

  -- 3. non-group debt + any advance beyond what's owed anywhere
  if nongroup_amount + remaining > 0 then
    group_id := null;
    amount_cents := nongroup_amount + remaining;
    return next;
  end if;
end;
$$;
revoke execute on function plan_payment_allocation(uuid, uuid, bigint, text, uuid) from public, anon, authenticated;

create or replace function create_payment(p_group_id uuid, p_from_user_id uuid, p_to_user_id uuid, p_amount_cents bigint, p_currency_code text default 'INR')
returns payments language plpgsql security definer set search_path = public as $$
declare
  p payments;
  gs uuid[];
  amts bigint[];
  n int;
  i int;
  v_batch uuid := gen_random_uuid();
begin
  if auth.uid() is null or auth.uid() not in (p_from_user_id, p_to_user_id) then raise exception 'not a party to this payment'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'amount must be greater than zero'; end if;
  if p_group_id is not null and not is_group_member(p_group_id) then raise exception 'not a member of this group'; end if;
  if not shares_connection(case when auth.uid() = p_from_user_id then p_to_user_id else p_from_user_id end) then
    raise exception 'you can only record payments with your friends';
  end if;

  if p_group_id is not null then
    insert into payments (group_id, from_user_id, to_user_id, amount_cents, currency_code)
    values (p_group_id, p_from_user_id, p_to_user_id, p_amount_cents, p_currency_code)
    returning * into p;
    return p;
  end if;

  select array_agg(a.group_id order by a.amount_cents), array_agg(a.amount_cents order by a.amount_cents)
    into gs, amts
    from plan_payment_allocation(p_from_user_id, p_to_user_id, p_amount_cents, p_currency_code) a;
  n := array_length(amts, 1);

  -- Smaller pieces first; the largest piece is inserted last with
  -- id = batch_id, so its notification trigger sees the whole batch.
  for i in 1 .. n - 1 loop
    insert into payments (group_id, from_user_id, to_user_id, amount_cents, currency_code, batch_id)
    values (gs[i], p_from_user_id, p_to_user_id, amts[i], p_currency_code, v_batch);
  end loop;
  insert into payments (id, group_id, from_user_id, to_user_id, amount_cents, currency_code, batch_id)
  values (v_batch, gs[n], p_from_user_id, p_to_user_id, amts[n], p_currency_code, case when n > 1 then v_batch end)
  returning * into p;
  return p;
end;
$$;

-- Cancelling any piece cancels the whole payment.
create or replace function cancel_payment(p_id uuid)
returns payments language plpgsql security definer set search_path = public as $$
declare p payments; v_batch uuid;
begin
  select coalesce(batch_id, id) into v_batch from payments
    where id = p_id and auth.uid() in (from_user_id, to_user_id);
  if v_batch is null then raise exception 'payment not found or not yours to cancel'; end if;
  update payments set status = 'cancelled'
    where (id = v_batch or batch_id = v_batch) and status <> 'cancelled';
  select * into p from payments where id = p_id;
  return p;
end;
$$;

-- One notification per payment, not per piece, with the full amount.
create or replace function notify_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(auth.uid(), new.from_user_id);
  other uuid := case when actor = new.from_user_id then new.to_user_id else new.from_user_id end;
  total bigint;
  amt text;
begin
  if new.batch_id is not null and new.batch_id <> new.id then return null; end if;
  select coalesce(sum(amount_cents), new.amount_cents) into total
    from payments where id = new.id or batch_id = new.id;
  amt := fmt_money(total, new.currency_code);

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

-- ============================================================
-- one-time: re-allocate payments recorded before this fix
-- ============================================================
do $$
declare
  p record;
  gs uuid[];
  amts bigint[];
  n int;
  i int;
begin
  for p in
    select * from payments
    where group_id is null and batch_id is null and status = 'confirmed'
    order by created_at
  loop
    select array_agg(a.group_id order by a.amount_cents), array_agg(a.amount_cents order by a.amount_cents)
      into gs, amts
      from plan_payment_allocation(p.from_user_id, p.to_user_id, p.amount_cents, p.currency_code, p.id) a;
    n := coalesce(array_length(amts, 1), 0);
    continue when n = 0 or (n = 1 and gs[1] is null);

    update payments
      set group_id = gs[n], amount_cents = amts[n], batch_id = case when n > 1 then p.id end
      where id = p.id;
    update activity_items set group_id = gs[n]
      where ref_id = p.id and type = 'payment_recorded';
    for i in 1 .. n - 1 loop
      insert into payments (group_id, from_user_id, to_user_id, amount_cents, currency_code, status, created_at, batch_id)
      values (gs[i], p.from_user_id, p.to_user_id, amts[i], p.currency_code, 'confirmed', p.created_at, p.id);
    end loop;
  end loop;
end $$;
