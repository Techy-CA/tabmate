# Build log

Stack: Expo + Expo Router + NativeWind, fake in-memory data layer in
`app/src/lib/data/` (same function signatures as the Supabase RPCs in
architecture.md, so replica-backend can swap the implementation without
touching screens). Verified running in the browser (web target) through the
welcome → sign up flow before the session hit its usage limit; the remaining
screens are built but were not individually click-tested this session —
treat them as "should work, not yet verified" until replica-test runs.

| screen | status | notes |
| --- | --- | --- |
| S01 Welcome | done, verified | |
| S02 Sign up | done, verified | fake auth, any name+email works |
| S03 Log in | done, not verified | same fake auth path as S02 |
| S04 Home (Groups+Friends) | done, not verified | FAB → add expense, header → create/join group |
| S05 Group detail | done, not verified | balance summary, Simplify Debts transfers, expense list |
| S06+S07 Add expense | done, not verified | full split-type picker: equal/exact/%/shares/adjustment; itemized not implemented (falls through to zero shares — needs a guard before ship) |
| S08 Expense detail | done, not verified | comments, soft delete/restore |
| S09 Settle up | done, not verified | manual record + UPI/Razorpay-link stub (no real Razorpay call yet — that's replica-backend) |
| S10 Friend detail | done, not verified | |
| S11 Activity feed | done, not verified | |
| S12 Group settings | done, not verified | rename, remove member, invite via Share sheet, Simplify Debts toggle, leave group |
| S13 Account settings | done, not verified | sign out wired; currency/notifications rows are static, not functional |
| S14 Totals | done, not verified | per-member paid/owed; no date-range filter yet (should-have, partial) |
| S17 Join group | done, not verified | code preview + join |
| S18 Pro paywall | stub only | honest "coming soon" card, does not gate any must-have flow |
| S15 Charts | **not built** | could-have, no screen exists |
| S16 Receipt scan | **not built** | could-have, no screen exists |

## Known gaps to fix before replica-test

1. **Itemized split** (`splitType: "itemized"`) computes zero owed shares in
   `src/lib/data/split.ts` — the add-expense screen lets you select it but
   doesn't yet build the item-assignment UI. Either hide that segment option
   for now or finish it next session.
2. Group `create` flow only lets you pick from existing friends — there's no
   "invite by email/phone" input yet (recon lists this as part of group
   creation).
3. No automated test pass yet — every "not verified" row above needs an
   actual click-through (ideally via `/replica-test`) before trusting it.
4. Font loading showed a "slow network, using fallback font" warning in the
   web preview — expected for a cold dev-server start, worth a quick recheck
   on a real device.

## What's next

`/replica-backend` to replace the fake data layer with real Supabase
(auth, Postgres + RLS from `schema.sql`, Razorpay webhook), or `/replica-test`
first to click-test everything against the fake layer before wiring up a
real backend. Given the unverified rows above, **replica-test should run
before replica-backend.**
