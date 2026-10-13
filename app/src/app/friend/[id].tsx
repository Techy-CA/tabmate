import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BalanceChip } from "@/components/BalanceChip";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// S10 — Friend detail
export default function FriendDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getUser, getFriendExpenses, getFriendBalance, currentUser, getGroup } = useData();

  const friend = getUser(id);
  if (!friend) return null;

  const expenses = getFriendExpenses(friend.id).filter((e) => !e.deletedAt);
  const balance = getFriendBalance(friend.id);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Avatar id={friend.id} name={friend.name} size="sm" />
        <Text className="font-display text-lg text-text">{friend.name}</Text>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6 pb-10">
        <View className="items-center gap-3 rounded-lg border border-border bg-surface p-5">
          {balance !== 0 ? (
            <BalanceChip state={balance > 0 ? "owed-to-you" : "you-owe"} amount={formatCents(Math.abs(balance), "INR")} />
          ) : (
            <BalanceChip state="settled" />
          )}
          {balance < 0 ? (
            <Button label={`Settle up with ${friend.name}`} onPress={() => router.push(`/settle/${friend.id}`)} />
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Shared expenses</Text>
          {expenses.length === 0 ? (
            <EmptyState icon="inbox" title="Nothing shared yet" body="Split an expense together and it'll show up here." />
          ) : (
            expenses.map((e) => {
              const mine = e.shares.find((s) => s.userId === currentUser.id);
              const group = e.groupId ? getGroup(e.groupId) : undefined;
              return (
                <Pressable
                  key={e.id}
                  onPress={() => router.push(`/expense/${e.id}`)}
                  accessibilityRole="button"
                  className="flex-row items-center justify-between border-b border-border py-3"
                >
                  <View className="flex-1">
                    <Text className="font-sans-medium text-sm text-text">{e.description}</Text>
                    <Text className="font-sans text-xs text-muted">
                      {group ? `${group.name} · ` : ""}
                      {e.expenseDate}
                    </Text>
                  </View>
                  <Text
                    className={`font-sans-semibold text-sm ${
                      (mine?.paidCents ?? 0) - (mine?.owedCents ?? 0) >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatCents(e.amountCents, e.currencyCode)}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
