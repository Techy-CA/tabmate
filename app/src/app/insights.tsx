import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BarList, categoryLabel, lastMonths, MonthBars } from "@/components/Charts";
import { EmptyState } from "@/components/EmptyState";
import { SegmentedControl } from "@/components/SegmentedControl";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

type Range = "this" | "last" | "six";
const RANGES: { value: Range; label: string }[] = [
  { value: "this", label: "This month" },
  { value: "last", label: "Last month" },
  { value: "six", label: "6 months" },
];

// Your own spending: your share of every expense you're part of (not what
// you happened to pay up front) — the number that matches your real cost.
export default function Insights() {
  const router = useRouter();
  const { listMyExpenses, getGroup, currentUser } = useData();
  const [range, setRange] = useState<Range>("this");
  const currency = currentUser.defaultCurrency;

  const months = lastMonths(6);
  const thisKey = months[5].key;
  const lastKey = months[4].key;
  const mine = listMyExpenses()
    .map((e) => ({ e, cents: e.shares.find((s) => s.userId === currentUser.id)?.owedCents ?? 0 }))
    .filter((x) => x.cents > 0);

  const inRange = mine.filter(({ e }) =>
    range === "this" ? e.expenseDate.startsWith(thisKey) : range === "last" ? e.expenseDate.startsWith(lastKey) : e.expenseDate >= `${months[0].key}-01`
  );
  const total = inRange.reduce((s, x) => s + x.cents, 0);
  const thisMonth = mine.filter(({ e }) => e.expenseDate.startsWith(thisKey)).reduce((s, x) => s + x.cents, 0);
  const lastMonth = mine.filter(({ e }) => e.expenseDate.startsWith(lastKey)).reduce((s, x) => s + x.cents, 0);
  const change = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const sumBy = (keyOf: (x: (typeof inRange)[number]) => string) =>
    [...inRange.reduce((m, x) => m.set(keyOf(x), (m.get(keyOf(x)) ?? 0) + x.cents), new Map<string, number>())].sort(
      (a, b) => b[1] - a[1]
    );
  const byCategory = sumBy((x) => x.e.category).map(([c, cents]) => ({ key: c, label: categoryLabel(c), cents }));
  const byGroup = sumBy((x) => x.e.groupId ?? "")
    .slice(0, 6)
    .map(([g, cents]) => ({ key: g || "none", label: g ? getGroup(g)?.name ?? "Group" : "Non-group", cents }));
  const monthBars = months.map((m) => ({
    ...m,
    cents: mine.filter(({ e }) => e.expenseDate.startsWith(m.key)).reduce((s, x) => s + x.cents, 0),
  }));
  const topCategory = byCategory[0];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/account")}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">Your spending</Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6 pb-10">
        {mine.length === 0 ? (
          <EmptyState icon="bar-chart-2" title="No spending yet" body="Once you split some expenses, you'll see where your money goes." />
        ) : (
          <>
            <SegmentedControl options={RANGES} value={range} onChange={setRange} />

            <View className="items-center gap-1">
              <Text className="font-sans text-sm text-muted">Your share of spending</Text>
              <Text className="font-display text-display text-text">{formatCents(total, currency)}</Text>
              {range === "this" && change !== null ? (
                <Text className="font-sans text-xs text-muted">
                  {change === 0 ? "Same as last month" : `${Math.abs(change)}% ${change > 0 ? "more" : "less"} than last month`}
                </Text>
              ) : null}
              {topCategory && total > 0 ? (
                <Text className="text-center font-sans text-xs text-muted">
                  Most went on {topCategory.label.toLowerCase()} ({Math.round((topCategory.cents / total) * 100)}%)
                </Text>
              ) : null}
            </View>

            {total > 0 ? (
              <>
                <View className="gap-3">
                  <Text className="font-sans-semibold text-sm text-text">By category</Text>
                  <BarList rows={byCategory} currency={currency} />
                </View>
                <View className="gap-3">
                  <Text className="font-sans-semibold text-sm text-text">By group</Text>
                  <BarList rows={byGroup} currency={currency} />
                </View>
              </>
            ) : (
              <Text className="text-center font-sans text-sm text-muted">Nothing in this period.</Text>
            )}

            <View className="gap-3">
              <Text className="font-sans-semibold text-sm text-text">Last 6 months</Text>
              <MonthBars months={monthBars} currency={currency} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
