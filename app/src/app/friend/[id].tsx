import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BalanceHero } from "@/components/Balance";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LedgerRow } from "@/components/LedgerRow";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { friendExpenseRow, newestFirst, paymentRow } from "@/lib/ledger";
import { inviteMessage, sendInvite } from "@/lib/invite";
import { goBack } from "@/lib/nav";
import { reminderMessage, sendViaWhatsApp } from "@/lib/reminders";

// S10 — Friend detail. The whole page is about this one friend, so nothing
// below the header repeats their name: "owes you" / "you owe" is enough.
// Every amount is what's between the two of you — an ₹850 lunch split two
// ways shows ₹425 — and the breakdown card matches each group's own screen.
export default function FriendDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getUser, getFriendExpenses, getFriendPayments, getFriendBalance, getFriendBalanceByContext, currentUser, getGroup, sendReminder } =
    useData();

  const [notice, setNotice] = useState<string | undefined>();
  const friend = getUser(id);
  if (!friend) return null;

  const me = currentUser.id;
  const currency = currentUser.defaultCurrency;
  const balance = getFriendBalance(friend.id);

  const byContext = [...getFriendBalanceByContext(friend.id).entries()]
    .map(([ctx, cents]) => ({ ctx, label: ctx ? getGroup(ctx)?.name ?? "Group" : "Non-group", cents }))
    // groups first (largest first), non-group last
    .sort((a, b) => (a.ctx === "" ? 1 : b.ctx === "" ? -1 : Math.abs(b.cents) - Math.abs(a.cents)));

  const expenseRows = newestFirst(
    getFriendExpenses(friend.id)
      .filter((e) => !e.deletedAt)
      .map((e) => ({ ...friendExpenseRow(e, me, friend.id, e.groupId ? getGroup(e.groupId)?.name : undefined), id: e.id }))
  );
  const paymentRows = newestFirst(
    getFriendPayments(friend.id).map((p) => ({
      ...paymentRow(p, me, getUser, { friendView: true, contextName: p.groupId ? getGroup(p.groupId)?.name : undefined }),
      id: p.id,
    }))
  );

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text numberOfLines={1} className="flex-1 font-display text-lg text-text">
          {friend.name}
        </Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6 pb-10">
        <View className="items-center gap-4 pt-2">
          <Avatar id={friend.id} name={friend.name} size="xl" />
          <View className="items-center gap-1">
            <Text numberOfLines={2} className="text-center font-display text-lg text-text">
              {friend.name}
            </Text>
            {friend.isPending ? (
              <Text className="font-sans text-xs text-muted">Invited · not on Tabmate yet</Text>
            ) : null}
            {balance !== 0 ? (
              <BalanceHero
                state={balance > 0 ? "owed-to-you" : "you-owe"}
                amount={formatCents(Math.abs(balance), currency)}
                label={balance > 0 ? "owes you" : "you owe"}
              />
            ) : (
              <BalanceHero state="settled" />
            )}
          </View>
          {balance !== 0 ? (
            <View className="flex-row gap-3">
              <Button label="Settle up" size="lg" onPress={() => router.push(`/settle/${friend.id}`)} />
              {balance > 0 ? (
                <Button
                  label="Remind"
                  variant="secondary"
                  size="lg"
                  onPress={async () => {
                    setNotice(undefined);
                    if (!friend.isPending) {
                      try {
                        const res = await sendReminder(friend.id, balance, currency);
                        setNotice(res === "too_soon" ? "Already reminded today — sent on WhatsApp too." : "Reminder sent in Tabmate.");
                      } catch {
                        // WhatsApp below still goes out
                      }
                    }
                    sendViaWhatsApp(reminderMessage(currentUser, friend, balance, currency), friend.phone);
                  }}
                />
              ) : null}
            </View>
          ) : null}
          {notice ? <Text className="font-sans text-xs text-success">{notice}</Text> : null}
          {friend.isPending && (friend.phone || friend.email) ? (
            <Button
              label="Send invite again"
              variant="secondary"
              onPress={() => sendInvite(inviteMessage(currentUser.name, friend.email || friend.phone || ""), friend.phone)}
            />
          ) : null}
        </View>

        {/* Where the total comes from — only when there's more than one
            place, or it's all from a group (then the group name explains it). */}
        {byContext.length > 1 || (byContext.length === 1 && byContext[0].ctx !== "") ? (
          <View className="gap-2 rounded-lg border border-border bg-surface p-4">
            {byContext.map((c) => (
              <Pressable
                key={c.ctx || "non-group"}
                disabled={!c.ctx}
                onPress={() => router.push(`/group/${c.ctx}`)}
                accessibilityRole={c.ctx ? "button" : undefined}
                className="flex-row items-center justify-between"
              >
                <Text className="font-sans text-sm text-text">{c.label}</Text>
                <Text className={`font-sans-medium text-sm ${c.cents > 0 ? "text-success" : "text-danger"}`}>
                  {c.cents > 0 ? "owes you" : "you owe"} {formatCents(Math.abs(c.cents), currency)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View>
          <Text className="pb-1 font-sans-semibold text-sm text-text">Shared expenses</Text>
          {expenseRows.length === 0 ? (
            <EmptyState icon="inbox" title="Nothing shared yet" body="Split an expense together and it'll show up here." />
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
    </SafeAreaView>
  );
}
