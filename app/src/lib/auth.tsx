import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

// null = success with a session. "confirm-email" = succeeded but Supabase's
// "Confirm email" setting means there's no session yet until the user
// clicks the link it just sent — a real outcome, not an error, and the
// screen needs to tell the user that rather than silently doing nothing.
// Anything else is an error message to show as-is.
type SignUpResult = string | null | "confirm-email";

type AuthContextValue = {
  isAuthenticated: boolean;
  userId: string | null;
  loading: boolean;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// tabmate://auth/callback in an APK, exp://…/--/auth/callback in Expo Go,
// http://localhost:8081/auth/callback on web. Every one of these must be in
// Supabase -> Authentication -> URL Configuration -> Redirect URLs.
export const authRedirectUrl = (path: "auth/callback" | "reset-password") => Linking.createURL(path);

/**
 * Supabase hands the session back on the redirect URL — tokens in the
 * fragment (implicit flow) or a `code` in the query (PKCE). Returns true if
 * a session was established from this URL.
 */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const params: Record<string, string> = {};
  const [beforeHash, hash = ""] = url.split("#");
  const query = beforeHash.split("?")[1] ?? "";
  for (const part of [...query.split("&"), ...hash.split("&")]) {
    const [k, v] = part.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  if (params.error_description || params.error) {
    throw new Error((params.error_description || params.error).replace(/\+/g, " "));
  }
  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return true;
  }
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return true;
  }
  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!session,
      userId: session?.user.id ?? null,
      loading,
      signUp: async (name, email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: authRedirectUrl("auth/callback") },
        });
        if (error) return error.message;
        if (!data.session) return "confirm-email";
        return null;
      },
      signInWithGoogle: async () => {
        const redirectTo = authRedirectUrl("auth/callback");
        if (Platform.OS === "web") {
          // Full-page redirect; /auth/callback finishes the sign-in.
          const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
          return error?.message ?? null;
        }
        // Native: there's no page to redirect, so open Google in an auth
        // browser session and read the tokens off the URL it returns with.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error || !data?.url) return error?.message ?? "Couldn't start Google sign-in.";
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== "success") return null; // user closed the browser
        try {
          const ok = await createSessionFromUrl(result.url);
          return ok ? null : "Google sign-in didn't return a session.";
        } catch (e) {
          return e instanceof Error ? e.message : "Google sign-in failed.";
        }
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      sendPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: authRedirectUrl("reset-password"),
        });
        return error?.message ?? null;
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        return error?.message ?? null;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
