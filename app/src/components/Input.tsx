import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

export type InputProps = TextInputProps & {
  label: string;
  error?: string;
  /** Fixed prefix shown inside the field (e.g. "₹") — never a placeholder,
   * so it can never be mistaken for a typed value. */
  prefix?: string;
  /** Keep the label as the accessible name but don't render it visually —
   * for compact repeated rows (e.g. one amount input per person) where the
   * row already shows who it's for. */
  hideLabel?: boolean;
};

/**
 * Text / amount input primitive. Amount fields pass prefix="₹" and
 * inputMode="decimal" from the call site rather than guessing currency here.
 */
export function Input({ label, error, prefix, hideLabel, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderClass = error ? "border-danger" : focused ? "border-accent" : "border-border-input";

  return (
    <View className="gap-1.5">
      <Text
        className="font-sans-medium text-xs text-muted"
        nativeID={`${label}-label`}
        style={hideLabel ? { position: "absolute", width: 1, height: 1, opacity: 0 } : undefined}
      >
        {label}
      </Text>
      <View
        className={`h-11 flex-row items-center rounded-sm border bg-bg px-3 ${borderClass} ${
          focused ? "ring-2 ring-accent" : ""
        }`}
      >
        {prefix ? <Text className="mr-1 font-sans text-base text-muted">{prefix}</Text> : null}
        <TextInput
          {...rest}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${label}-label`}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor="#6b7280"
          className="flex-1 font-sans text-base text-text"
        />
      </View>
      {error ? (
        <Text className="font-sans text-xs text-danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
