# Build log

Stack: Expo + Expo Router + NativeWind, fake in-memory data layer in
`app/src/lib/data/` (same function signatures as the Supabase RPCs in
architecture.md, so replica-backend can swap the implementation without
touching screens).

**2026-10-14, pass 2 (`/replica-test`, two sessions)**: click-tested nearly
every must-have flow by hand against the running web preview, found and
fixed **8 real bugs** (full repro and root cause in `replica/bugs.md`), then
wrote Playwright regression specs for all of them — **21/21 passing**. Also
ran `npx tsc --noEmit` and `npx expo lint` for the first time this project —
both clean now, but they'd been skipped during the initial build, which is
exactly how BUG-002 (a field-name typo producing `NaN`) shipped in the first
place. The e2e suite itself caught two bugs (BUG-002, BUG-006) that the
manual click-through missed — automated testing earning its keep. Also built
the one genuinely missing piece of code: the expense-edit screen.

| screen | status | notes |
| --- | --- | --- |
| S01 Welcome | done, verified | now at `/welcome` (was `/`, see BUG-001) |
| S02 Sign up | done, verified | fake auth, any name+email works; Google OAuth is a stub |
| S03 Log in | done, verified | same fake auth path as S02; password reset not wired |
| S04 Home (Groups+Friends) | done, verified | balances confirmed correct by hand for all seed friends (BUG-003 fix) |
| S05 Group detail | done, verified | balance summary, Simplify Debts transfers, reroute-after-settle and reroute-after-member-removal both confirmed correct |
| S06+S07 Add/edit expense | done, verified | all 5 split types (equal/exact/%/shares/adjustment) hand-verified against calculated expected values; edit mode built this pass (reopens as exact-amounts, prefilled) |
| S08 Expense detail | done, verified | comments, soft delete/restore, edit entry point — delete confirm fixed (BUG-008) and e2e-tested |
| S09 Settle up | done, verified | both directions tested (BUG-005 fix) |
| S10 Friend detail | done, verified | pairwise balances confirmed correct (BUG-003) |
| S11 Activity feed | built, not verified | queued for next session |
| S12 Group settings | done, verified | rename, remove member (balance-safe), invite code (BUG-007 fix), Simplify Debts toggle, leave group (BUG-008 fix) |
| S13 Account settings | built, not verified | sign out code-reviewed, not clicked |
| S14 Totals | built, not verified | queued for next session |
| S17 Join group | done, verified | happy path, already-member guard, invalid-code negative case |
| S18 Pro paywall | stub only | honest "coming soon" card, does not gate any must-have flow |
| S15 Charts | **not built** | could-have, no screen exists |
| S16 Receipt scan | **not built** | could-have, no screen exists |

## Bugs found and fixed across both test passes

See `replica/bugs.md` for full repro steps. Summary:

- **BUG-001** (S1): `/` resolved to two different screens (route collision).
- **BUG-002** (S1): new expenses saved balances as `NaN` (field-name typo
  `tsc` would have caught).
- **BUG-003** (S2): per-friend balances attributed the current user's
  *entire* group balance to every groupmate instead of their pairwise share.
- **BUG-004** (S2): back/cancel/close buttons crashed on direct URL or deep
  link (no navigation history to pop).
- **BUG-005** (S2): Settle Up only supported "you owe them," never "they
  paid you" — contradicted the original's documented behavior.
- **BUG-006** (S2): form inputs had no accessible label on web (caught by
  the e2e suite, not by eye).
- **BUG-007** (S2): `Share.share()` threw uncaught on web; the invite code
  was generated but never shown to the user.
- **BUG-008** (S2): `Alert.alert()` confirmations (delete expense, leave
  group) were a silent no-op on web — no error, no dialog, nothing happened.

All eight are fixed, verified by hand and by the e2e suite, with regression
coverage in `app/e2e/` (21/21 passing). Zero open S1 or S2 bugs.

## Known gaps

1. **Itemized split** (`splitType: "itemized"`) computes zero owed shares in
   `src/lib/data/split.ts` and is correctly left out of the add-expense
   screen's split-type picker — never actually selectable, so not a live
   bug, just an unfinished feature.
2. Group `create` flow only lets you pick from existing friends — no "invite
   by email/phone" input yet.
3. **Google OAuth and password reset are fake stubs** — the only two
   remaining must-have gaps, and both genuinely need `/replica-backend`
   (real Supabase Auth), not more click-testing.
4. Editing an expense always reopens as an "exact amounts" split prefilled
   with current shares, regardless of the original split type — the
   original percentage/shares/adjustment *inputs* aren't reconstructable
   from a stored `owedCents` total alone. This is a deliberate, documented
   simplification (see the comment in `expense/add.tsx`), not a bug.
5. S11 (activity feed), S13 (account settings), S14 (totals) weren't
   click-tested this pass — queued for the next `/replica-test` session.
6. No accessibility (axe) scan run yet.

## What's next

`/replica-backend` to wire up real Supabase Auth (closing the last 2
must-haves), Postgres + RLS from `schema.sql`, and the Razorpay webhook —
or finish the remaining S11/S13/S14 click-testing first if staying in
`/replica-test` a while longer. Parity is at **75.0/100, 14/16 must-haves,
zero open S1/S2** — the closest this project has been to shippable.
