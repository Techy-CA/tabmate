# Test plan: Splitsy

Build: (pending commit)  Date: 2026-10-14  Env: local (Expo web, `expo start --web`), fake in-memory data layer with seed data from `app/src/lib/data/seed.ts`

The fake data layer resets to seed state on every full page reload, which
doubles as free test isolation — each test starts from the same known state.

**6 real bugs found and fixed this pass** — see `replica/bugs.md` for full
repro steps and root causes. Automated specs in `app/e2e/` (10 tests, all
passing) cover regressions for all of them.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | new user signs up, sees seeded data | happy | sign up, land on Home | seeded groups ("Indiranagar Flat", "Goa Trip") and friends visible | e2e | PASS |
| F01-H2 | add an equally-split expense | happy | open a group, add expense ₹900 split equally, save | balances update correctly, no NaN, no crash returning to group | e2e | PASS |
| F01-E1 | | edge: empty group name | submit create-group with blank name | inline error, no navigation | e2e | PASS |
| F01-E2 | | edge: zero-amount expense | submit add-expense with amount 0 | inline error, expense not created | e2e | PASS |
| F01-E3 | | edge: unequal exact split that doesn't add up | split type "exact", don't fill amounts, try to save | remainder warning shown, Save blocked, stays on screen | e2e | PASS |
| F01-E4 | | edge: non-group expense with only yourself selected | open add-expense from Home (no group), add no friends, submit | inline error "add at least one other person" | manual | not yet run — next session |
| F02-H1 | record a received payment | happy | deep-link to settle-up where current user is owed money, confirm | correct "Record that you were paid by" framing, balance reaches "settled up" | e2e | PASS |
| F02-E1 | | edge: settle amount is zero | leave amount at 0 | Confirm button disabled | e2e | PASS |
| F03-H1 | recurring expense field saves | happy | add expense, set repeat to Monthly, save | expense row shows a repeat indicator | manual | PASS — verified visually ("· repeats" label) on seeded rent/wifi rows |
| F04-H1 | join a group via invite code | happy | from group settings, generate invite code, open Join Group, paste code | group preview shown, join succeeds, group appears on Home | manual | not yet run — Share sheet needs a real click-through, next session |
| F04-N1 | | negative: invalid code | enter a code that was never issued | inline error, no join | manual | not yet run — next session |
| F05 | no usage cap exists | happy | read the codebase for any expense-count gate | none exists | code review + manual | PASS — verified by reading expense/add.tsx and store.tsx, and by adding several expenses live with no interstitial |
| S05 | group detail renders Simplify Debts | happy | open a 3-person group with a debt chain | fewest-transfers list shown, re-routes correctly after a partial settle | manual | PASS — verified the reroute: after Ayaan settled up, Dev's debt rerouted straight to Ayaan instead of through the (now-settled) current user |
| S08 | expense comment + delete | happy | open an expense, add a comment, tap delete | comment appears instantly; delete triggers a confirm dialog | manual | comment PASS; delete confirm dialog did not render in the web preview — needs a real Android build to confirm (see bugs.md) |
| S09 | friend balances are pairwise | happy | compare two friends who share a 3-person group | each shows only their own pairwise balance, not the group total | e2e | PASS |
| S11 | activity feed reflects actions | happy | add an expense, record a payment | both appear at the top of Activity, newest first | manual | not yet run — next session |
| BUG-001 regression | root route resolves correctly per auth state | happy | load `/` signed out, then signed in | `/welcome` vs Home, never a collision | e2e | PASS |
| BUG-004 regression | deep link can navigate away without crashing | edge | load `/expense/add?groupId=...` directly, tap Cancel | lands on the group screen, no "GO_BACK" error | e2e | PASS |
| a11y | form inputs are labeled for assistive tech | happy | `getByLabel` on every form field | each field's accessible name matches its visible label | e2e | PASS (was BUG-006, now fixed) |
| a11y | full keyboard + screen reader pass | edge | tab through each screen, check focus order | every interactive element reachable by keyboard, axe reports zero violations | e2e (axe) | not yet run — next session, add `@axe-core/playwright` scan to each spec |

## e2e suite summary

`npx playwright test` — **10/10 passing**, `app/e2e/`:
`f01-core-loop.spec.ts` (5), `f02-settle-up.spec.ts` (2),
`friend-balance.spec.ts` (1), `navigation.spec.ts` (2).

`npx tsc --noEmit` and `npx expo lint` — both clean.

## What's still open after this pass

- The `Alert.alert()` confirm-dialog gap (delete expense, leave group) needs
  verification on a real Android build — can't be confirmed from the web
  preview alone.
- F04 (join group), S11 (activity feed), and the axe accessibility scan
  weren't run this session — queued for the next `/replica-test` pass.
- Receipt OCR (S16) and charts (S15) remain unbuilt, so untestable.
