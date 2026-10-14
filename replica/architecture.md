# Architecture: Tabmate (working name) — a rebuild of Splitwise's core features

Ships as an Android APK first (per the brief), backed by a managed Postgres backend that a future
web or iOS client can reuse without changes.

## Stack

| layer | choice | why |
| --- | --- | --- |
| mobile | Expo (React Native) + TypeScript | one codebase, `eas build` produces an installable APK directly (and a Play Store AAB later) without touching native Android/iOS projects |
| styling | NativeWind (Tailwind for RN) + tokens from `/replica-design` | keeps the "our theme" work in one token file instead of scattered style objects |
| database | Postgres on Supabase | managed, free at low volume, gives auth + storage + realtime + row-level security + scheduled functions in one project — no separate services to wire together |
| ORM / migrations | Drizzle ORM | schema-as-TypeScript that matches `schema.sql` 1:1, typed query results in the Edge Functions, plain SQL migrations (no magic) |
| auth | Supabase Auth (email/password + Google OAuth) | matches the original's two sign-up paths (recon S02), issues the JWT that Postgres RLS reads directly — no separate auth server |
| access control | Postgres Row Level Security | the flat "any group member can edit/delete" model (recon source #9) is naturally a row-security policy, not app code scattered across routes |
| payments (settle up) | Razorpay Payment Links | UPI-first, matches India-market intent; a payment link routes money straight to the requester's own bank account — we never hold funds, so this stays a standard payment-gateway integration, not a money-transmitter license (see recon's "out of scope: Splitwise Pay") |
| payments (optional Pro tier, later) | Stripe Checkout + Billing | only needed if/when a paid tier ships (could-have, milestone 4) — kept separate from settle-up payments |
| email | Resend | invite emails, recurring-expense reminders; generous free tier |
| jobs / cron | Supabase Edge Functions + `pg_cron` | posts due recurring expenses, expires stale invite codes; no separate worker process to host |
| files | Supabase Storage | receipt photos, avatars, group cover photos |
| hosting | Supabase (backend) + EAS Build/Submit (mobile) | no web app to host for v1 — a marketing/landing page is a `/replica-launch` concern, not this one |

