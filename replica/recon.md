# Recon map: Splitwise (Android app, web reference)

Scope: the core expense-splitting loop — groups, friendships, adding/splitting expenses, balances, settle up, activity feed, recurring expenses, multi-currency. Receipt scanning/OCR, charts and CSV export (Splitwise's paid "Pro" tier) are in scope as should-have, since the goal is to beat the original's free-tier experience, not just match it.
For: the user's own branded Android app ("our name, our theme, our UI/UX, the best") — assumed general consumer audience (roommates, trips, friends, family), India-aware given UPI is a natural settle-up substitute for Venmo/PayPal. Confirm brand direction in `/replica-brand`.
Date: 2026-10-14

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site | https://www.splitwise.com/ | homepage pitch, nav, footer links |
| 2 | Pro feature page | https://www.splitwise.com/pro | paid-tier feature list |
| 3 | help center | https://kb.splitwise.com/ | 7 categories, best feature source |
| 4 | help article | https://kb.splitwise.com/getting-started/how-do-i-use-splitwise | the core loop, in Splitwise's own words |
| 5 | help article | https://kb.splitwise.com/balances-and-expenses/what-are-different-ways-i-can-split-an-expense | all 7 split types |
| 6 | help article | https://kb.splitwise.com/balances-and-expenses/what-is-simplify-debts | debt-simplification algorithm description |
| 7 | help article | https://kb.splitwise.com/balances-and-expenses/how-can-i-manage-recurring-expenses | recurrence rules |
| 8 | help article | https://kb.splitwise.com/groups/how-do-i-create-a-group | group creation flow |
| 9 | help article | https://kb.splitwise.com/groups/can-i-prevent-group-members-from-changing-expenses-or-set-permissions | flat access model (no group admins) |
| 10 | help category | https://kb.splitwise.com/payment-integrations | settle-up payment rails (PayPal/Venmo/Splitwise Pay) |
| 11 | Google Play listing | https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile | full feature bullet list, 10M+ downloads, 4.3★, screenshots |
| 12 | Google Play reviews | (same listing) | real complaints: free tier recently capped at a small number of expenses/day, aggressive upsell |
| 13 | public API docs | https://dev.splitwise.com/ | entities: users, groups, friends, expenses, comments, notifications (read for data model only — no code copied) |
| 14 | web app (unauthenticated) | https://www.splitwise.com/signup | signup form shape, brand colors |

## Core loop

Add a shared expense (who paid, how it's split) → everyone's balance updates automatically → settle up when ready.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Welcome / splash | app first open | pitch + sign up or log in | logo, CTA buttons | empty |
| S02 | Sign up | /signup | create account via email or Google | name field, email/password, Google OAuth button | empty, error (dup email) |
| S03 | Log in | /login | returning user auth | email/password, Google OAuth, forgot-password link | empty, error |
| S04 | Home (Groups + Friends tabs) | bottom nav | list all groups and 1:1 friendships with running balance | group card w/ cover photo, friend row w/ avatar + balance chip, FAB | empty (no groups yet), filled |
| S05 | Group detail | tap a group | expenses feed + each member's balance in that group | expense row list, balance summary bar, settle-up button, gear icon | empty, filled, settled |
| S06 | Add expense | FAB / "Add expense" | capture a new shared cost | description, amount, date/repeat picker, paid-by selector, split-type row, category icon | empty, prefilled (editing) |
| S07 | Split options sheet | tap "equally" inside add-expense | choose equal / exact / % / shares / adjustment / itemized | segmented control, per-person input rows, live remainder total | default (equal), unequal, error (doesn't add up to 100%) |
| S08 | Expense detail | tap an expense row | see full breakdown, comments, edit history | per-person paid/owed lines, comment thread, receipt thumbnail, edit/delete | filled, deleted (restorable) |
| S09 | Settle up | "Settle up" button | record or send a payment | amount, payer/payee, payment method picker (manual, UPI/PayPal/Venmo) | pending, confirmed, failed |
| S10 | Friend detail | tap a friend row | balance + shared expense history with one person, across all groups | balance header, expense list, settle-up CTA | settled up, owes, owed |
| S11 | Activity feed | bottom nav | chronological log of expenses/payments/comments/group changes | activity row w/ icon + timestamp | empty, filled |
| S12 | Group settings | gear icon on S05 | rename group, cover photo, members, invite link, simplify-debts toggle, leave/delete group | toggle row, member list w/ remove, invite-link share sheet | default |
| S13 | Account settings | profile menu | name/photo, default currency, notification prefs, security, log out | form rows, toggle list | default |
| S14 | Totals | calendar/totals icon on S05 | spending breakdown for a group over time | bar/line summary, date range picker | empty, filled |
| S15 | Charts & categories (Pro) | from S14 or account | spending by category, trend over time | pie/bar chart, category legend | locked (non-Pro), filled |
| S16 | Receipt scan (Pro) | camera icon on S06 | OCR a photo of a bill into itemized split | camera capture, detected line-items list, assign-to-person per item | scanning, detected, manual-correct |
| S17 | Join group | invite link / code entry | accept an invite and land in the group | code input or deep link, group preview, join button | valid code, expired/invalid |
| S18 | Paywall / upgrade | triggered on limited-tier cap | convert free user to paid | feature comparison, price, CTA | - |

## Flows

```
F01 New user creates a group and logs the first expense
    S01 -> S02 -> S04 (create group) -> S12 (invite members) -> S06 -> S07 -> S05 (balances update)
    happy path clicks: ~7
    edge: invited friend has no account yet (pending invite), member added twice, offline entry syncs later

F02 Settle up with a friend
    S10 -> S09 -> pick payment method -> confirmation
    edge: partial payment, payment provider fails/pending, Simplify Debts reroutes who gets paid

F03 Add a recurring bill (e.g. monthly rent)
    S06 -> set repeat interval (weekly/fortnightly/monthly/yearly) -> confirmation
    edge: editing the latest instance changes future amount but not past ones; removing a member stops the recurrence

F04 Join an existing group via invite link
    S17 -> S02 or S03 (if not logged in) -> S05 (balance now visible)
    edge: already a member, expired/invalid link

F05 Free-tier user hits a usage limit
    S06 -> S18 (paywall) -> subscribe or dismiss and keep using a degraded free tier
    edge: THIS is the original's most-complained-about flow (see reviews) — our clone should not gate core expense entry this way
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Bottom nav bar | Groups/Friends, Activity, Account (3-4 tabs) | active/inactive | all |
| FAB "Add expense" | primary | default, pressed | S04, S05 |
| Balance chip | owed-to-you (green), you-owe (red), settled (grey) | default | S04, S05, S10 |
| Group/friend row | with cover photo, with avatar | unread-activity badge | S04 |
| Expense row | with/without receipt thumbnail, recurring icon | default | S05, S08 |
| Avatar | photo, initials fallback | default | all over |
| Split-type segmented control | equally, exact, %, shares, adjustment, itemized | selected/unselected, error | S07 |
| Amount input | currency-aware | empty, filled, error | S06, S07, S09 |
| Settle-up method picker | manual / in-app payment | default, processing | S09 |
| Toggle row (settings) | e.g. Simplify Debts | on/off | S12, S13 |
| Bottom sheet / modal | split options, payment method | open/closed | S06, S09 |
| Toast / snackbar | undo delete, payment sent | transient | global |
| Empty state illustration | no groups, no expenses, settled up | - | S04, S05, S11 |
| Paywall card | feature comparison | locked vs unlocked | S15, S16, S18 |

## Inferred data model

```
User        id, name, email, avatar_url, default_currency, locale
            evidence: signup form (S02), account settings (S13), API docs "Users"
            confidence: high

Group       id, name, cover_photo_url, simplify_debts (bool), created_at
            evidence: S05/S12, help article "What is Simplify Debts?", API docs "Groups"
            confidence: high

GroupMembership   user_id, group_id, joined_at
            evidence: invite/join flow (S17), "no group admins" help article
            confidence: high — explicitly flat, no role/permission field

Friendship  user_id, friend_id, created_at
            evidence: S10, Play Store description ("private friendships")
            confidence: medium

Expense     id, group_id (nullable for non-group), description, cost, currency_code,
            date, category, paid_by (one or more users), split_type
            (equal|exact|percentage|shares|adjustment|itemized), repeat_interval
            (none|weekly|fortnightly|monthly|yearly), receipt_url, created_by, deleted_at
            evidence: S06/S07/S08, help articles on split types and recurring expenses, API docs "Expenses"
            confidence: high

ExpenseShare   expense_id, user_id, paid_share, owed_share
            evidence: S07 per-person split rows, "by exact/percentage/shares/adjustment" help article
            confidence: high

ExpenseItem (itemized split)   expense_id, name, amount, assigned_user_ids, is_tax/is_tip/is_discount
            evidence: "Itemized" split option, receipt-scanning Pro feature
            confidence: medium

Comment     id, expense_id, user_id, body, created_at
            evidence: S08 ("Comment directly on expenses" — Play Store description)
            confidence: medium

Payment (Settlement)   id, from_user_id, to_user_id, group_id (nullable), amount,
            currency_code, method (manual|upi|paypal|venmo), status (pending|confirmed|failed), created_at
            evidence: S09, "How do I send money?" help article
            confidence: medium — method set is our localization choice, not copied 1:1

ActivityItem   id, user_id, type (expense_added|payment|comment|group_changed), ref_id, created_at
            evidence: S11, "Recent Activity" mentioned in permissions help article
            confidence: medium
```

Relationships: User 1-n GroupMembership n-1 Group; Group 1-n Expense; Expense 1-n ExpenseShare n-1 User; Expense 1-n Comment; Expense 1-n ExpenseItem (when itemized); User 1-n Friendship n-1 User; Group/User 1-n Payment; User 1-n ActivityItem.

## Feature matrix

See `features.csv`. Must: 17, should: 9, could: 5, skip: 3.

## Out of scope (cannot or should not be cloned)

- **Splitwise Pay** — a bank-linked debit card + money transmission product run through a chartered bank (Coastal Community Bank per their privacy footer). Requires money-transmitter licensing; not something a clone can legally replicate. Substitute: integrate UPI / a standard payment gateway for "record as paid," not a native wallet.
- **Venmo/PayPal partner integrations** — these are Splitwise's specific partner deals (OAuth'd third-party apps). We can offer our own settle-up payment integration (UPI, Razorpay, Stripe, etc.) but not literally plug into Venmo/PayPal as if we were Splitwise.
- **The Splitwise social graph / existing user base** — 10M+ installed users and their friend networks are the product's network effect, not a buildable feature. A new app starts at zero network.
- **Brand assets** — the name "Splitwise," its wordmark/logo, the triangle mark, and its exact color values are the original's IP; recon screenshots are reference only and are never shipped (see `/replica-brand` for a clean rebrand).

## Size

Screens: 18. Flows: 5 (+ sub-edges). Entities: 9.
Hard parts: the debt-simplification algorithm (min-cost payment-path optimization across a balance graph, with multi-currency kept separate), recurring-expense scheduling, the 7-way split-type UI with live validation, receipt OCR/itemization, and offline-first entry with background sync.
Size: **M** (a few weeks) for the must-have core loop as a solo/small-team build; **L** if should-haves (receipt OCR, charts, in-app payments) ship in the same release.
