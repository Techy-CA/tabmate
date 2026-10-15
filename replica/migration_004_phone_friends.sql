-- Migration 004 — add friends by mobile number, and match phone contacts.
--
-- Run AFTER migration_003 in the Supabase SQL Editor. Safe to re-run.
--
--   * users.phone: optional, stored normalized as E.164 (+919876543210).
--     Numbers typed without a country code are treated as Indian (+91).
--   * add_friend(identifier): one entry point for "email or mobile number".
--   * friend_invites can now hold a phone number; whoever later sets that
--     number on their profile (at sign-up or in Account) is auto-friended
--     with everyone who invited it, and the inviters are notified.
--   * match_contacts(phones, emails): which of my phone contacts are already
--     on Tabmate — returns only id + name for matches, never anyone's
--     number or email back.
--
-- Note: numbers are not verified by SMS. Verifying them would need Supabase
-- phone auth with an SMS provider (Twilio, MessageBird, …).

-- ============================================================
-- normalization
-- ============================================================
create or replace function normalize_phone(p_raw text) returns text
language plpgsql immutable set search_path = public as $$
declare
  has_plus boolean := left(trim(coalesce(p_raw, '')), 1) = '+';
  digits text := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
begin
  if digits = '' then return null; end if;
  if has_plus then
    null;                                              -- already has a country code
  elsif left(digits, 2) = '00' then
    digits := substr(digits, 3);                       -- 00 international prefix
  elsif length(digits) = 10 then
    digits := '91' || digits;                          -- Indian mobile without code
  elsif length(digits) = 11 and left(digits, 1) = '0' then
    digits := '91' || substr(digits, 2);               -- 0-prefixed Indian number
  elsif length(digits) = 12 and left(digits, 2) = '91' then
    null;                                              -- 91XXXXXXXXXX
  else
    return null;                                       -- can't tell the country
  end if;
  if digits !~ '^[1-9][0-9]{7,14}$' then return null; end if;
  return '+' || digits;
end;
$$;

-- ============================================================
-- users.phone
-- ============================================================
alter table users add column if not exists phone text;
create unique index if not exists users_phone_key on users (phone) where phone is not null;

-- Normalize on every write, so a direct profile update can't store junk.
create or replace function users_normalize_phone() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.phone is not null and trim(new.phone) = '' then new.phone := null; end if;
  if new.phone is not null then
    new.phone := normalize_phone(new.phone);
    if new.phone is null then raise exception 'invalid phone number' using errcode = '22023'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists users_phone_normalize on users;
create trigger users_phone_normalize before insert or update of phone on users
  for each row execute function users_normalize_phone();

-- ============================================================
-- friend_invites: email or phone
-- ============================================================
alter table friend_invites alter column email drop not null;
alter table friend_invites add column if not exists phone text;
create unique index if not exists friend_invites_inviter_phone_key on friend_invites (inviter_id, phone) where phone is not null;
create index if not exists friend_invites_phone_idx on friend_invites (phone);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'friend_invites_target') then
    alter table friend_invites add constraint friend_invites_target check (email is not null or phone is not null);
  end if;
end $$;

-- Accept pending invites addressed to this user's email or phone. Called
-- when a user is created and whenever they set/change their phone.
create or replace function accept_pending_invites(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  u users;
  inv record;
begin
  select * into u from users where id = p_user;
  if u.id is null then return; end if;
  for inv in
    select * from friend_invites
    where accepted_at is null and inviter_id <> u.id
      and (email = lower(u.email) or (u.phone is not null and phone = u.phone))
  loop
    update friend_invites set accepted_at = now() where id = inv.id;
    insert into friendships (user_id_a, user_id_b)
    values (least(u.id, inv.inviter_id), greatest(u.id, inv.inviter_id))
    on conflict do nothing;
    if found then
      perform notify_user(inv.inviter_id, u.id, 'friend_joined',
        user_name(u.id) || ' joined Tabmate',
        'You invited them — you can now split expenses together.',
        jsonb_build_object('url', '/friend/' || u.id));
    end if;
  end loop;
end;
$$;
revoke execute on function accept_pending_invites(uuid) from public, anon, authenticated;

create or replace function users_accept_invites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform accept_pending_invites(new.id);
  return null;
end;
$$;
drop trigger if exists users_accept_invites_on_phone on users;
create trigger users_accept_invites_on_phone after update of phone on users
  for each row when (new.phone is not null and new.phone is distinct from old.phone)
  execute function users_accept_invites();

-- Sign-up: also take the phone from sign-up metadata. A number already
-- claimed by another account is dropped rather than failing the sign-up.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_phone text := normalize_phone(new.raw_user_meta_data->>'phone');
begin
  if v_phone is not null and exists (select 1 from users where phone = v_phone) then v_phone := null; end if;
  insert into public.users (id, name, email, avatar_url, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    v_phone
  );
  perform accept_pending_invites(new.id);
  return new;
end;
$$;

-- ============================================================
-- add_friend: email or mobile number
-- ============================================================
create or replace function add_friend(p_identifier text)
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
    select * into target from users where lower(email) = v_email;
  else
    v_phone := normalize_phone(v_raw);
    if v_phone is null then return jsonb_build_object('status', 'invalid'); end if;
    select * into target from users where phone = v_phone;
  end if;

  if target.id is null then
    if v_email is not null then
      insert into friend_invites (inviter_id, email) values (auth.uid(), v_email)
        on conflict (inviter_id, email) do nothing;
    else
      insert into friend_invites (inviter_id, phone) values (auth.uid(), v_phone)
        on conflict (inviter_id, phone) where phone is not null do nothing;
    end if;
    return jsonb_build_object('status', 'invited', 'email', v_email, 'phone', v_phone);
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

  -- Only id + name: looking someone up by number must not reveal their email.
  return jsonb_build_object(
    'status', case when n > 0 then 'added' else 'already' end,
    'user', jsonb_build_object('id', target.id, 'name', target.name)
  );
end;
$$;

-- kept for older app builds
create or replace function add_friend_by_email(p_email text)
returns jsonb language sql security definer set search_path = public as $$
  select add_friend(p_email);
$$;

-- ============================================================
-- match_contacts: which of my contacts are already on Tabmate
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
  where u.id <> auth.uid();
end;
$$;
