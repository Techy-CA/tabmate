# Parity report: Splitsy vs Splitwise

Date: 2026-10-14 (revised after a second `/replica-test` pass)  Source: `replica/features.csv` (34 rows, 28 scored)
Generator: `python3 ~/.claude/skills/replica-diff/parity.py replica/features.csv --markdown`

## Parity: 75.0 / 100

features 75.0 (28 counted, must-haves 14 of 16 done)

**Not shippable yet: 2 must-have features are not done** — and both are
the same kind of gap: Google OAuth sign-up and password reset are fake
stubs, because both genuinely require a real backend (`/replica-backend`),
not more click-testing. Every must-have that *could* be verified without
external credentials now has been — up from 6/16 at the first pass of this
report to 14/16 now, after two `/replica-test` rounds that found and fixed
8 real bugs (see `replica/bugs.md`).

## By area, weakest first

| area | score | features |
| --- | --- | --- |
| personalization | 0.0 | 1 |
| data | 0.0 | 1 |
| analytics | 33.3 | 2 |
| onboarding | 50.0 | 2 |
| notifications | 50.0 | 1 |
| expenses | 77.8 | 15 |
| groups | 100.0 | 3 |
| balances | 100.0 | 2 |
| payments | 100.0 | 1 |

**groups, balances, and payments are now all at 100%** — every must-have in
those three areas is built, click-tested, and has e2e regression coverage.
**personalization and data are still 0%** (avatar photos, CSV export — not
built, not scored as bugs). **onboarding is stuck at 50%** specifically
because both its gaps need real backend infrastructure this session doesn't
have credentials for.

## Missing, in build order

**Must-haves (both need `/replica-backend`, not more testing):**
1. Sign up with email or Google — Google OAuth stub
2. Log in / log out / password reset — password reset not wired

**Should-haves:**
- Totals screen date-range filter — analytics
- Multi-currency UI (data model already supports it) — expenses
- Recurring-expense scheduled posting (needs replica-backend) — expenses
- Activity feed click-through + push notifications — notifications
- Custom avatars / cover photos — personalization
- Itemized split (item-assignment UI not built) — expenses
- Expense search — expenses

**Could-haves (not built, as planned in architecture.md's build order):**
- Spending-by-category charts
- CSV/JSON export
- Offline entry with background sync
- Receipt photo OCR + auto-itemization

## Left out on purpose (not scored)

- **Splitwise Pay** (bank-linked debit card) — requires money-transmitter
  licensing, cannot clone.
- **Venmo/PayPal direct partner integration** — their specific partner deal.
  We built our own UPI/Razorpay-link equivalent instead (see "yours" below).
- **Existing Splitwise user network** — a network effect, not a feature.

## Yours, not in the original (not scored, but real work)

- **In-app settle-up payment via UPI/Razorpay** — our own localized
  equivalent of the original's PayPal/Venmo/Splitwise Pay.
- **Dark mode** — tokens exist, not yet wired into theme switching.
- **Unlimited free expense entry** — the fix for Splitwise's
  most-complained-about behavior (recon.md F05). Verified by reading the
  code and by adding many expenses live across two sessions with no
  interstitial ever appearing.

## Layout diff — still skipped

Unchanged from the first pass of this report: needs same-viewport PNG
screenshots of both apps in matching states, which this session doesn't
have. Queued as follow-up, not faked.

## Behavior diff (expanded from this pass's click-through)

| flow | original | clone | fix or keep |
| --- | --- | --- | --- |
| Settle up | pay back or record you've been paid, both directions | now matches (was BUG-005) | keep |
| Debt simplification | reroutes live as balances change | matches — verified both the partial-settle reroute and the member-removal reroute by hand | keep |
| Removing a group member | — | historical debt is never erased from the ledger, only the Home-screen "Friends" shortcut disappears for that person | keep, documented as a minor known gap |
| Free-tier expense cap | recent versions cap free users (recon.md's top user complaint) | no cap, anywhere, confirmed by adding expenses repeatedly with no interstitial | keep — the deliberate differentiator |
| Editing an expense | — | reopens as an exact-amounts split prefilled with current shares, regardless of original split type (a deliberate simplification — the original ratio inputs can't be reconstructed from a stored total) | keep, documented |
| Invite a group member | native share sheet | on-screen code shown always, share sheet attempted best-effort (was BUG-007 — Share crashed with zero feedback on web) | keep — arguably better UX, code is readable/shareable any way the user likes |

## Verdict: **not shippable yet, but close**

Zero open S1 or S2 bugs — all 8 found across two test passes are fixed with
regression coverage (21/21 e2e passing). 14 of 16 must-haves fully verified.
The only blocker is backend-dependent auth (Google OAuth, password reset),
which is a `/replica-backend` task, not a testing gap.

**To reach shippable:** run `/replica-backend` to wire up real Supabase
Auth — that closes the last 2 must-haves and should push the score past 80
on its own, assuming nothing new breaks. The should/could-have gaps don't
block shippability, only "better than the original."

## Top 5 to build/verify next

1. `/replica-backend` — real Supabase Auth closes the last 2 must-haves.
2. Click-test S11 (activity feed), S13 (account settings), S14 (totals) —
   built, not yet verified this pass.
3. Run an axe accessibility scan across all screens (not done yet).
4. Build the itemized-split item-assignment UI (currently correctly hidden,
   not broken, but it's a real should-have gap).
5. Capture real screenshot pairs (original + clone, same viewport, same
   state) and run the layout diff this report has skipped twice now.
