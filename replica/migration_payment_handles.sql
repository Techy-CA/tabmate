-- Adds payment-handle fields to users, for the one-tap pay link on Settle
-- Up. Safe to run on the existing database: just adds columns, no data loss.
alter table users add column if not exists upi_id text;
alter table users add column if not exists paypal_me_handle text;
alter table users add column if not exists venmo_username text;
