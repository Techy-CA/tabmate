# Tabmate setup: Supabase, then the APK

## 1. Database (Supabase SQL Editor)

Run these files in order. Each one is safe to re-run.

1. `replica/schema.sql`: only on a fresh project. Skip it if you already ran it.
2. `replica/migration_payment_handles.sql`
3. `replica/migration_002_realtime_notifications.sql`. This one enables realtime, adds notifications and friend invites, and fixes RLS and security bugs.
4. `replica/migration_003_payment_allocation.sql`. A settle-up recorded outside a group now settles the matching groups too, so friend and group balances always agree. It also fixes payments recorded before this change.
5. `replica/migration_004_phone_friends.sql`. Adds friends by mobile number, lets you invite numbers that aren't on Tabmate yet, and matches your phone contacts.
6. `replica/migration_005_pending_members.sql`. People not on Tabmate yet can be added as *pending* friends or group members and split with immediately. When they sign up with that email or number, everything moves into their account.

7. `replica/migration_007_phone_without_otp.sql`. Mobile numbers are saved without OTP, so there's no SMS cost. Whoever invited a pending person is notified when someone takes them over.
8. `replica/migration_008_features.sql`. Adds reminders and the weekly check-in, recurring expenses that post automatically, itemized bills, notes, edit history, trip mode and the kitty. **Enable the `pg_cron` extension first** (Database → Extensions → pg_cron) so recurring expenses post every night and the weekly reminder goes out on Sundays. Without it the app still posts due recurring expenses whenever someone opens it.
9. `replica/migration_009_account_deletion.sql`. Adds in-app **Delete my account**, which Google Play requires.

**Keep "Confirm email" ON** (Authentication → Providers → Email). A pending person's data is handed over at sign-up, so the email has to be proven first.

Then:

- **Database → Extensions:** make sure `pg_net` is enabled. Migration 002 enables it, but check. Push notifications are sent through it.
- **Authentication → URL Configuration → Redirect URLs:** add
  - `tabmate://**` (needed by the APK for Google sign-in, email confirmation and password reset)
  - `http://localhost:8081/**` (needed by the web preview)
- **Authentication → Providers → Google:** enable it and paste your Google OAuth client ID and secret. Leave it off if you don't want Google sign-in.

## 2. Local run

```bash
cp .env.example .env.local   # fill in URL + anon key
npm install
npx expo start
```

## 3. APK build (EAS)

`.env.local` is git-ignored, so EAS never sees it. Set the variables on EAS instead (only once):

```bash
npx eas-cli@latest login
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-ANON-KEY --visibility plaintext
# optional, appears in invite messages:
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_APP_DOWNLOAD_URL --value https://... --visibility plaintext
```

Then build:

```bash
npx eas-cli@latest build -p android --profile preview
```

If the variables are missing, the APK opens on a "Tabmate isn't configured" screen. It won't crash.

## 4. Push notifications on Android (Firebase, one time)

The app works without this step. In-app notifications (the bell on the home screen) arrive live over realtime either way. You only need this step for alerts while the app is closed.

1. In the [Firebase console](https://console.firebase.google.com), create a project and add an Android app with package `com.tabmate.app`.
2. Download `google-services.json` and put it in `app/` next to `app.json`. It holds public identifiers, so it's fine to commit. `app.config.js` picks it up automatically.
3. In Firebase, go to **Project settings → Service accounts → Generate new private key**. Upload that JSON to EAS: `npx eas-cli@latest credentials` → Android → Google Service Account → *FCM V1* → upload. **Never commit this key.**
4. Rebuild the APK.

Push doesn't work in Expo Go on Android (SDK 53+). Use the APK or a dev build.

## How realtime and notifications work

- The app subscribes to Postgres changes on every table it shows. When a friend or groupmate adds an expense, settles up or comments, your screen updates within about a second. Returning to the app from the background also triggers a catch-up refresh.
- Server triggers write a row to `notifications` for each event that involves you: you're added as a friend or to a group, an expense involving you is added, edited, deleted or restored, someone settles up with you, someone comments, someone joins your group, or a friend you invited signs up.
- Each new notification row is forwarded to your phones through the Expo push service (`pg_net`). Your per-category settings under Account → Notifications are applied on the server.
- If you add a friend by an email that isn't on Tabmate yet, a pending invite is saved and the share sheet opens. When they sign up with that email, you're both connected automatically and you get a notification.

## 5. Publishing on Google Play

Play needs an **AAB** (Android App Bundle), not an APK. The `production` profile builds one, and EAS keeps the signing key and increases the version code for you.

```bash
npx eas-cli@latest build -p android --profile production   # .aab for Play
npx eas-cli@latest build -p android --profile preview      # .apk to install directly
```

The `production` environment on EAS needs the same `EXPO_PUBLIC_SUPABASE_*` variables as `preview`.

In the [Play Console](https://play.google.com/console) (one-time $25 developer fee):

1. **Create the app** and upload the `.aab` to *Internal testing* first, then *Production*.
2. **Privacy policy URL:** host `docs/privacy-policy.md`. The easy way is GitHub repo → Settings → Pages → deploy from `main`, folder `/docs`. Then paste `https://<user>.github.io/tabmate/privacy-policy`.
3. **Data deletion:** use the `docs/delete-account.md` URL from the same site. The in-app option is under Account → Security & app lock.
4. **Data safety form** (matches the privacy policy):
   - **Collected:** name, email, phone number (optional), "other financial info" (expense records), contacts (only processed for friend matching, not stored), app interactions.
   - **Not shared with third parties.** Data is encrypted in transit, and users can request deletion.
5. **Permissions:** declare `READ_CONTACTS` for "find friends in your contacts". The app shows a disclosure before reading contacts.
6. **Content rating:** fill in the questionnaire (no ads, no gambling). **Target audience:** 13+.
7. **Package name:** the package `com.tabmate.app` must be unused on Play. If Play rejects it, change `android.package` in `app.json` (for example `com.<yourname>.tabmate`) and rebuild.
