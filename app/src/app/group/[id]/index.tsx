import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BalanceStack } from "@/components/Balance";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LedgerRow } from "@/components/LedgerRow";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { firstName, groupExpenseRow, newestFirst, paymentRow } from "@/lib/ledger";
import { goBack } from "@/lib/nav";

// S05 — Group detail
export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    getGroup,
    listGroupMembers,
    getGroupExpenses,
    getGroupPayments,
    getGroupBalances,
    getGroupTransfers,
    getUser,
    currentUser,
  } = useData();

  const group = getGroup(id);
  if (!group) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <Text className="font-sans text-sm text-muted">Group not found.</Text>
      </SafeAreaView>
    );
  }

  const members = listGroupMembers(group.id);
  // Every amount on the right is what the line means for you ("₹425 · you
  // lent"), and payments are listed too, so the balance above can be traced:
  // lent ₹425, received ₹300 -> owed ₹125.
  const expenseRows = newestFirst(
    getGroupExpenses(group.id)
      .filter((e) => !e.deletedAt)
      .map((e) => ({ ...groupExpenseRow(e, currentUser.id, getUser), id: e.id }))
  );
  const paymentRows = newestFirst(getGroupPayments(group.id).map((p) => ({ ...paymentRow(p, currentUser.id, getUser), id: p.id })));
  const balances = getGroupBalances(group.id);
  const transfers = getGroupTransfers(group.id);
  const mine = balances.find((b) => b.userId === currentUser.id);
  // The transfers this user is part of — what Settle up offers, one person
  // at a time and for exactly what's owed between the two of them.
  const myTransfers = transfers.filter((t) => t.from === currentUser.id || t.to === currentUser.id);
  const settle = (t: (typeof transfers)[number]) => {
    const counterpartId = t.from === currentUser.id ? t.to : t.from;
    router.push(`/settle/${counterpartId}?groupId=${group.id}&amount=${t.amountCents}`);
  };

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
              <Text className="font-sans-medium text-xs text-muted">
                {group.simplifyDebts ? "To settle up (simplified to the fewest payments)" : "To settle up"}
              </Text>
              {transfers.map((t) => {
                const involvesMe = t.from === currentUser.id || t.to === currentUser.id;
                return (
                  <View key={`${t.from}>${t.to}`} className="flex-row items-center gap-2">
                    <Text
                      className={`flex-1 font-sans text-sm ${
                        t.to === currentUser.id ? "text-success" : t.from === currentUser.id ? "text-danger" : "text-text"
                      }`}
                    >
                      {t.to === currentUser.id
                        ? `${firstName(getUser(t.from))} owes you `
                        : t.from === currentUser.id
                          ? `You owe ${firstName(getUser(t.to))} `
                          : `${firstName(getUser(t.from))} owes ${firstName(getUser(t.to))} `}
                      <Text className="font-sans-semibold">{formatCents(t.amountCents, t.currencyCode)}</Text>
                    </Text>
                    {involvesMe ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Settle ${formatCents(t.amountCents, t.currencyCode)}`}
                        onPress={() => settle(t)}
                        className="rounded-pill border border-accent px-3 py-1"
                      >
                        <Text className="font-sans-semibold text-xs text-accent">Settle</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <View className="flex-row -space-x-2">
            {members.map((m) => (
              <Avatar key={m.id} id={m.id} name={m.name} size="sm" />
            ))}
          </View>

          {myTransfers.length > 0 ? (
            // Same action either direction — "pay someone" when you owe,
            // "record that someone paid you" when they owe you. With several
            // people involved, the Settle chips above pick a specific one.
            <Button label="Settle up" onPress={() => settle(myTransfers[0])} />
          ) : null}
        </View>

        <View>
          <Text className="pb-1 font-sans-semibold text-sm text-text">Expenses</Text>
          {expenseRows.length === 0 ? (
            <EmptyState icon="inbox" title="No expenses yet" body="Add the first shared cost for this group." />
          ) : (
            expenseRows.map(({ key, id: expenseId, sortKey: _sortKey, ...row }) => (
              <LedgerRow key={key} {...row} onPress={() => router.push(`/expense/${expenseId}`)} />
            ))
          )}
        </View>

        {paymentRows.length > 0 ? (
          <View>
            <Text className="pb-1 font-sans-semibold text-sm text-text">Payments</Text>
            {paymentRows.map(({ key, id: paymentId, sortKey: _sortKey, ...row }) => (
              <LedgerRow key={key} {...row} onPress={() => router.push(`/payment/${paymentId}`)} />
            ))}
          </View>
        ) : null}
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
