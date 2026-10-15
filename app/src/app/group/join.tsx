import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useData } from "@/lib/data/store";
import type { Group } from "@/lib/data/types";
import { goBack } from "@/lib/nav";

// S17 — Join an existing group via invite code
export default function JoinGroup() {
  const router = useRouter();
  const { previewGroupByCode, joinGroupByCode } = useData();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [preview, setPreview] = useState<Group | null>(null);
  const [joining, setJoining] = useState(false);

  // New codes are 8 characters; codes minted before migration 002 could be
  // as short as 4, so those still work.
  const MIN_CODE_LENGTH = 4;

  useEffect(() => {
    // A too-short code doesn't need its own setState — the previous run's
    // cleanup below already clears the stale preview when it tears down.
    if (code.length < MIN_CODE_LENGTH) return;
    let cancelled = false;
    // Debounced: each lookup counts toward the server's rate limit.
    const timer = setTimeout(async () => {
      try {
        const result = await previewGroupByCode(code);
        if (!cancelled) setPreview(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : undefined);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setPreview(null);
    };
  }, [code, previewGroupByCode]);

  const submit = async () => {
    if (joining) return;
    setJoining(true);
    try {
      const group = await joinGroupByCode(code);
      if (!group) {
        setError("That invite code is invalid or has expired.");
        return;
      }
      router.replace(`/group/${group.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join. Check your connection and try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">Join a group</Text>
      </View>

      <View className="gap-5 p-6">
        <Input
          label="Invite code"
          placeholder="ABCD2345"
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""));
            setError(undefined);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          error={error}
        />

        {preview ? (
          <View testID="join-preview" className="gap-1 rounded-lg border border-border bg-surface p-4">
            <Text className="font-sans text-xs text-muted">You&apos;re about to join</Text>
            <Text className="font-sans-semibold text-base text-text">{preview.name}</Text>
          </View>
        ) : null}

        <Button label="Join group" size="lg" loading={joining} disabled={code.length < MIN_CODE_LENGTH} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}
