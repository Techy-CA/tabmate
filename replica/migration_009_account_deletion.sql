-- Migration 009 — in-app account deletion (required by Google Play for
-- any app with accounts).
--
-- Run AFTER migration_008 in the Supabase SQL Editor. Safe to re-run.
--
-- Shared history can't be hard-deleted: other people's balances depend on
-- the expenses and payments you were part of. So deletion removes the
-- login and every piece of personal data, and keeps an anonymous
-- "Deleted user" in the shared records:
--   * auth login deleted (can't sign in again; the email can sign up fresh)
--   * name -> "Deleted user"; email, phone, avatar, UPI/PayPal/Venmo cleared
--   * push tokens, notifications, pending invites, friendships removed
--   * left every group (expenses/payments stay so balances remain correct)

create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;

  delete from push_tokens where user_id = v_me;
  delete from notifications where user_id = v_me;
  delete from friend_invites where inviter_id = v_me;
  delete from invite_attempts where user_id = v_me;
  delete from friendships where v_me in (user_id_a, user_id_b);
  update group_members set left_at = coalesce(left_at, now()) where user_id = v_me;

  update users set
    name = 'Deleted user',
    email = null,
    phone = null,
    avatar_url = null,
    upi_id = null,
    paypal_me_handle = null,
    venmo_username = null,
    notification_prefs = '{"push": false, "expense": false, "payment": false, "comment": false, "group": false, "friend": false}'::jsonb,
    -- a pending-style record that can never be claimed (no email/phone)
    is_placeholder = true,
    updated_at = now()
  where id = v_me;

  -- the login itself; public.users no longer references auth.users (005)
  delete from auth.users where id = v_me;
end;
$$;
revoke execute on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
