import { Text, View } from "react-native";

type State = "owed-to-you" | "you-owe" | "settled";
type Size = "sm" | "md";

const config: Record<State, { bg: string; text: string; defaultLabel: string }> = {
  "owed-to-you": { bg: "bg-success/10", text: "text-success", defaultLabel: "you get back" },
  "you-owe": { bg: "bg-danger/10", text: "text-danger", defaultLabel: "you owe" },
  settled: { bg: "bg-border", text: "text-muted", defaultLabel: "settled up" },
};

export type BalanceChipProps = {
  state: State;
  /** Formatted amount, e.g. "₹1,240" — omit for the settled state. */
  amount?: string;
  size?: Size;
};

/**
 * Colour is never the only signal — the label always says "you owe" /
 * "you get back" / "settled up" in text, since this is a money app and
 * colour-blind users need the same information everyone else gets.
 */
export function BalanceChip({ state, amount, size = "md" }: BalanceChipProps) {
  const c = config[state];
  const label = amount ? `${amount} ${c.defaultLabel}` : c.defaultLabel;

  return (
    <View className={`self-start rounded-pill px-2.5 ${size === "sm" ? "py-0.5" : "py-1"} ${c.bg}`}>
      <Text
        accessibilityLabel={label}
        className={`font-sans-medium ${size === "sm" ? "text-xs" : "text-sm"} ${c.text}`}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Row-list variant: amount and label stacked, right-aligned, no pill
 * background. A pill's width tracks its text, so a column of pills next to
 * variable-length amounts (₹2,000 vs ₹23,533.33) reads as randomly sized —
 * right-aligned text keeps every row's right edge lined up instead.
 */
export function BalanceStack({ state, amount }: BalanceChipProps) {
  const c = config[state];
  if (state === "settled" || !amount) {
    return <Text className="font-sans-medium text-sm text-muted">{c.defaultLabel}</Text>;
  }
  return (
    <View className="items-end">
      <Text className={`font-sans-semibold text-base ${c.text}`}>{amount}</Text>
      <Text className={`font-sans text-xs ${c.text}`}>{c.defaultLabel}</Text>
    </View>
  );
}
