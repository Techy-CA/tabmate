import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BalanceStack } from "@/components/Balance";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

const CATEGORY_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  rent: "home",
  groceries: "shopping-cart",
  utilities: "zap",
  travel: "map-pin",
  food: "coffee",
  general: "file-text",
};

// S05 — Group detail
export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getGroup, listGroupMembers, getGroupExpenses, getGroupBalances, getSimplifiedTransfers, getUser, currentUser } =
    useData();

  const group = getGroup(id);
  if (!group) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <Text className="font-sans text-sm text-muted">Group not found.</Text>
      </SafeAreaView>
    );
  }

  const members = listGroupMembers(group.id);
  const expenses = getGroupExpenses(group.id).filter((e) => !e.deletedAt);
  const balances = getGroupBalances(group.id);
  const transfers = group.simplifyDebts ? getSimplifiedTransfers(group.id) : [];
  const mine = balances.find((b) => b.userId === currentUser.id);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between border-b border-border p-4">
        <View className="flex-row items-center gap-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
            <Feather name="arrow-left" size={22} color="#1f2430" />
          </Pressable>
          <Text className="font-display text-lg text-text">{group.name}</Text>
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Totals"
            onPress={() => router.push(`/group/${group.id}/totals`)}
          >
            <Feather name="bar-chart-2" size={20} color="#1f2430" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Group settings"
            onPress={() => router.push(`/group/${group.id}/settings`)}
          >
            <Feather name="settings" size={20} color="#1f2430" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6 pb-28">
        <View className="gap-3 rounded-lg border border-border bg-surface p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-sm text-muted">Your balance</Text>
            <View testID="group-balance">
              {mine ? (
                <BalanceStack
                  state={mine.balanceCents > 0 ? "owed-to-you" : "you-owe"}
                  amount={formatCents(Math.abs(mine.balanceCents), group.defaultCurrency)}
                />
              ) : (
                <BalanceStack state="settled" />
              )}
            </View>
          </View>

          {transfers.length > 0 ? (
            <View className="gap-1.5 border-t border-border pt-3">
              <Text className="font-sans-medium text-xs text-muted">Simplified: fewest payments to settle up</Text>
              {transfers.map((t, i) => (
                <View key={i} className="flex-row items-center gap-2">
                  <Text className="font-sans text-sm text-text">{getUser(t.from)?.name}</Text>
                  <Feather name="arrow-right" size={14} color="#6b7280" />
                  <Text className="font-sans text-sm text-text">{getUser(t.to)?.name}</Text>
                  <Text className="font-sans-medium text-sm text-text">
                    {formatCents(t.amountCents, t.currencyCode)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View className="flex-row -space-x-2">
            {members.map((m) => (
              <Avatar key={m.id} id={m.id} name={m.name} size="sm" />
            ))}
          </View>

          {mine && mine.balanceCents < 0 ? (
            <Button
              label="Settle up"
              onPress={() => {
                const creditor = transfers.find((t) => t.from === currentUser.id);
                const toId = creditor?.to ?? balances.find((b) => b.balanceCents > 0)?.userId;
                if (toId) router.push(`/settle/${toId}?groupId=${group.id}`);
              }}
            />
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Expenses</Text>
          {expenses.length === 0 ? (
            <EmptyState icon="inbox" title="No expenses yet" body="Add the first shared cost for this group." />
          ) : (
            expenses.map((e) => {
              const mineShare = e.shares.find((s) => s.userId === currentUser.id);
              const payer = e.shares.find((s) => s.paidCents > 0);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => router.push(`/expense/${e.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.description}, ${formatCents(e.amountCents, e.currencyCode)}, paid by ${
                    getUser(payer?.userId ?? "")?.name ?? "someone"
                  }`}
                  className="flex-row items-center gap-3 border-b border-border py-3"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-sm bg-surface">
                    <Feather name={CATEGORY_ICON[e.category] ?? "file-text"} size={18} color="#6b7280" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-medium text-sm text-text">{e.description}</Text>
                    <Text className="font-sans text-xs text-muted">
                      {getUser(payer?.userId ?? "")?.name ?? "Someone"} paid · {e.expenseDate}
                      {e.repeatInterval !== "none" ? " · repeats" : ""}
                    </Text>
                  </View>
                  <Text
                    className={`font-sans-semibold text-sm ${
                      (mineShare?.paidCents ?? 0) - (mineShare?.owedCents ?? 0) >= 0 ? "text-success" : "text-danger"
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add expense to this group"
        onPress={() => router.push(`/expense/add?groupId=${group.id}`)}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-pill bg-accent shadow-pop"
      >
        <Feather name="plus" size={26} color="#ffffff" />
      </Pressable>
    </SafeAreaView>
  );
}
