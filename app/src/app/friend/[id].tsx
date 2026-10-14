import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BalanceHero } from "@/components/Balance";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// S10 — Friend detail
export default function FriendDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getUser, getFriendExpenses, getFriendPayments, getFriendBalance, currentUser, getGroup } = useData();

  const friend = getUser(id);
  if (!friend) return null;

  const expenses = getFriendExpenses(friend.id).filter((e) => !e.deletedAt);
  const paymentsList = getFriendPayments(friend.id);
  const balance = getFriendBalance(friend.id);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">{friend.name}</Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6 pb-10">
        {/* Profile-style header: identity first, balance as a stat under the
            name, action as a clear standalone CTA — not a number-plus-button
            crammed into one small bordered box. */}
        <View className="items-center gap-4 pt-2">
          <Avatar id={friend.id} name={friend.name} size="xl" />
          <View className="items-center gap-1">
            <Text className="font-display text-lg text-text">{friend.name}</Text>
            {balance !== 0 ? (
              <BalanceHero state={balance > 0 ? "owed-to-you" : "you-owe"} amount={formatCents(Math.abs(balance), "INR")} />
            ) : (
              <BalanceHero state="settled" />
            )}
          </View>
          {balance !== 0 ? <Button label="Settle up" size="lg" onPress={() => router.push(`/settle/${friend.id}`)} /> : null}
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

        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Payments</Text>
          {paymentsList.length === 0 ? (
            <EmptyState icon="check-circle" title="No payments yet" body="Settle up and it'll show up here." />
          ) : (
            paymentsList.map((p) => {
              const iPaid = p.fromUserId === currentUser.id;
              const group = p.groupId ? getGroup(p.groupId) : undefined;
              const cancelled = p.status === "cancelled";
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/payment/${p.id}`)}
                  accessibilityRole="button"
                  className="flex-row items-center justify-between border-b border-border py-3"
                >
                  <View className="flex-1">
                    <Text className={`font-sans-medium text-sm ${cancelled ? "text-muted line-through" : "text-text"}`}>
                      {iPaid ? `You paid ${friend.name}` : `${friend.name} paid you`}
                    </Text>
                    <Text className="font-sans text-xs text-muted">
                      {group ? `${group.name} · ` : ""}
                      {p.createdAt.slice(0, 10)}
                      {cancelled ? " · cancelled" : ""}
                    </Text>
                  </View>
                  <Text className={`font-sans-semibold text-sm ${cancelled ? "text-muted" : iPaid ? "text-danger" : "text-success"}`}>
                    {formatCents(p.amountCents, p.currencyCode)}
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
