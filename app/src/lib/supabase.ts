import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Throwing at import time made a misconfigured APK crash to a blank screen
// on launch with no way to see why. The root layout renders this message
// instead. EXPO_PUBLIC_* values are inlined at build time, so for an EAS
// build they must exist as EAS environment variables (see README) — a local
// .env.local is git-ignored and never uploaded to the build server.
export const supabaseConfigError =
  !url || !anonKey
    ? "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Set them in app/.env.local for local runs, and as EAS environment variables for APK builds."
    : null;

// AsyncStorage (not expo-secure-store) for session persistence — it has a
// web implementation, unlike SecureStore, so auth works the same in the web
// preview as on a real device build. The anon key is safe client-side by
// design; every table it can reach is still gated by Postgres RLS.
export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// On native, timers don't run while the app is backgrounded, so token
// refresh is tied to foreground state (Supabase's recommended RN setup).
// Without this a phone left in the background past the token's expiry
// comes back with a dead session and a realtime socket that RLS rejects.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
