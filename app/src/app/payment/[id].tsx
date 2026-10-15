import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { formatCents } from "@/lib/data/balances";
import { confirmAction } from "@/lib/confirm";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// A settle-up record's edit screen — the equivalent of expense/[id].tsx for
// payments. There's nothing to change about a past payment except whether it
// still counts (cancel it), since it has no description or split to adjust.
export default function PaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getPayment, getUser, getGroup, getFriendPayments, currentUser, cancelPayment } = useData();
  const [actionError, setActionError] = useState<string | undefined>();

  const payment = getPayment(id);
  if (!payment) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <Text className="font-sans text-sm text-muted">Payment not found.</Text>
        <Button label="Go back" variant="ghost" onPress={() => goBack(router, "/")} />
      </SafeAreaView>
    );
  }

  const iPaid = payment.fromUserId === currentUser.id;
  const counterpartId = iPaid ? payment.toUserId : payment.fromUserId;
  const counterpart = getUser(counterpartId);
  const group = payment.groupId ? getGroup(payment.groupId) : undefined;
  const cancelled = payment.status === "cancelled";
  // One settle-up split across groups is several rows sharing a batchId;
  // show and cancel it as the single payment the user recorded.
  const pieces = payment.batchId
    ? getFriendPayments(counterpartId).filter((p) => p.batchId === payment.batchId)
    : [payment];
  const totalCents = pieces.reduce((sum, p) => sum + p.amountCents, 0);

  const confirmCancel = () => {
    confirmAction({
      title: "Cancel this payment?",
      message:
        pieces.length > 1
          ? "The whole payment stops counting, in every group it was applied to. This can't be undone from here."
          : "It'll stop counting toward your balance. This can't be undone from here.",
      confirmLabel: "Cancel payment",
      destructive: true,
      onConfirm: async () => {
        setActionError(undefined);
        try {
          await cancelPayment(payment.id);
        } catch (e) {
          setActionError(e instanceof Error ? e.message : "Couldn't cancel the payment.");
        }
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between border-b border-border p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => goBack(router, counterpart ? `/friend/${counterpart.id}` : "/")}
        >
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Payment</Text>
        <View className="w-6" />
      </View>

      <View className="gap-6 p-6">
        {actionError ? <Text className="font-sans text-sm text-danger">{actionError}</Text> : null}
        {cancelled ? (
          <View className="rounded-lg bg-danger/10 p-3">
            <Text className="font-sans-medium text-sm text-danger">
              This payment was cancelled. It no longer counts toward any balance.
            </Text>
          </View>
        ) : null}

        <View className="items-center gap-2">
          {counterpart ? <Avatar id={counterpart.id} name={counterpart.name} size="lg" /> : null}
          <Text className={`font-display text-display ${cancelled ? "text-muted" : "text-text"}`}>
            {formatCents(totalCents, payment.currencyCode)}
          </Text>
          <Text className="font-sans text-sm text-muted">
            {iPaid ? `You paid ${counterpart?.name ?? "someone"}` : `${counterpart?.name ?? "Someone"} paid you`}
          </Text>
        </View>

        <View className="gap-2 rounded-lg border border-border p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-sm text-muted">Date</Text>
            <Text className="font-sans-medium text-sm text-text">{payment.createdAt.slice(0, 10)}</Text>
          </View>
          {pieces.length > 1 ? (
            <View className="gap-1 border-t border-border pt-2">
              <Text className="font-sans text-sm text-muted">Applied to</Text>
              {pieces.map((p) => (
                <View key={p.id} className="flex-row items-center justify-between">
                  <Text className="font-sans text-sm text-text">{p.groupId ? getGroup(p.groupId)?.name ?? "A group" : "Non-group"}</Text>
                  <Text className="font-sans-medium text-sm text-text">{formatCents(p.amountCents, p.currencyCode)}</Text>
                </View>
              ))}
            </View>
          ) : group ? (
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-sm text-muted">Group</Text>
              <Text className="font-sans-medium text-sm text-text">{group.name}</Text>
            </View>
          ) : null}
        </View>

        {!cancelled ? <Button label="Cancel this payment" variant="danger" onPress={confirmCancel} /> : null}
      </View>
    </SafeAreaView>
  );
}
