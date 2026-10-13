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
        className={`font-sans font-medium ${size === "sm" ? "text-xs" : "text-sm"} ${c.text}`}
      >
        {label}
      </Text>
    </View>
  );
}
