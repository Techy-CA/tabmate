# Bugs

Found by manual click-through against the running web preview (`expo start --web`),
seed data from `app/src/lib/data/seed.ts`. All fixes below are committed.

### BUG-001: `/` resolved to two different screens (Welcome and Home)

- Severity: S1
- Flow / case: all of them — this blocked every flow on cold start
- Screen: S01 / S04
- Build: d3014a5  Browser: Chromium (Expo web)

Steps
1. Start the app fresh and load `/`.

Expected: the Welcome screen (S01) for a signed-out user, or Home (S04) once signed in.
Actual: both `src/app/index.tsx` and `src/app/(tabs)/index.tsx` were registered for
the route `/` — an unresolvable Expo Router path collision.
Evidence: directory listing of `src/app` showed both files; confirmed by reading
Expo Router's file-based routing rules (a route group like `(tabs)` doesn't change
the URL, so its `index.tsx` also claims `/`).
Suspected cause: `index.tsx` was written as the public Welcome screen without
realizing `(tabs)/index.tsx` would claim the same path.
Status: fixed in this session — renamed the public screen to `src/app/welcome.tsx`,
updated the three places that redirected to `"/"` for a signed-out user
((tabs)/_layout.tsx, account.tsx sign-out) to redirect to `"/welcome"` instead.

### BUG-002: New expenses saved a balance of `₹NaN`

- Severity: S1
- Flow / case: F01-H1 (any expense creation)
- Screen: S06
- Build: d3014a5

Steps
1. Open a group, tap the add-expense FAB.
2. Fill in a description and amount, leave split type as "Equally".
3. Save.
4. Return to the group screen.

Expected: the new expense appears and "Your balance" shows a real number.
Actual: "Your balance" showed `₹NaN you owe`, and the Simplify Debts section
disappeared entirely.
Evidence: screenshot `replica/bugs/BUG-002-nan-balance.png` (see session screenshots);
root-caused by reading `store.tsx`'s `createExpense`.
Suspected cause: `ComputedShare` (the return type of `computeShares` in
`split.ts`) has a field named `owedCents`, but `NewExpenseInput.owedBy` was
typed as `{userId, amountCents}[]` and `createExpense` read `o.amountCents` —
which doesn't exist on a `ComputedShare`, so it was `undefined`, propagating
to `NaN` through every balance calculation downstream. TypeScript should have
caught this at the call site, but `tsc --noEmit` had never been run this
session until after this bug was found by hand.
Status: fixed — `NewExpenseInput.owedBy` retyped to `{userId, owedCents}[]`
and `store.tsx` line ~315 now reads `o.owedCents`. `npx tsc --noEmit` is now
clean and should be run after every data-layer change going forward.

### BUG-003: Friend balance double-/triple-counted group expenses with 3+ people

- Severity: S2
- Flow / case: S10 (per-friend balance), also shown on S04's Friends list
- Screen: S10
- Build: d3014a5

Steps
1. Sign in, go to Home.
2. Compare the "Friends" list balances for two friends who are both in the
   same 3-person group (e.g. Dev and Ayaan, both in Indiranagar Flat).

