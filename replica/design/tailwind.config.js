// NativeWind (Tailwind for Expo/React Native) theme, generated from tokens.json.
// Components use className="bg-surface text-muted", never raw hex — matches the
// architecture.md stack choice (Expo + NativeWind).
const tokens = require("./tokens.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: tokens.color.bg,
        surface: tokens.color.surface,
        border: tokens.color.border,
        "border-input": tokens.color["border-input"],
        text: tokens.color.text,
        muted: tokens.color["text-muted"],
        accent: tokens.color.accent,
        "accent-strong": tokens.color["accent-strong"],
        "on-accent": tokens.color["on-accent"],
        danger: tokens.color.danger,
        success: tokens.color.success,
        warning: tokens.color.warning,
      },
      fontFamily: {
        sans: tokens.font.sans.split(",").map((f) => f.trim()),
        display: tokens.font.display.split(",").map((f) => f.trim()),
        mono: tokens.font.mono.split(",").map((f) => f.trim()),
      },
      fontSize: {
        xs: [`${tokens.type.xs.size}px`, { lineHeight: `${tokens.type.xs.line}px` }],
        sm: [`${tokens.type.sm.size}px`, { lineHeight: `${tokens.type.sm.line}px` }],
        base: [`${tokens.type.base.size}px`, { lineHeight: `${tokens.type.base.line}px` }],
        lg: [`${tokens.type.lg.size}px`, { lineHeight: `${tokens.type.lg.line}px` }],
        xl: [`${tokens.type.xl.size}px`, { lineHeight: `${tokens.type.xl.line}px` }],
        display: [`${tokens.type.display.size}px`, { lineHeight: `${tokens.type.display.line}px` }],
      },
      spacing: Object.fromEntries(tokens.space.map((v, i) => [i, `${v}px`])),
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
        pill: `${tokens.radius.pill}px`,
      },
      boxShadow: {
        card: tokens.shadow.card,
        pop: tokens.shadow.pop,
      },
    },
  },
  plugins: [],
};
