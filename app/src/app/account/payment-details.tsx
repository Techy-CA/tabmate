import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// Lets a user publish their own UPI/PayPal/Venmo handle so friends can pay
// them with a prefilled one-tap link from Settle Up — never used to move
// money through the app itself, just a shortcut to the app they'd use anyway.
export default function PaymentDetails() {
  const router = useRouter();
  const { currentUser, updateCurrentUser } = useData();
  const [upiId, setUpiId] = useState(currentUser.upiId ?? "");
  const [paypalMeHandle, setPaypalMeHandle] = useState(currentUser.paypalMeHandle ?? "");
  const [venmoUsername, setVenmoUsername] = useState(currentUser.venmoUsername ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    await updateCurrentUser({
      upiId: upiId.trim(),
      paypalMeHandle: paypalMeHandle.trim(),
      venmoUsername: venmoUsername.trim(),
    });
    setSaving(false);
    setSaved(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/account")}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Payment details</Text>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6">
        <Text className="font-sans text-sm text-muted">
          Add any of these and friends settling up with you get a one-tap button straight to that
          app, prefilled with the amount. Tabmate still never touches the money itself — this just
          saves the trip to find your handle each time.
        </Text>

        <Input
          label="UPI ID"
          placeholder="yourname@upi"
          value={upiId}
          onChangeText={(t) => {
            setUpiId(t);
            setSaved(false);
          }}
          autoCapitalize="none"
        />
        <Input
          label="PayPal.me username"
          placeholder="yourname"
          value={paypalMeHandle}
          onChangeText={(t) => {
            setPaypalMeHandle(t);
            setSaved(false);
          }}
          autoCapitalize="none"
        />
        <Input
          label="Venmo username"
          placeholder="yourname"
          value={venmoUsername}
          onChangeText={(t) => {
            setVenmoUsername(t);
            setSaved(false);
          }}
          autoCapitalize="none"
        />

        {saved ? <Text className="font-sans text-sm text-success">Saved.</Text> : null}
        <Button label="Save" size="lg" loading={saving} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}
