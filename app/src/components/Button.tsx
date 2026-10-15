import { ActivityIndicator, Pressable, Text } from "react-native";

type Variant = "primary" | "primary-strong" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3",
  md: "h-10 px-4",
  lg: "h-12 px-5",
};

const textSizeClasses: Record<Size, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

const variantClasses: Record<Variant, { container: string; text: string }> = {
  primary: { container: "bg-accent", text: "text-on-accent" },
  "primary-strong": { container: "bg-accent-strong", text: "text-on-accent" },
  secondary: { container: "bg-surface border border-border", text: "text-text" },
  ghost: { container: "bg-transparent", text: "text-accent" },
  danger: { container: "bg-danger", text: "text-on-accent" },
};

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * Primary interactive primitive. Every variant keeps the label visible while
 * loading (a spinner alone is not an accessible name) and exposes a real
 * disabled state to assistive tech via accessibilityState.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
}: ButtonProps) {
  const v = variantClasses[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={`flex-row items-center justify-center gap-2 rounded-md ${sizeClasses[size]} ${v.container} ${
        isDisabled ? "opacity-40" : ""
      } focus-visible:ring-2 focus-visible:ring-accent`}
    >
      {loading ? <ActivityIndicator size="small" className={variant === "secondary" || variant === "ghost" ? "text-accent" : "text-on-accent"} /> : null}
      <Text className={`font-sans-semibold ${textSizeClasses[size]} ${v.text}`}>{label}</Text>
    </Pressable>
  );
}
