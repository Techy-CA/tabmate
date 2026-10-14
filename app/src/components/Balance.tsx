import { Text, View } from "react-native";

type State = "owed-to-you" | "you-owe" | "settled";

const config: Record<State, { text: string; defaultLabel: string }> = {
  "owed-to-you": { text: "text-success", defaultLabel: "you get back" },
  "you-owe": { text: "text-danger", defaultLabel: "you owe" },
  settled: { text: "text-muted", defaultLabel: "settled up" },
};

export type BalanceChipProps = {
  state: State;
  /** Formatted amount, e.g. "₹1,240" — omit for the settled state. */
  amount?: string;
};

/**
 * Colour is never the only signal — the label always says "you owe" /
 * "you get back" / "settled up" in text, since this is a money app and
 * colour-blind users need the same information everyone else gets.
 */

/**
 * Row-list variant: amount and label stacked, right-aligned. A pill's width
 * tracks its text, so a column of pills next to variable-length amounts
 * (₹2,000 vs ₹23,533.33) reads as randomly sized — right-aligned text keeps
 * every row's right edge lined up instead.
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

/**
 * Standalone hero variant for a group/friend detail screen's headline
 * balance — a big bold colored number with a caption underneath, same
 * hierarchy the Totals screen already uses for "Total group spending".
 * No pill: a colored chip nested inside its own surrounding card read as
 * two boxes stacked on each other rather than one clear number.
 */
export function BalanceHero({ state, amount }: BalanceChipProps) {
  const c = config[state];
  if (state === "settled" || !amount) {
    return <Text className="font-sans-medium text-base text-muted">{c.defaultLabel}</Text>;
  }
  return (
    <View className="items-center gap-1">
      <Text className={`font-display text-display ${c.text}`}>{amount}</Text>
      <Text className="font-sans text-sm text-muted">{c.defaultLabel}</Text>
    </View>
  );
}
