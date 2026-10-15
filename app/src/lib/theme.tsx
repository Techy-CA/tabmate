import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme as nwColorScheme, cssInterop, useColorScheme, vars } from "nativewind";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";

// Theme colours live in CSS variables (tailwind.config.js maps every colour
// class to one), so switching light/dark is one `vars()` on the root view —
// no per-screen dark: classes. Icons take `className="text-…"` thanks to the
// cssInterop below, so they follow the theme too.

cssInterop(Feather, { className: { target: "style", nativeStyleToProp: { color: true } } });
cssInterop(ActivityIndicator, { className: { target: "style", nativeStyleToProp: { color: true } } });

type Palette = Record<
  "bg" | "surface" | "border" | "borderInput" | "text" | "muted" | "accent" | "accentStrong" | "onAccent" | "danger" | "success" | "warning",
  string
>;

export const PALETTES: Record<"light" | "dark", Palette> = {
  light: {
    bg: "#ffffff",
    surface: "#f6f7f9",
    border: "#e3e6ea",
    borderInput: "#8a93a1",
    text: "#1f2430",
    muted: "#6b7280",
    accent: "#5b5fef",
    accentStrong: "#4338ca",
    onAccent: "#ffffff",
    danger: "#dc2626",
    success: "#15803d",
    warning: "#b45309",
  },
  dark: {
    bg: "#0f1115",
    surface: "#1a1d24",
    border: "#2a2f39",
    borderInput: "#5b6473",
    text: "#e8eaf0",
    muted: "#9aa3b2",
    accent: "#7c80f7",
    accentStrong: "#6366f1",
    onAccent: "#ffffff",
    danger: "#f87171",
    success: "#4ade80",
    warning: "#fbbf24",
  },
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const cssVars = (p: Palette) =>
  vars({
    "--color-bg": rgb(p.bg),
    "--color-surface": rgb(p.surface),
    "--color-border": rgb(p.border),
    "--color-border-input": rgb(p.borderInput),
    "--color-text": rgb(p.text),
    "--color-muted": rgb(p.muted),
    "--color-accent": rgb(p.accent),
    "--color-accent-strong": rgb(p.accentStrong),
    "--color-on-accent": rgb(p.onAccent),
    "--color-danger": rgb(p.danger),
    "--color-success": rgb(p.success),
    "--color-warning": rgb(p.warning),
  });

const THEME_VARS = { light: cssVars(PALETTES.light), dark: cssVars(PALETTES.dark) };

export type ThemePreference = "system" | "light" | "dark";
const STORAGE_KEY = "tabmate.theme";

type ThemeValue = {
  scheme: "light" | "dark";
  colors: Palette;
  rootStyle: ReturnType<typeof vars>;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") {
          setPref(v);
          nwColorScheme.set(v);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    nwColorScheme.set(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme: "light" | "dark" = colorScheme === "dark" ? "dark" : "light";
  const value = useMemo<ThemeValue>(
    () => ({ scheme, colors: PALETTES[scheme], rootStyle: THEME_VARS[scheme], preference, setPreference }),
    [scheme, preference, setPreference]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
