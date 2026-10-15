-- Migration 007 — mobile numbers without OTP (product decision: no SMS cost).
--
-- Run AFTER migration_005 in the Supabase SQL Editor — works whether or not
-- migration_006 (OTP) was run. Safe to re-run.
--
-- Numbers are saved as typed (normalized), at sign-up or in Account, and are
-- used immediately: friends find you by them, contacts match them, and a
-- pending (invited) person with that number is handed over to you.
--
-- Known trade-off: nothing proves the number is yours. To keep that
-- visible, whoever invited a pending person is notified when someone takes
-- it over ("X joined Tabmate and took over 'Chinmay'").

-- undo 006's OTP-only rules (no-ops if 006 never ran)
drop trigger if exists on_auth_user_phone_verified on auth.users;
grant update (phone) on users to authenticated;

-- ============================================================
-- merge (005) + tell the inviter who took the pending person over
-- ============================================================
create or replace function merge_placeholder(p_ph uuid, p_real uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  ph users;
begin
  select * into ph from users where id = p_ph and is_placeholder;
  if p_ph = p_real or ph.id is null then return; end if;

  update group_members gm set left_at = null
    where gm.user_id = p_real and gm.left_at is not null
      and exists (select 1 from group_members x where x.group_id = gm.group_id and x.user_id = p_ph and x.left_at is null);
  update group_members set user_id = p_real
    where user_id = p_ph and group_id not in (select group_id from group_members where user_id = p_real);
  delete from group_members where user_id = p_ph;

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
  delete from payments where p_ph in (from_user_id, to_user_id);

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
  delete from notifications n using notifications m
    where n.user_id = p_real and m.user_id = p_real and n.id <> m.id
      and n.type = m.type and n.title = m.title and n.data = m.data
      and (n.created_at, n.id) > (m.created_at, m.id);
  update friend_invites set inviter_id = p_real where inviter_id = p_ph;
  update users set invited_by = p_real where invited_by = p_ph;

  delete from users where id = p_ph;

  if ph.invited_by is not null and ph.invited_by <> p_real then
    perform notify_user(ph.invited_by, p_real, 'friend_joined',
      user_name(p_real) || ' joined Tabmate',
      'They took over "' || ph.name || '" — your shared groups and expenses are with them now.',
      jsonb_build_object('url', '/friend/' || p_real));
  end if;
end;
$$;
revoke execute on function merge_placeholder(uuid, uuid) from public, anon, authenticated;

-- ============================================================
-- phone set in Account -> claim a pending person with that number
-- ============================================================
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

-- ============================================================
-- sign-up: optional number from the form; claim by email or number
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
  update users set email = null, phone = null where id = any(coalesce(v_ph, '{}'));

  -- a number another real account already has is dropped, not an error
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
  perform accept_pending_invites(new.id);
  return new;
end;
$$;
