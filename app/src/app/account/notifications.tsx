import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Toggle } from "@/components/Toggle";
import { useData } from "@/lib/data/store";
import type { NotificationPrefs } from "@/lib/data/types";
import { goBack } from "@/lib/nav";
import { registerForPush } from "@/lib/push";

// Saved to users.notification_prefs — the server checks it before creating
// a notification (per category) and before sending a push ("push").
const EVENTS: { key: Exclude<keyof NotificationPrefs, "push">; label: string; description: string }[] = [
  { key: "friend", label: "Friends", description: "Someone adds you, or a friend you invited joins" },
  { key: "expense", label: "Expenses", description: "Someone adds, edits or deletes an expense with you" },
  { key: "payment", label: "Payments", description: "Someone settles up with you" },
  { key: "comment", label: "Comments", description: "Someone comments on a shared expense" },
  { key: "group", label: "Groups", description: "You're added to a group, or someone joins one of yours" },
];

export default function NotificationSettings() {
  const router = useRouter();
  const { currentUser, updateNotificationPrefs } = useData();
  const prefs = currentUser.notificationPrefs;
  const [pushState, setPushState] = useState<"registered" | "denied" | "unavailable" | null>(null);
  const [error, setError] = useState<string | undefined>();

  const set = async (patch: Partial<NotificationPrefs>) => {
    setError(undefined);
    try {
      await updateNotificationPrefs(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    }
  };

  const setPush = async (on: boolean) => {
    await set({ push: on });
    if (on) setPushState(await registerForPush());
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/account")}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">Notifications</Text>
      </View>

      <ScrollView contentContainerClassName="gap-1 p-6">
        <Toggle
          label="Push notifications"
          description={Platform.OS === "web" ? "Available in the Android app" : "Alerts on this phone, even when Tabmate is closed"}
          value={prefs.push}
          onChange={setPush}
        />
        {pushState === "denied" ? (
          <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()} className="pb-2">
            <Text className="font-sans text-xs text-danger">
              Notifications are blocked for Tabmate. Tap to open settings and allow them.
            </Text>
          </Pressable>
        ) : null}
        {pushState === "unavailable" && Platform.OS !== "web" ? (
          <Text className="pb-2 font-sans text-xs text-muted">
            Push isn&apos;t available on this build — you&apos;ll still see notifications inside the app.
          </Text>
        ) : null}

        <Text className="pb-1 pt-5 font-sans-semibold text-sm text-text">Notify me about</Text>
        {EVENTS.map((e) => (
          <Toggle
            key={e.key}
            label={e.label}
            description={e.description}
            value={prefs[e.key]}
            onChange={(next) => set({ [e.key]: next })}
          />
        ))}

        {error ? <Text className="pt-3 font-sans text-sm text-danger">{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
