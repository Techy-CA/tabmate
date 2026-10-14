import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// S09 — Settle up. Tabmate only ever records a payment made outside the
// app (cash, bank transfer, UPI the user did themselves) — it's an expense
// tracker between friends, not a payment processor, so there's no
// in-app money movement to pick a method for.
export default function SettleUp() {
  const { counterpartId, groupId } = useLocalSearchParams<{ counterpartId: string; groupId?: string }>();
  const router = useRouter();
  const { getUser, getFriendBalance, getGroupBalances, currentUser, createPayment } = useData();

  const counterpart = getUser(counterpartId);
  const groupBalance = groupId ? getGroupBalances(groupId).find((b) => b.userId === currentUser.id) : undefined;
  // Positive = the group/friend owes the current user; negative = the current
  // user owes them. Settle Up has to handle both — the original's own help
  // text is "pay someone back OR record that you've been paid" (recon.md).
  const relevantBalanceCents = groupBalance ? groupBalance.balanceCents : getFriendBalance(counterpartId);
  const iOwe = relevantBalanceCents < 0;
  const suggestedCents = Math.abs(relevantBalanceCents);

  const [amountText, setAmountText] = useState((suggestedCents / 100).toFixed(2));
  const [done, setDone] = useState(false);

  if (!counterpart) return null;
  const amountCents = Math.round((parseFloat(amountText || "0") || 0) * 100);

  const fallbackHref = groupId ? (`/group/${groupId}` as const) : (`/friend/${counterpartId}` as const);

  const confirm = () => {
    createPayment({
      groupId,
      fromUserId: iOwe ? currentUser.id : counterpart.id,
      toUserId: iOwe ? counterpart.id : currentUser.id,
      amountCents,
      currencyCode: "INR",
    });
    setDone(true);
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-bg p-6">
        <Feather name="check-circle" size={48} color="#15803d" />
        <Text className="font-display text-lg text-text">All squared away</Text>
        <Text className="text-center font-sans text-sm text-muted">
          {formatCents(amountCents, "INR")} with {counterpart.name}.
        </Text>
        <Button label="Done" onPress={() => goBack(router, fallbackHref)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => goBack(router, fallbackHref)}>
          <Feather name="x" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Settle up</Text>
      </View>

      <View className="gap-6 p-6">
        <View className="items-center gap-2">
          <Avatar id={counterpart.id} name={counterpart.name} size="lg" />
          <Text className="font-sans text-sm text-muted">{iOwe ? "You paid" : "Record that you were paid by"}</Text>
          <Text className="font-sans-semibold text-base text-text">{counterpart.name}</Text>
        </View>

        <Input label="Amount" prefix="₹" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} />

        <Text className="font-sans text-sm text-muted">
          {iOwe
            ? `This just logs that you paid ${counterpart.name} outside the app (cash, bank transfer, UPI) — Tabmate doesn't move any money itself.`
            : `This just logs that ${counterpart.name} paid you outside the app — Tabmate doesn't move any money itself.`}
        </Text>

        <Button label="Confirm" size="lg" disabled={amountCents <= 0} onPress={confirm} />
      </View>
    </SafeAreaView>
  );
}
