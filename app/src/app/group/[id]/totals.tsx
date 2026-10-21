import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BarList, categoryLabel, lastMonths, MonthBars } from "@/components/Charts";
import { EmptyState } from "@/components/EmptyState";
import { SegmentedControl } from "@/components/SegmentedControl";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

type RangeOption = "this_month" | "last_month" | "all_time";

const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "all_time", label: "All time" },
];

// UTC first/last day of the month `offset` months from today, as "YYYY-MM-DD"
// strings — expenseDate is already stored that way, so bounds compare directly.
function monthBounds(offset: number) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

// S14 — Totals
export default function Totals() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getGroup, listGroupMembers, getGroupExpenses } = useData();
  const [range, setRange] = useState<RangeOption>("this_month");

  const group = getGroup(id);
  if (!group) return null;

  const members = listGroupMembers(group.id).filter((m) => !m.isKitty);
  const allExpenses = getGroupExpenses(group.id).filter((e) => !e.deletedAt);

  let expenses = allExpenses;
  if (range !== "all_time") {
    const { start, end } = monthBounds(range === "this_month" ? 0 : -1);
    expenses = allExpenses.filter((e) => e.expenseDate >= start && e.expenseDate <= end);
  }

  const totalSpent = expenses.reduce((s, e) => s + e.amountCents, 0);

  const byCategory = [...expenses.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amountCents), new Map<string, number>())]
    .map(([c, cents]) => ({ key: c, label: categoryLabel(c), cents }))
    .sort((a, b) => b.cents - a.cents);
  const months = lastMonths(6).map((m) => ({
    ...m,
    cents: allExpenses.filter((e) => e.expenseDate.startsWith(m.key)).reduce((s, e) => s + e.amountCents, 0),
  }));

  const perMember = members.map((m) => {
    const paid = expenses.reduce((s, e) => s + (e.shares.find((sh) => sh.userId === m.id)?.paidCents ?? 0), 0);
    const owed = expenses.reduce((s, e) => s + (e.shares.find((sh) => sh.userId === m.id)?.owedCents ?? 0), 0);
    return { user: m, paid, owed };
  });

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, `/group/${id}`)}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">Totals</Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="items-center gap-4">
          <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
          <View className="items-center gap-1">
            <Text className="font-sans text-sm text-muted">Total group spending</Text>
            <Text className="font-display text-display text-text">{formatCents(totalSpent, group.defaultCurrency)}</Text>
            <Text className="font-sans text-xs text-muted">{expenses.length} expenses</Text>
          </View>
        </View>

        {expenses.length === 0 ? (
          <EmptyState icon="bar-chart-2" title="Nothing in this period" body="Try a different range, or add an expense." />
        ) : (
          <View className="gap-6">
            <View className="gap-3">
              <Text className="font-sans-semibold text-sm text-text">By category</Text>
              <BarList rows={byCategory} currency={group.defaultCurrency} />
            </View>
            <View className="gap-3">
              <Text className="font-sans-semibold text-sm text-text">Last 6 months</Text>
              <MonthBars months={months} currency={group.defaultCurrency} />
            </View>
            <Text className="font-sans-semibold text-sm text-text">By person</Text>
            {perMember.map(({ user, paid, owed }) => (
              <View key={user.id} className="gap-1 rounded-lg border border-border p-3">
                <View className="flex-row items-center gap-2">
                  <Avatar id={user.id} name={user.name} size="xs" />
                  <Text className="font-sans-semibold text-sm text-text">{user.name}</Text>
                </View>
                <Text className="font-sans text-xs text-muted">
                  Paid {formatCents(paid, group.defaultCurrency)} · their share {formatCents(owed, group.defaultCurrency)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
