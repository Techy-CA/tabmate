import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// S14 — Totals
export default function Totals() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getGroup, listGroupMembers, getGroupExpenses } = useData();

  const group = getGroup(id);
  if (!group) return null;

  const members = listGroupMembers(group.id);
  const expenses = getGroupExpenses(group.id).filter((e) => !e.deletedAt);
  const totalSpent = expenses.reduce((s, e) => s + e.amountCents, 0);

  const perMember = members.map((m) => {
    const paid = expenses.reduce((s, e) => s + (e.shares.find((sh) => sh.userId === m.id)?.paidCents ?? 0), 0);
    const owed = expenses.reduce((s, e) => s + (e.shares.find((sh) => sh.userId === m.id)?.owedCents ?? 0), 0);
    return { user: m, paid, owed };
  });

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, `/group/${id}`)}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Totals</Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="items-center gap-1">
          <Text className="font-sans text-sm text-muted">Total group spending</Text>
          <Text className="font-display text-display text-text">{formatCents(totalSpent, group.defaultCurrency)}</Text>
          <Text className="font-sans text-xs text-muted">{expenses.length} expenses</Text>
        </View>

        <View className="gap-3">
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
      </ScrollView>
    </SafeAreaView>
  );
}
