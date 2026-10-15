// Theme is generated from replica/design/tokens.json — the single source of
// truth for the design system. Edit tokens.json (and rerun contrast.py),
// never hand-edit colors/spacing/radius here.
const tokens = require("../replica/design/tokens.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  // "class" avoids a NativeWind/Expo-web conflict where app.json's
  // userInterfaceStyle tries to set an explicit color scheme while
  // NativeWind's default "media" strategy expects only the OS to do that.
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Every colour is a CSS variable so light/dark is switched at the root
      // (src/lib/theme.tsx). Light values come from tokens.json; dark values
      // live in theme.tsx's PALETTES.
      colors: {
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        "border-input": "rgb(var(--color-border-input) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-strong": "rgb(var(--color-accent-strong) / <alpha-value>)",
        "on-accent": "rgb(var(--color-on-accent) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
      },
      fontFamily: {
        // RN renders custom fonts as fixed weights, not variable CSS font-weight,
        // so each weight is its own loaded font family (see src/app/_layout.tsx).
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
        display: ["Manrope_700Bold"],
      },
      // tokens.json "type.display" — the big hero numbers and the welcome headline
      fontSize: {
        display: [`${tokens.type.display.size}px`, { lineHeight: `${tokens.type.display.line}px` }],
      },
      boxShadow: {
        card: tokens.shadow.card,
        pop: tokens.shadow.pop,
      },
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
        pill: `${tokens.radius.pill}px`,
      },
    },
  },
  plugins: [
    // light defaults, so anything rendered outside the themed root still has colours
    ({ addBase }) => {
      const rgb = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
      };
      const c = tokens.color;
      addBase({
        ":root": {
          "--color-bg": rgb(c.bg),
          "--color-surface": rgb(c.surface),
          "--color-border": rgb(c.border),
          "--color-border-input": rgb(c["border-input"]),
          "--color-text": rgb(c.text),
          "--color-muted": rgb(c["text-muted"]),
          "--color-accent": rgb(c.accent),
          "--color-accent-strong": rgb(c["accent-strong"]),
          "--color-on-accent": rgb(c["on-accent"]),
          "--color-danger": rgb(c.danger),
          "--color-success": rgb(c.success),
          "--color-warning": rgb(c.warning),
        },
      });
    },
  ],
};