Expected: each friend's balance reflects only what's owed between the current
user and that specific friend.
Actual: both Dev and Ayaan showed the *current user's entire group balance*
(minus only payments that happened to be between that specific pair) — e.g.
Dev showed ₹23,533.33 and Ayaan showed ₹28,533.33, when the correct pairwise
numbers are ₹8,933.33 and ₹14,600 respectively. The code's own comment
("only count the portion between these two people when others are on the
expense too") admitted the intent was never implemented.
Evidence: hand-verified against the seed data's expense math; see session
transcript for the full calculation.
Suspected cause: `getFriendBalance` in `store.tsx` summed `mine.paidCents -
mine.owedCents` (the current user's *total* net position on an expense) for
every expense shared with that friend, instead of isolating just the
pairwise amount between the two of them.
Status: fixed — rewritten to only count an expense toward a pairwise balance
when the current user or the friend is the one who paid (our data model has
exactly one payer per expense), crediting the non-payer's `owedCents`
specifically rather than the payer's whole-group net position. Verified
against hand calculations for all four seed friends (Dev, Ayaan, Rhea,
Nisha) — all now exact.

### BUG-004: Back/close buttons crashed when there was no navigation history

- Severity: S2
- Flow / case: any back/cancel/close button, reachable via deep link or a
  direct URL load (e.g. opening a shared link to an expense)
- Screen: S06, S08, S09, S10, S12, S14, S17, S18 (every screen with a
  back/cancel/close button)
- Build: d3014a5

Steps
1. Navigate directly to a nested route's URL (e.g. `/expense/add?groupId=g-flat`)
   without going through the app's own navigation first.
2. Fill the form and submit (or tap Cancel/Back/Close).

Expected: navigates to a sensible fallback screen.
Actual: a toast error, "The action 'GO_BACK' was not handled by any
navigator," and the screen didn't navigate anywhere.
Suspected cause: every back/cancel/close handler called `router.back()`
unconditionally; Expo Router's `back()` throws when the navigation stack has
nothing to pop, which happens on any direct URL load (not just in testing —
also a real deep link from a push notification or a shared link, once those
exist).
Status: fixed — added `src/lib/nav.ts`'s `goBack(router, fallbackHref)`,
which checks `router.canGoBack()` first and falls back to `router.replace()`
otherwise. Replaced all 12 `router.back()` call sites across 10 files.
Verified the add-expense Cancel/Save-then-return flow directly via URL with
no crash.

### BUG-005: Settle Up only supported "you owe them," never "they paid you"

- Severity: S2
- Flow / case: F02, specifically when the current user is owed money rather
  than owing it
- Screen: S09
- Build: d3014a5

Steps
1. Deep-link to `/settle/<counterpart>?groupId=<group>` where the current
   user is actually owed money in that group (not a bug in the built
   navigation paths, which correctly hide the Settle Up button in this case —
   but the screen itself didn't defend against it).

Expected: per recon.md's own quote from the original's help center — "Tap
'Settle up' to pay someone back **or record that you've been paid**" — the
screen should handle both directions.
Actual: it always framed the flow as "You pay {name}" and always created a
payment `fromUserId: currentUser`, regardless of who actually owed whom.
Evidence: screenshot showing "You pay Ayaan Sheikh ₹23,533.33" when Ayaan
was the one who owed the current user that amount.
Status: fixed — `NewPaymentInput` now accepts an optional `fromUserId`;
the settle-up screen computes the signed balance, picks direction
(`iOwe`), and renders "You pay" + both payment methods when `iOwe`, or
"Record that you were paid by" + a manual-only confirmation when not. The
in-app UPI-link method is intentionally still "I owe → I pay via link"
only; a "request payment" flow is a distinct, unbuilt feature. Verified
live: confirming a received-payment now correctly shows "settled up" and
reroutes the group's Simplify Debts suggestion.

### BUG-006: Input fields had no accessible label exposed on web

- Severity: S2
- Flow / case: every text input in the app (18+ instances via the shared
  `Input` primitive)
- Screen: every screen with a form field
- Build: post-BUG-001..005 fixes

Steps
1. Run the Playwright e2e suite (`npx playwright test`).
2. `getByLabel("Your name")` on the sign-up screen times out after 30s even
   though the field is visibly on screen, focused, and functional by mouse.

Expected: screen readers and `getByLabel`-style tooling can identify every
input by its visible label.
Actual: the accessible name computed for each `Input` was the *placeholder*
text, not the label — e.g. "Ayaan Sheikh" instead of "Your name". Confirmed
by inspecting the live DOM: `aria-label` and `aria-labelledby` were both
absent on the underlying `<input>` element.
Suspected cause: the `Input` primitive (`src/components/Input.tsx`) only set
`accessibilityLabelledBy={`${label}-label`}` on the `TextInput`, pointing at
a sibling `Text`'s `nativeID`. This is a real React Native prop, but
react-native-web does not reliably translate it into `aria-labelledby` (or
Playwright wasn't resolving it) — meaning every form field in the web build
was effectively unlabeled for assistive tech and label-based tooling. This
was caught by the e2e suite itself, not by eye — the field *looks* labeled
because the visible `Text` sits right above it, but that's a sighted-only
affordance.
Status: fixed — added `accessibilityLabel={label}` directly on the
`TextInput`, which react-native-web reliably maps to `aria-label`. Kept
`accessibilityLabelledBy` as a secondary hint. Verified via a live DOM
inspection (`aria-label` and `aria-labelledby` both now resolve correctly)
and by re-running the full e2e suite.
Note: since this is a shared primitive, the fix applies to every screen at
once — no other `Input` call sites needed changes.

### BUG-007: Share.share() threw uncaught on web, invite code never shown

- Severity: S2
- Flow / case: F04 (join a group via invite link), specifically generating
  the invite from group settings
- Screen: S12
- Build: post-BUG-001..006 fixes

Steps
1. Open any group → Group settings → "Invite via link".

Expected: the invite code is generated and shown to the user somehow (a
share sheet, an on-screen code, anything).
Actual: `Share.share()` threw `Error: Share is not supported in this
browser` as an **uncaught** promise rejection — the invite code had already
been created in the data layer (so it technically existed), but the user
saw and got absolutely nothing. No error message, no code, no feedback.
Evidence: browser console, `Uncaught (in promise) Error: Share is not
supported in this browser` at `Share.share`.
Suspected cause: `Share` (from `react-native`) has no web implementation in
react-native-web — unlike `Alert`, which degrades to a silent no-op, `Share`
throws. The call wasn't wrapped in a try/catch, and nothing displayed the
code independently of the share action succeeding.
Status: fixed — the invite code is now always rendered on-screen the moment
it's generated (`group/[id]/settings.tsx`), independent of whether
`Share.share()` succeeds; the share call itself is now wrapped in
try/catch so a platform without Share support degrades gracefully instead
of crashing. This is also better UX than the original plan: a visible code
can be read aloud or typed into chat, not just shared via whatever the OS
offers. Verified live and covered by `f04-groups.spec.ts`'s BUG-007
regression test.

### BUG-008: Alert.alert() confirmations were a silent no-op on web

- Severity: S2
- Flow / case: delete an expense, leave a group — any destructive action
  gated behind a confirmation dialog
- Screen: S08 (delete), S12 (leave group)
- Build: post-BUG-001..007 fixes

Steps
1. Open an expense, tap the delete (trash) icon.

Expected: a confirm/cancel dialog, then the expense is soft-deleted on
confirm.
Actual: nothing happened at all — no dialog, no error, no state change.
Confirmed two ways: manually in the browser (button press registered,
nothing rendered) and automatically (`page.on('dialog')` in Playwright never
fired, proving no native browser dialog API was invoked at all — this
promoted it from "to check" to a confirmed bug rather than a guess).
Suspected cause: `Alert.alert()` has no web implementation in
react-native-web; unlike `Share.share()` (BUG-007), it doesn't even throw —
it just does nothing, which is worse to debug because there's no error to
find.
Status: fixed — added `src/lib/confirm.ts`'s `confirmAction()`, which uses
`window.confirm()` on web and `Alert.alert()` everywhere else. Both call
sites (delete-expense, leave-group) now use it. Verified live and by e2e
(`edit-expense.spec.ts`'s delete/restore test, which failed before this fix
and passes after it).

### BUG-009: "Overall balance" on Account silently excluded non-group expenses

- Severity: S2
- Flow / case: any user with a non-group (friend-only) expense or payment
- Screen: S13
- Build: post-BUG-001..008 fixes

Steps
1. Have at least one non-group expense (e.g. a one-off lunch split with a
   friend who isn't in any shared group).
2. Open Account and look at "Overall balance."

Expected: the true net position across everything — groups and
friend-only expenses alike.
Actual: `getTotalBalance()` only summed `listMyGroups()`'s group balances;
non-group expenses and payments (which belong to no group at all) were
invisible to that loop. With the seed data's ₹800 non-group lunch with
Nisha Rao, the screen showed ₹33,533.33 instead of the correct ₹32,733.33 —
found by hand-checking the number against the per-screen balances, not by a
crash or visible error.
Status: fixed — `getTotalBalance()` now also sums the current user's net
position across every non-group expense and confirmed non-group payment.
Verified by hand and covered by `account.spec.ts`.
