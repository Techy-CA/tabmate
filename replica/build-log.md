# Build log

Stack: Expo + Expo Router + NativeWind, fake in-memory data layer in
`app/src/lib/data/` (same function signatures as the Supabase RPCs in
architecture.md, so replica-backend can swap the implementation without
touching screens).

**2026-10-14, pass 2 (`/replica-test`)**: click-tested the core loop by hand
against the running web preview, found and fixed 6 real bugs (full repro and
root cause in `replica/bugs.md`), then wrote Playwright regression specs for
them in `app/e2e/` — **10/10 passing**. Also ran `npx tsc --noEmit` and
`npx expo lint` for the first time this project — both now clean, but they'd
been skipped during the initial build, which is exactly how BUG-002 (a
field-name typo producing `NaN`) shipped in the first place. Run both after
every data-layer change. The e2e suite itself caught BUG-006 (form inputs
had no accessible label on web) — automated testing found something the
manual click-through missed entirely, which is the whole case for having it.

| screen | status | notes |
| --- | --- | --- |
| S01 Welcome | done, verified | now at `/welcome` (was `/`, see BUG-001) |
| S02 Sign up | done, verified | fake auth, any name+email works |
| S03 Log in | done, verified | same fake auth path as S02; used as the e2e login helper |
| S04 Home (Groups+Friends) | done, verified | balances confirmed correct by hand for all 4 seed friends (BUG-003 fix) |
| S05 Group detail | done, verified | balance summary, Simplify Debts transfers — confirmed the reroute-after-partial-settle behavior is mathematically correct |
| S06+S07 Add expense | done, verified | equal/exact split tested end to end, remainder validation confirmed blocking; %/shares/adjustment not yet individually clicked; itemized correctly not exposed (see below) |
| S08 Expense detail | done, verified | comments tested working; delete confirm dialog doesn't render in web preview — **unverified on Android, see bugs.md** |
| S09 Settle up | done, verified | now bidirectional (BUG-005 fix) — both "you pay" and "record that you were paid" tested |
| S10 Friend detail | done, verified | pairwise balances confirmed correct (BUG-003) |
| S11 Activity feed | built, not verified | queued for next session |
| S12 Group settings | built, not verified | queued for next session |
| S13 Account settings | built, not verified | sign out code-reviewed, not clicked |
| S14 Totals | built, not verified | queued for next session |
| S17 Join group | built, not verified | queued for next session — needs a real click-through since the Share-sheet invite can't be automated headless |
| S18 Pro paywall | stub only | honest "coming soon" card, does not gate any must-have flow |
| S15 Charts | **not built** | could-have, no screen exists |
| S16 Receipt scan | **not built** | could-have, no screen exists |

## Bugs found and fixed this pass

See `replica/bugs.md` for full repro steps. Summary:

- **BUG-001** (S1): `/` resolved to two different screens (a real Expo
  Router path collision between `index.tsx` and `(tabs)/index.tsx`).
- **BUG-002** (S1): new expenses saved balances as `NaN` — a field-name
  mismatch (`owedCents` vs `amountCents`) that `tsc` would have caught
  immediately had it been run.
- **BUG-003** (S2): per-friend balances attributed the current user's
  *entire* group balance to every groupmate instead of just their pairwise
  share — would have shown wildly wrong numbers to real users in any group
  bigger than 2 people.
- **BUG-004** (S2): every back/cancel/close button crashed when reached via
  a direct URL or deep link (no navigation history to pop).
- **BUG-005** (S2): Settle Up only supported "you owe them," contradicting
  the original's own documented behavior ("pay someone back **or** record
  that you've been paid," quoted in recon.md) — now bidirectional.
- **BUG-006** (S2): every form input's accessible name was its placeholder,
  not its label — `accessibilityLabelledBy` doesn't reliably reach
  react-native-web's `aria-labelledby`. Found by the e2e suite itself
  (`getByLabel` timing out), not by hand. Fixed in the shared `Input`
  primitive, so it applies everywhere at once.

All six are fixed, verified by hand and/or by the e2e suite, and have
regression coverage in `app/e2e/` (10/10 passing).

## Known gaps

1. **Itemized split** (`splitType: "itemized"`) computes zero owed shares in
   `src/lib/data/split.ts` and is correctly left out of the add-expense
   screen's split-type picker — never actually selectable, so not a live
   bug, just an unfinished feature.
2. Group `create` flow only lets you pick from existing friends — no "invite
   by email/phone" input yet.
3. **Alert.alert() confirmations (delete expense, leave group) did not
   render in the web preview** — needs verification on a real Android build
   before `/replica-launch`. Very likely fine on-device (Alert has full
   native Android support) but currently unconfirmed.
4. F04 (join group), S11 (activity feed), S12, S13, S14 weren't
   click-tested this pass — queued for the next `/replica-test` session.
5. No accessibility (axe) scan run yet.

## What's next

Finish the remaining `/replica-test` coverage above (especially the Android
Alert confirmation — that's the one real unknown left in the must-have set),
then `/replica-backend` to replace the fake data layer with real Supabase
(auth, Postgres + RLS from `schema.sql`, Razorpay webhook).
