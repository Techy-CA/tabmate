import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// Your own mobile number — lets friends add you by number and find you in
// their contacts. Saving it also connects you with anyone who already
// invited this number (handled server-side).
export default function EditPhone() {
  const router = useRouter();
  const { currentUser, updateCurrentUser } = useData();
  const [phone, setPhone] = useState(currentUser.phone ?? "");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const save = async (value: string) => {
    setSaving(true);
    setError(undefined);
    try {
      await updateCurrentUser({ phone: value.trim() });
      goBack(router, "/account");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => goBack(router, "/account")}>
          <Feather name="x" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Mobile number</Text>
      </View>

      <View className="gap-5 p-6">
        <Input
          label="Mobile number"
          placeholder="98765 43210"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            setError(undefined);
          }}
          error={error}
          autoFocus
        />
        <Text className="font-sans text-xs text-muted">
          Friends can add you with this number, and you&apos;ll show up when they search their contacts. Indian numbers
          don&apos;t need +91; for other countries start with the country code.
        </Text>
        <Button label="Save" size="lg" loading={saving} disabled={!phone.trim()} onPress={() => save(phone)} />
        {currentUser.phone ? (
          <Button label="Remove number" variant="ghost" onPress={() => save("")} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
