# Build log

Stack: Expo + Expo Router + NativeWind, backed by Supabase (Postgres + RLS +
realtime). The data layer in `app/src/lib/data/store.tsx` talks to Supabase
directly; the original fake in-memory layer is gone. Setup and APK build
steps: `app/SETUP.md`.

**2026-10-15, pass 3**: realtime fixed (tables were never added to the
`supabase_realtime` publication, so no events ever arrived), notifications
(in-app + Expo push via `pg_net`), friend invites by email for people not on
Tabmate yet, native Google sign-in + password reset, and security/RLS fixes,
all in `replica/migration_002_realtime_notifications.sql`. Verified by
applying schema + migrations to a local Postgres 17 with Supabase stubs and
running 13 scenario checks (all pass). Also fixed the missing
`react-native-worklets` peer dependency, which would have crashed the APK.
The Playwright e2e suite was written against the fake layer and has not been
re-run against Supabase.

**2026-10-14, pass 2 (`/replica-test`, three sessions)**: click-tested
nearly every flow by hand against the running web preview, found and fixed
**9 real bugs** (full repro and root cause in `replica/bugs.md`), then wrote
Playwright regression specs for all of them — **22/22 passing**. Also ran
`npx tsc --noEmit` and `npx expo lint` for the first time this project —
both clean now, but they'd been skipped during the initial build, which is
exactly how BUG-002 (a field-name typo producing `NaN`) shipped in the first
place. The e2e suite itself caught two bugs (BUG-002, BUG-006) that the
manual click-through missed — automated testing earning its keep. Also built
the one genuinely missing piece of code: the expense-edit screen. User asked
directly whether an actual `.apk` exists yet — it doesn't; everything so far
has run through `expo start --web` for fast iteration. Building one needs
EAS Build and the user's own Expo account, which wasn't available this
session (see "What's next").

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
| S11 Activity feed | done, verified | renders correctly, newest-first, correct action text per event type |
| S12 Group settings | done, verified | rename, remove member (balance-safe), invite code (BUG-007 fix), Simplify Debts toggle, leave group (BUG-008 fix) |
| S13 Account settings | done, verified | "Overall balance" fixed (BUG-009) and confirmed exact; sign out works |
| S14 Totals | done, verified | per-member paid/owed figures hand-calculated and confirmed exact |
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
- **BUG-009** (S2): Account's "Overall balance" only summed group balances,
  silently excluding non-group (friend-only) expenses and payments.

All nine are fixed, verified by hand and by the e2e suite, with regression
coverage in `app/e2e/` (22/22 passing). Zero open S1 or S2 bugs.

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
5. No accessibility (axe) scan run yet.
6. No actual `.apk` has been built — everything has run through
   `expo start --web`. Building one needs EAS Build (`eas build -p android`)
   and the user's own Expo account (`eas login`); this session doesn't have
   those credentials and won't create an account or log in on the user's
   behalf. Local Java 17 is present, but there's no Android SDK installed in
   this environment, so EAS's cloud build is the realistic path once the
   user is ready — offered and declined for now in favor of more testing.

## What's next

`/replica-backend` to wire up real Supabase Auth (closing the last 2
must-haves) and Postgres + RLS from `schema.sql`. No payment-gateway
integration to wire up — settle-up is a manual record only, by product
decision (see `architecture.md`).
Parity is at **75.0/100, 14/16 must-haves, zero open S1/S2** — every screen
in the recon map except charts/OCR (S15/S16, both explicitly out of scope
for now) has been built and click-tested at least once. When the user is
ready for an installable APK: they log into Expo (`eas login`) or hand over
an `EXPO_TOKEN`, then `eas build -p android --profile preview` produces a
downloadable `.apk`.