One Postgres database. No microservices. Business logic that must be atomic (an expense plus its
shares, a group plus its creator's membership) lives in Postgres functions called via RPC, not
split across multiple client round-trips.

## Schema

12 tables, 2 enums re-used as check constraints, 2 trigger-enforced invariants. Access rules:
**Postgres Row Level Security** on every table (policy sketch is commented per-table in the SQL;
full policy statements get written alongside the first migration in `/replica-backend`).

Full schema: [`replica/schema.sql`](schema.sql). Highlights:

- Money is always `bigint amount_cents` + a `char(3) currency_code` — never a float.
- `expenses.deleted_at` is a soft delete, because the recon map lists "restore a deleted expense"
  as a must-have (Splitwise's own help center documents this) — a hard `DELETE` would make that
  impossible.
- A deferred constraint trigger on `expense_shares` rejects any write where the per-person paid
  or owed amounts don't sum to the expense total — the "doesn't add up to 100%" error state from
  recon's S07 is enforced by the database, not trusted to the UI.
- `activity_items` is populated only by triggers on `expenses`, `payments`, `expense_comments`,
  and `group_members` — one place generates the feed, so no API route can forget to log an event.
- `friendships` has no separate "add friend" flow — a row is created automatically the first time
  two users share a non-group expense, matching how Splitwise actually behaves.

```sql
-- see replica/schema.sql for the full, commented migration
```

## API

Mobile talks to Supabase directly via the generated client (table reads/writes go straight
through RLS — no hand-written CRUD layer). Anything that must be atomic or calls a third party is
a Postgres RPC function or an Edge Function instead.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `auth.signUp` / `auth.signInWithOAuth` | create account (email or Google) | anyone | email+password or Google token | session JWT | F01 |
| `rpc create_group(name, cover_photo_url)` | creates group + adds caller as first member, atomically | authed user | name, photo | group row | F01 |
| `rpc create_group_invite(group_id)` | mints a 14-day invite code | group member | group_id | code | F01, F04 |
| `GET groups-preview?code=` (Edge Fn) | resolves a code to a group name/photo before joining, without exposing balances | anyone with the code | code | group preview | F04 |
| `rpc join_group(code)` | validates + consumes a code, adds caller to group_members | authed user | code | group row | F04 |
| `rpc create_expense(payload)` | inserts expenses + expense_shares (+ expense_items if itemized) in one transaction | group member or expense party | description, amount, splits[], repeat_interval | expense row | F01, F03 |
| `rpc update_expense(id, payload, propagate)` | edits an expense; `propagate=true` on a recurring instance updates future occurrences only, never past ones | group member or expense party | id, fields, propagate flag | expense row | F03 |
| table write `expenses.deleted_at` | soft-delete / restore | group member or expense party | — | — | S08 |
| table read `expense_comments` | list/insert comments | group member or expense party | body | comment row | S08 |
| `rpc get_group_balances(group_id)` | raw net balance per member (sum paid − sum owed) | group member | group_id | [{user_id, balance_cents}] | S05 |
| `rpc get_simplified_transfers(group_id)` (Edge Fn) | greedy min-transfer-count algorithm over the balances, per currency | group member | group_id | [{from, to, amount, currency}] | S05, "Simplify Debts" |
| `rpc create_payment(payload)` | records a manual payment, or creates a Razorpay payment link for `method=razorpay_link` | from_user or group member | to_user, amount, method | payment row (+ link URL) | F02 |
| webhook IN `POST /functions/v1/webhooks/razorpay` | marks a payment `confirmed`/`failed` when Razorpay reports it | Razorpay only (signature-verified) | Razorpay event payload | 200 OK | F02 |
| `rpc get_activity_feed(group_id\|null, cursor)` | paginated activity list | group member (or caller, for non-group) | cursor | activity rows | S11 |
| `GET export-csv?group_id=` (Edge Fn, should-have) | streams expense history as CSV | group member | group_id, date range | CSV file | should-have |
| `POST receipts-ocr` (Edge Fn, could-have) | uploads a photo, returns detected line items | authed user | image | item[] | S16 |

Webhooks in: Razorpay (payment link paid/failed/expired).
Webhooks out: none for v1 (no partner integrations — see recon's out-of-scope list).
Jobs: `post_recurring_expenses` — `pg_cron`, daily at 00:05 local per group's creator timezone,
finds `expenses` rows with `repeat_interval <> 'none'` due today and inserts the next instance
(skips any member who has `left_at` set, per recon's F03 edge case). `expire_stale_invites` —
`pg_cron`, hourly, deletes `group_invites` past `expires_at`.

## The parts that bite

- **Time zones**: `expense_date` is a plain `date` (no time), matching how Splitwise shows
  day-level dates. Recurring-expense posting must compute "due today" in the *group creator's*
  timezone (stored on `users.timezone`, default `Asia/Kolkata`), not server UTC — otherwise a
  rent expense posts a day early or late for users east/west of UTC.
- **Idempotency**: the Razorpay webhook can arrive more than once or out of order. Guarded by a
  unique constraint on `payments.razorpay_payment_link_id` plus a status-transition check in
  `create_payment`/the webhook handler (never move a `confirmed` payment back to `pending`), and
  the webhook signature is verified before anything is written.
- **Races**: two members tapping "Settle up" on the same balance at once, or an expense being
  edited while someone is mid-split. `create_expense`/`update_expense`/`create_payment` all run
  inside a single transaction; `get_simplified_transfers` reads inside that same transaction's
  snapshot rather than being cached, so it can never suggest a transfer against a balance that
  just changed underneath it.
- **Offline (could-have)**: the Expo app may queue expense *creates* locally and replay them on
  reconnect, but must not allow offline *edits* to a share another member may have touched —
  last-write-wins is unsafe for money, so offline support is additive-only by design.
- **Rate limits**: the group-invite code (6–8 chars) must be rate-limited on `groups-preview` and
  `join_group` or it's brute-forceable; a failed-attempt counter per IP via Supabase Edge
  middleware covers this cheaply.
- **GDPR-style deletion**: a user who leaves can never be hard-deleted while they're a party to
  any `expense_shares` or `payments` row — doing so would corrupt every other member's balance
  history. Account deletion anonymizes (`name = 'Deleted user'`, `email` nulled, auth row removed)
  instead of cascading a real delete.
- **Search (should-have)**: expense search is a simple `ilike` on `description`/`category` at this
  scale (tens of thousands of rows per user, not millions) — a dedicated search index is
  over-engineering for v1.

## Build order

1. **Vertical slice** — sign up, create a group, add one equally-split expense, see the balance.
   Screens: S02, S03, S04 (create-group only), S06 (equal split only), S05.
   Tables: `users`, `groups`, `group_members`, `expenses`, `expense_shares`.
   Routes: Supabase Auth, `create_group`, `create_expense`, `get_group_balances`.
   This alone proves the stack: auth → RLS → atomic multi-table write → balance read.
2. **Must-haves** (`features.csv`, 17 rows): full split-type picker (S07: exact/%/shares/
   adjustment/itemized), edit/delete + restore an expense (S08), friend view (S10), invite + join
   a group (S17), manual settle-up (S09), Simplify Debts (`get_simplified_transfers`). "Unlimited
   free expense entry" needs no code — it's the *absence* of a usage-cap check that Splitwise
   added later (recon F05); just never build one.
3. **Should-haves**: recurring expenses + the `pg_cron` job (S06 repeat picker), multi-currency,
   itemized manual entry, comments (S08), activity feed + triggers (S11), Razorpay settle-up
   (S09 upgrade), avatars/cover photos via Storage, Totals screen (S14), expense search.
4. **Could-haves**: receipt OCR (S16), spending charts (S15), CSV/JSON export, offline queue, dark
   mode, and — only if monetization is wanted — an optional Stripe-billed Pro tier for the
   could-have features, never for anything in the must-have list.
5. **Fixes from `/replica-entrepreneur`** — not yet run; re-prioritize this list once it has.
