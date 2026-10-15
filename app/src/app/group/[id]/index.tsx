import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BalanceStack } from "@/components/Balance";
import { Button } from "@/components/Button";
import { prettyDate } from "@/components/DateField";
import { EmptyState } from "@/components/EmptyState";
import { LedgerRow } from "@/components/LedgerRow";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import type { Group, Transfer } from "@/lib/data/types";
import { firstName, groupExpenseRow, newestFirst, paymentRow } from "@/lib/ledger";
import { goBack } from "@/lib/nav";
import { groupSummaryMessage, reminderMessage, sendViaWhatsApp } from "@/lib/reminders";

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
};

/** Trip progress from the group's dates: which day, how many days, spent per person per day. */
function tripStats(group: Group, totalSpentCents: number, people: number) {
  if (!group.startDate) return null;
  const today = Math.floor(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / DAY_MS);
  const start = dayNumber(group.startDate);
  const end = group.endDate ? dayNumber(group.endDate) : undefined;
  const totalDays = end !== undefined ? end - start + 1 : undefined;
  const daysSoFar = Math.max(1, Math.min(today, end ?? today) - start + 1);
  const status =
    today < start
      ? `Starts in ${start - today} day${start - today === 1 ? "" : "s"}`
      : end !== undefined && today > end
        ? "Trip ended"
        : totalDays
          ? `Day ${today - start + 1} of ${totalDays}`
          : `Day ${today - start + 1}`;
  return {
    status,
    perPersonPerDay: today < start ? 0 : Math.round(totalSpentCents / Math.max(people, 1) / daysSoFar),
  };
}

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
    getGroupKitty,
    getUser,
    currentUser,
    sendReminder,
  } = useData();
  const [notice, setNotice] = useState<string | undefined>();

  const group = getGroup(id);
  if (!group) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <Text className="font-sans text-sm text-muted">Group not found.</Text>
      </SafeAreaView>
    );
  }

  const currency = group.defaultCurrency;
  const members = listGroupMembers(group.id).filter((m) => !m.isKitty);
  const kitty = getGroupKitty(group.id);
  const liveExpenses = getGroupExpenses(group.id).filter((e) => !e.deletedAt);
  // Every amount on the right is what the line means for you ("₹425 · you
  // lent"), and payments are listed too, so the balance above can be traced.
  const expenseRows = newestFirst(liveExpenses.map((e) => ({ ...groupExpenseRow(e, currentUser.id, getUser), id: e.id })));
  const paymentRows = newestFirst(getGroupPayments(group.id).map((p) => ({ ...paymentRow(p, currentUser.id, getUser), id: p.id })));
  const balances = getGroupBalances(group.id);
  const transfers = getGroupTransfers(group.id);
  const mine = balances.find((b) => b.userId === currentUser.id);
  const myTransfers = transfers.filter((t) => t.from === currentUser.id || t.to === currentUser.id);
  const kittyCash = kitty ? -(balances.find((b) => b.userId === kitty.id)?.balanceCents ?? 0) : 0;
  const totalSpent = liveExpenses.reduce((s, e) => s + e.amountCents, 0);
  const trip = group.groupType === "trip" ? tripStats(group, totalSpent, members.length) : null;

  const nameOf = (userId: string) => {
    if (userId === currentUser.id) return "You";
    const u = getUser(userId);
    return u?.isKitty ? "Kitty" : firstName(u);
  };

  const settle = (t: Transfer) => {
    const counterpartId = t.from === currentUser.id ? t.to : t.from;
    router.push(`/settle/${counterpartId}?groupId=${group.id}&amount=${t.amountCents}`);
  };

  // in-app/push nudge + a WhatsApp message they can't miss
  const remind = async (t: Transfer) => {
    const debtor = getUser(t.from);
    if (!debtor) return;
    setNotice(undefined);
    try {
      const res = await sendReminder(debtor.id, t.amountCents, t.currencyCode);
      setNotice(res === "too_soon" ? `${firstName(debtor)} was already reminded today.` : `Reminder sent to ${firstName(debtor)}.`);
    } catch {
      // the WhatsApp message below still goes out
    }
    sendViaWhatsApp(reminderMessage(currentUser, debtor, t.amountCents, t.currencyCode, group.name), debtor.phone);
  };

  const shareSummary = () => {
    const extra = [
      `Total spent: ${formatCents(totalSpent, currency)}`,
      ...(kitty ? [`Kitty: ${formatCents(kittyCash, currency)} left`] : []),
    ];
    sendViaWhatsApp(groupSummaryMessage(group.name, transfers, getUser, extra));
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between gap-3 border-b border-border p-4">
        <View className="flex-1 flex-row items-center gap-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
            <Feather name="arrow-left" size={22} className="text-text" />
          </Pressable>
          <Text numberOfLines={1} className="flex-1 font-display text-lg text-text">
            {group.name}
          </Text>
        </View>
        <View className="shrink-0 flex-row items-center gap-4">
          <Pressable accessibilityRole="button" accessibilityLabel="Share balances on WhatsApp" onPress={shareSummary}>
            <Feather name="share-2" size={20} className="text-text" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Totals and charts" onPress={() => router.push(`/group/${group.id}/totals`)}>
            <Feather name="bar-chart-2" size={20} className="text-text" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Group settings" onPress={() => router.push(`/group/${group.id}/settings`)}>
            <Feather name="settings" size={20} className="text-text" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6 pb-28">
        {trip ? (
          <View className="gap-3 rounded-lg border border-border p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Feather name="map-pin" size={16} className="text-accent" />
                <Text className="font-sans-semibold text-sm text-text">{trip.status}</Text>
              </View>
              <Text className="font-sans text-xs text-muted">
                {prettyDate(group.startDate!)}
                {group.endDate ? ` – ${prettyDate(group.endDate)}` : ""}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <View>
                <Text className="font-sans text-xs text-muted">Total spent</Text>
                <Text className="font-sans-semibold text-base text-text">{formatCents(totalSpent, currency)}</Text>
              </View>
              <View className="items-end">
                <Text className="font-sans text-xs text-muted">Per person / day</Text>
                <Text className="font-sans-semibold text-base text-text">{formatCents(trip.perPersonPerDay, currency)}</Text>
              </View>
            </View>
            {group.budgetCents ? (
              <View className="gap-1">
                <View className="h-2 overflow-hidden rounded-pill bg-surface">
                  <View
                    className={`h-2 rounded-pill ${totalSpent > group.budgetCents ? "bg-danger" : "bg-accent"}`}
                    style={{ width: `${Math.min(100, (totalSpent / group.budgetCents) * 100)}%` }}
                  />
                </View>
                <Text className={`font-sans text-xs ${totalSpent > group.budgetCents ? "text-danger" : "text-muted"}`}>
                  {totalSpent > group.budgetCents
                    ? `${formatCents(totalSpent - group.budgetCents, currency)} over the ${formatCents(group.budgetCents, currency)} budget`
                    : `${formatCents(group.budgetCents - totalSpent, currency)} left of ${formatCents(group.budgetCents, currency)} budget`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View className="gap-3 rounded-lg border border-border bg-surface p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-sm text-muted">Your balance</Text>
            <View testID="group-balance">
              {mine ? (
                <BalanceStack
                  state={mine.balanceCents > 0 ? "owed-to-you" : "you-owe"}
                  amount={formatCents(Math.abs(mine.balanceCents), currency)}
                />
              ) : (
                <BalanceStack state="settled" />
              )}
            </View>
          </View>

          {transfers.length > 0 ? (
            <View className="gap-2 border-t border-border pt-3">
              <Text className="font-sans-medium text-xs text-muted">
                {group.simplifyDebts ? "To settle up (simplified to the fewest payments)" : "To settle up"}
              </Text>
              {transfers.map((t) => {
                const involvesMe = t.from === currentUser.id || t.to === currentUser.id;
                const owesMe = t.to === currentUser.id && !getUser(t.from)?.isKitty;
                return (
                  <View key={`${t.from}>${t.to}`} className="flex-row items-center gap-2">
                    <Text
                      className={`flex-1 font-sans text-sm ${
                        t.to === currentUser.id ? "text-success" : t.from === currentUser.id ? "text-danger" : "text-text"
                      }`}
                    >
                      {t.to === currentUser.id
                        ? `${nameOf(t.from)} owes you `
                        : t.from === currentUser.id
                          ? `You owe ${nameOf(t.to)} `
                          : `${nameOf(t.from)} owes ${nameOf(t.to)} `}
                      <Text className="font-sans-semibold">{formatCents(t.amountCents, t.currencyCode)}</Text>
                    </Text>
                    {owesMe ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remind ${nameOf(t.from)}`}
                        onPress={() => remind(t)}
                        className="rounded-pill px-2 py-1"
                      >
                        <Text className="font-sans-semibold text-xs text-accent">Remind</Text>
                      </Pressable>
                    ) : null}
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
              {notice ? <Text className="font-sans text-xs text-success">{notice}</Text> : null}
            </View>
          ) : null}

          <View className="flex-row -space-x-2">
            {members.map((m) => (
              <Avatar key={m.id} id={m.id} name={m.name} size="sm" />
            ))}
          </View>

          {myTransfers.length > 0 ? <Button label="Settle up" onPress={() => settle(myTransfers[0])} /> : null}
        </View>

        {kitty ? (
          <View className="flex-row items-center gap-3 rounded-lg border border-border p-4">
            <View className="h-10 w-10 items-center justify-center rounded-pill bg-accent/10">
              <Feather name="archive" size={18} className="text-accent" />
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-sm text-text">Kitty</Text>
              <Text className="font-sans text-xs text-muted">{formatCents(Math.max(kittyCash, 0), currency)} left in the pool</Text>
            </View>
            <Pressable
              onPress={() => router.push(`/settle/${kitty.id}?groupId=${group.id}&kitty=in`)}
              accessibilityRole="button"
              className="rounded-pill bg-accent px-3 py-1.5"
            >
              <Text className="font-sans-semibold text-xs text-on-accent">Add money</Text>
            </Pressable>
          </View>
        ) : null}

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
        <Feather name="plus" size={26} className="text-on-accent" />
      </Pressable>
    </SafeAreaView>
  );
}
