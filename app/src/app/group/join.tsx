import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useData } from "@/lib/data/store";

// S17 — Join an existing group via invite code
export default function JoinGroup() {
  const router = useRouter();
  const { previewGroupByCode, joinGroupByCode } = useData();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();

  const preview = code.length >= 6 ? previewGroupByCode(code) : null;

  const submit = () => {
    const group = joinGroupByCode(code);
    if (!group) {
      setError("That invite code is invalid or has expired.");
      return;
    }
    router.replace(`/group/${group.id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Join a group</Text>
      </View>

      <View className="gap-5 p-6">
        <Input
          label="Invite code"
          placeholder="ABC123"
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            setError(undefined);
          }}
          autoCapitalize="characters"
          error={error}
        />

        {preview ? (
          <View className="gap-1 rounded-lg border border-border bg-surface p-4">
            <Text className="font-sans text-xs text-muted">You're about to join</Text>
            <Text className="font-sans-semibold text-base text-text">{preview.name}</Text>
          </View>
        ) : null}

        <Button label="Join group" size="lg" disabled={code.length < 6} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}
