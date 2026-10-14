# Test plan: Tabmate

Build: (pending commit)  Date: 2026-10-14 (two sessions)  Env: local (Expo web, `expo start --web`), fake in-memory data layer with seed data from `app/src/lib/data/seed.ts`

The fake data layer resets to seed state on every full page reload, which
doubles as free test isolation — each test starts from the same known
state. Mid-test navigation uses in-app clicks or `page.goBack()` (browser
history), never `page.goto()`, since a hard reload wipes in-memory state
created earlier in the same test.

**9 real bugs found and fixed across three passes** — see `replica/bugs.md`.
Automated specs in `app/e2e/` (22 tests, all passing) cover regressions for
all of them, plus the full must-have split-type and group-lifecycle matrix.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | new user signs up, sees seeded data | happy | sign up, land on Home | seeded groups and friends visible | e2e | PASS |
| F01-H2 | add an equally-split expense | happy | open a group, add expense, save | balances update correctly, no NaN, no crash | e2e | PASS |
| F01-H3 | create a group | happy | name it, submit | lands on its empty-state detail screen | e2e | PASS |
| F01-E1 | | edge: empty group name | submit create-group blank | inline error, no navigation | e2e | PASS |
| F01-E2 | | edge: zero-amount expense | submit amount 0 | inline error, not created | e2e | PASS |
| F01-E3 | | edge: unequal exact split | don't fill amounts, save | remainder warning, Save blocked | e2e | PASS |
| F01-E4 | | edge: non-group expense, no friends selected | submit | inline error "add at least one other person" | e2e | PASS |
| F02-H1 | record a received payment | happy | settle-up where current user is owed, confirm | correct framing, reaches "settled up" | e2e | PASS |
| F02-E1 | | edge: settle amount zero | leave at 0 | Confirm disabled | e2e | PASS |
| F03-H1 | recurring expense field saves | happy | set repeat to Monthly, save | row shows "· repeats" | manual | PASS |
| F04-H1 | join a group via invite code | happy | generate code, join with it | preview shown, join succeeds | e2e | PASS (also BUG-007 regression) |
| F04-N1 | | negative: invalid code | enter a never-issued code | inline error, no join | e2e | PASS |
| F05 | no usage cap exists | happy | code review + live use | none exists, no interstitial ever appears | code review + manual | PASS |
| split-equal | equal split | happy | split a group expense evenly | per-person amounts correct | e2e | PASS |
| split-exact | exact amounts | happy | per-person amounts, remainder check | matches entered amounts exactly | e2e | PASS |
| split-% | percentage | happy | 60/40 of ₹1000 | ₹600/₹400 exact | e2e | PASS |
| split-shares | shares | happy | 1/2/1 ratio of ₹800 | ₹200/₹400/₹200 exact | e2e | PASS |
| split-adjust | adjustment | happy | +₹300 to one person, 3-way | equal-portion-across-everyone math confirmed exact | e2e | PASS |
| groups-remove | remove a member | happy | remove, check balance | group balance and Simplify Debts stay correct (historical debt not erased) | e2e | PASS |
| edit-expense | change an expense's amount | happy | edit, change amount, rebalance split, save | balance updates, remainder validation still applies | e2e | PASS |
| delete-restore | soft delete + restore | happy | delete (confirm dialog), reopen, restore | expense hidden then recoverable | e2e | PASS (also BUG-008 regression) |
| S05 | Simplify Debts reroutes correctly | happy | settle partially, then remove a member | both reroute cases confirmed by hand | manual | PASS |
| S09-pairwise | friend balances are pairwise | happy | compare two friends sharing a 3-person group | each shows only their own pairwise balance | e2e | PASS (BUG-003 regression) |
| BUG-001 | root route resolves correctly | happy | load `/` signed out, then signed in | `/welcome` vs Home, never a collision | e2e | PASS |
| BUG-004 | deep link survives navigation | edge | load `/expense/add?groupId=...` directly, Cancel | lands on group screen, no crash | e2e | PASS |
| a11y-labels | form inputs are labeled | happy | `getByLabel` on every field | accessible name matches visible label | e2e | PASS (BUG-006 regression) |
| a11y-full | keyboard + screen reader pass | edge | tab through, axe scan | zero violations | e2e (axe) | not yet run — next session |
| S11 | activity feed reflects actions | happy | view seeded activity | renders correctly, newest-first, correct text per event type | manual | PASS |
| S13 | account overall balance | happy | check "Overall balance" against hand-calculated total | includes non-group expenses, not just group balances | manual + e2e | PASS (BUG-009 regression) |
| S14 | totals per-member figures | happy | open Totals, check paid/share per member | hand-calculated and confirmed exact | manual | PASS |

## e2e suite summary

`npx playwright test` — **22/22 passing**, `app/e2e/`: `f01-core-loop.spec.ts`
(5), `f02-settle-up.spec.ts` (2), `f04-groups.spec.ts` (4),
`friend-balance.spec.ts` (1), `navigation.spec.ts` (2),
`non-group-expense.spec.ts` (2), `split-types.spec.ts` (3),
`edit-expense.spec.ts` (2), `account.spec.ts` (1).

`npx tsc --noEmit` and `npx expo lint` — both clean.

## What's still open after this pass

- The 2 remaining must-haves (Google OAuth, password reset) genuinely need
  `/replica-backend` — not more click-testing.
- Totals' date-range filter and Activity's push notifications are still
  not built (the screens themselves are verified correct for what they do
  have).
- The axe accessibility scan hasn't been run yet.
- Receipt OCR (S16) and charts (S15) remain unbuilt, so untestable.
- No actual `.apk` has been built yet — see build-log.md.
