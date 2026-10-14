import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";
import { buildPaymentLinks } from "@/lib/paymentLinks";

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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();
  const [doneProgress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (done) {
      Animated.timing(doneProgress, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [done, doneProgress]);

  if (!counterpart) return null;
  const amountCents = Math.round((parseFloat(amountText || "0") || 0) * 100);
  const payLinks = iOwe ? buildPaymentLinks(counterpart, amountCents) : [];

  const fallbackHref = groupId ? (`/group/${groupId}` as const) : (`/friend/${counterpartId}` as const);

  const confirm = async () => {
    // Only shows the success screen once the payment is actually saved — a
    // real financial action, so "setDone" can't fire ahead of confirmation.
    setSaving(true);
    setSaveError(undefined);
    try {
      await createPayment({
        groupId,
        fromUserId: iOwe ? currentUser.id : counterpart.id,
        toUserId: iOwe ? counterpart.id : currentUser.id,
        amountCents,
        currencyCode: "INR",
      });
    } catch {
      setSaving(false);
      setSaveError("Couldn't save that — check your connection and try again.");
      return;
    }
    setSaving(false);
    setDone(true);
  };

  if (done) {
    const scale = doneProgress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg p-6">
        {/* The Animated.View carries style only, never className: mixing an
            animated inline style with a NativeWind className on the same
            Animated.View drops utility classes unpredictably on web (the
            same issue already fixed once in Toggle.tsx) — here it silently
            dropped "items-center", so every child fell back to flexbox's
            default stretch/left-alignment instead of centering. All layout
            classes live on the plain View one level in instead. */}
        <Animated.View style={{ opacity: doneProgress, transform: [{ scale }] }}>
          <View className="items-center gap-6">
            <View className="h-20 w-20 items-center justify-center rounded-pill bg-success/10">
              <Feather name="check" size={36} color="#15803d" />
            </View>

            <View className="items-center gap-1">
              <Text className="font-display text-xl text-text">All squared away</Text>
              <Text className="font-sans text-sm text-muted">with {counterpart.name}</Text>
            </View>

            <Text className="font-display text-display text-success">{formatCents(amountCents, "INR")}</Text>

            <Button label="Done" onPress={() => goBack(router, fallbackHref)} />
          </View>
        </Animated.View>
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
            ? `This just logs that you paid ${counterpart.name} outside the app (cash, bank transfer, UPI). Tabmate doesn't move any money itself.`
            : `This just logs that ${counterpart.name} paid you outside the app. Tabmate doesn't move any money itself.`}
        </Text>

        {payLinks.length > 0 ? (
          <View className="gap-2">
            <Text className="font-sans-semibold text-sm text-text">Pay directly</Text>
            <View className="flex-row flex-wrap gap-2">
              {payLinks.map((link) => (
                <Pressable
                  key={link.label}
                  onPress={() => Linking.openURL(link.url).catch(() => {})}
                  accessibilityRole="button"
                  className="flex-row items-center gap-2 rounded-pill border border-border px-3 py-2"
                >
                  <Feather name={link.icon} size={14} color="#5b5fef" />
                  <Text className="font-sans-medium text-sm text-text">{link.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="font-sans text-xs text-muted">
              Opens {counterpart.name}&apos;s payment app with the amount filled in. Still tap Confirm below once you&apos;ve actually paid.
            </Text>
          </View>
        ) : null}

        {saveError ? <Text className="font-sans text-sm text-danger">{saveError}</Text> : null}
        <Button label="Confirm" size="lg" disabled={amountCents <= 0} loading={saving} onPress={confirm} />
      </View>
    </SafeAreaView>
  );
}
