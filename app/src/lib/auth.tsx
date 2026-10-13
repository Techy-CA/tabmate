import { createContext, useContext, useMemo, useState } from "react";

// Fake auth for replica-build — swap for Supabase Auth in replica-backend.
// Same shape (isAuthenticated, signUp, signIn, signOut) so screens don't change.
type AuthContextValue = {
  isAuthenticated: boolean;
  signUp: (name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(false);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      signUp: async () => {
        await new Promise((r) => setTimeout(r, 300));
        setAuthenticated(true);
      },
      signInWithGoogle: async () => {
        await new Promise((r) => setTimeout(r, 300));
        setAuthenticated(true);
      },
      signIn: async () => {
        await new Promise((r) => setTimeout(r, 300));
        setAuthenticated(true);
      },
      signOut: () => setAuthenticated(false),
    }),
    [isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
