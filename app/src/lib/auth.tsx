import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

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
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
          options: { data: { name } },
        });
        if (error) return error.message;
        if (!data.session) return "confirm-email";
        return null;
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
        return error?.message ?? null;
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      signOut: () => {
        supabase.auth.signOut();
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
