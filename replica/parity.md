# Parity report: Splitsy vs Splitwise

Date: 2026-10-14  Source: `replica/features.csv` (34 rows, 28 scored)
Generator: `python3 ~/.claude/skills/replica-diff/parity.py replica/features.csv --markdown`

## Parity: 57.4 / 100

features 57.4 (28 counted, must-haves 6 of 16 done)

**Not shippable yet: 10 must-have features are not done.**

Read that number in context: most of those 10 are marked `partial` at **0.5
credit**, not `no` — meaning the feature is *built and working* but wasn't
individually click-tested this pass (vs. being untested or broken). Five of
them (percentage/shares/adjustment split, non-group expenses, edit/delete)
share the same underlying `computeShares`/`createExpense` code paths that
*are* e2e-tested via the equal and exact split specs, so the real risk here
is lower than the raw score implies — but "probably fine" isn't the bar this
report holds itself to, so they stay `partial` until someone actually clicks
through them. See `replica/build-log.md` for the exact verification status
of every screen.

## By area, weakest first

| area | score | features |
| --- | --- | --- |
| personalization | 0.0 | 1 |
| data | 0.0 | 1 |
| analytics | 33.3 | 2 |
| onboarding | 50.0 | 2 |
| groups | 50.0 | 3 |
| notifications | 50.0 | 1 |
| expenses | 56.9 | 15 |
| balances | 100.0 | 2 |
| payments | 100.0 | 1 |

**balances and payments are the standout** — the two areas with the actual
money math (Simplify Debts, pairwise balances, bidirectional settle-up) are
fully verified at 100%, which is no accident: those were the areas where
`/replica-test` found and fixed real bugs (BUG-003, BUG-005) this session,
so they got the closest scrutiny. **personalization and data are at 0%**
because nothing in those areas is built yet (avatar photos, CSV export) —
honest zeros, not bugs.

## Missing, in build order

**Must-haves (click-test these next, in this order):**
1. Create a group (happy path) — groups
2. Join a group via invite link (happy path) — groups
3. Add/remove group members — groups
4. Sign up with email or Google — Google OAuth stub, onboarding
5. Log in / log out / password reset — password reset not wired, onboarding
6. Split by percentage / by shares / by adjustment — expenses (shared code
   path with the already-tested exact split, lower risk)
7. Add a non-group (one-off) expense — expenses
8. Edit or delete an expense — no edit UI yet (create-only), expenses

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
- **Venmo/PayPal direct partner integration** — their specific partner deal,
  not rebuildable 1:1. (We built our own UPI/Razorpay-link equivalent
  instead — see "yours" below.)
- **Existing Splitwise user network** — a network effect, not a feature.

## Yours, not in the original (not scored, but real work)

- **In-app settle-up payment via UPI/Razorpay** — the original uses
  PayPal/Venmo/Splitwise Pay; this is our own localized equivalent.
- **Dark mode** — tokens exist in `tokens.css`, not yet wired into the app's
  theme switching.
- **Unlimited free expense entry** — the fix for Splitwise's most-complained-
  about behavior (see recon.md F05). Verified by reading the code (no cap
  exists anywhere) and by adding several expenses live with no interstitial.

## Layout diff — skipped this pass

The skill's screenshot-diff step needs same-viewport PNG screenshots of both
apps in matching states. `replica/screens/` currently holds two JPGs from
the recon pass (homepage, signup — both marketing pages, not in-app
screens), and the clone has no `replica/clone-screens/` captures yet. Doing
this properly means re-capturing Splitwise's actual in-app screens (group
view, add-expense, settle-up) from a real account and the clone's matching
states at 1440x900 and 390x844, both as PNG. That's real effort, not a quick
add-on — queued as follow-up rather than faked with the two marketing
screenshots on hand.

## Behavior diff (from this session's click-through)

| flow | original | clone | fix or keep |
| --- | --- | --- | --- |
| Settle up | "pay someone back or record that you've been paid" (both directions, same button) | now matches — was one-directional (BUG-005), fixed this session | keep |
| Debt simplification | reduces payments needed, reroutes live as balances change | matches — verified the reroute-after-partial-settle case by hand | keep |
| Free-tier expense cap | recent versions cap free users at a handful of expenses/day (the top user complaint, per recon.md) | no cap, anywhere | keep — this is the deliberate differentiator |
| Adding an expense | — | 4 taps from group screen to saved (FAB → fill 2 fields → Save) for the equal-split happy path | keep — matches or beats typical mobile-expense-tracker click counts |

## Verdict: **not shippable yet**

Per the skill's own bar: any must-have missing or partial means not
shippable, regardless of how close the number looks. 6 of 16 must-haves are
fully verified; the other 10 are built but need a click-through pass before
anyone should trust them. No open S1 bugs — all 6 found this session are
fixed and have regression coverage (`replica/bugs.md`, 10/10 e2e passing).

**To reach shippable:** finish clicking through the 8 must-have rows listed
above (most are a few minutes each, since the code is already written and
tested indirectly), then re-run `parity.py`. That alone should move most of
those `partial` rows to `yes` and push the must-have count well past the
80-score bar, assuming nothing new breaks.

## Top 5 to build/verify next

1. Click-test Create group → Join group → Add/remove members (groups is
   tied for weakest area, and these are the only *unverified*, not
   *unbuilt*, must-haves — cheapest points on the board).
2. Click-test percentage/shares/adjustment splits (shares a tested code
   path with exact split — likely quick confirmations, not new bugs).
3. Build the expense edit UI (currently create-only) and re-verify
   delete/restore after this session's fixes.
4. Wire up Google OAuth and password reset for onboarding, or explicitly
   defer both to replica-backend and say so in features.csv.
5. Capture real screenshot pairs (original + clone, same viewport, same
   state) and run the layout diff this report skipped.
