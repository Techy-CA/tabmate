import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";

export type LedgerTone = "positive" | "negative" | "muted";

const toneClass: Record<LedgerTone, string> = {
  positive: "text-success",
  negative: "text-danger",
  muted: "text-muted",
};

export type LedgerRowProps = {
  /** Optional leading category icon (group screen); friend rows go without. */
  icon?: ComponentProps<typeof Feather>["name"];
  title: string;
  /** e.g. "New · 15 Oct" or "You paid ₹850 · 15 Oct" */
  subtitle: string;
  /** what this line means for you — never the bill total */
  amount?: string;
  /** small caption under the amount: "you lent", "you borrowed", "not involved" */
  caption: string;
  tone: LedgerTone;
  strikethrough?: boolean;
  onPress?: () => void;
};

/**
 * One line in a group's or friend's history. Left: what it was and when.
 * Right: what it means for you ("₹425 / you lent") — a ₹850 lunch split two
 * ways must never read as ₹850 owed to you.
 */
export function LedgerRow({ icon, title, subtitle, amount, caption, tone, strikethrough, onPress }: LedgerRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}. ${caption}${amount ? ` ${amount}` : ""}`}
      className="flex-row items-center gap-3 border-b border-border py-3"
    >
      {icon ? (
        <View className="h-10 w-10 items-center justify-center rounded-sm bg-surface">
          <Feather name={icon} size={18} color="#6b7280" />
        </View>
      ) : null}
      <View className="flex-1">
        <Text numberOfLines={1} className={`font-sans-medium text-sm ${strikethrough ? "text-muted line-through" : "text-text"}`}>
          {title}
        </Text>
        <Text numberOfLines={1} className="font-sans text-xs text-muted">
          {subtitle}
        </Text>
      </View>
      <View className="items-end">
        {amount ? (
          <Text className={`font-sans-semibold text-sm ${toneClass[tone]} ${strikethrough ? "line-through" : ""}`}>{amount}</Text>
        ) : null}
        <Text className={`font-sans text-xs ${amount ? toneClass[tone] : "text-muted"}`}>{caption}</Text>
      </View>
    </Pressable>
  );
}
