// Theme is generated from replica/design/tokens.json — the single source of
// truth for the design system. Edit tokens.json (and rerun contrast.py),
// never hand-edit colors/spacing/radius here.
const tokens = require("../replica/design/tokens.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
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
      },
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
        pill: `${tokens.radius.pill}px`,
      },
    },
  },
  plugins: [],
};
