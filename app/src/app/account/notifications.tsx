import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Toggle } from "@/components/Toggle";
import { goBack } from "@/lib/nav";

// Per-event-type preference, same event set as activity_items in
// schema.sql. Preferences live only in this screen's state for now — there's
// no account to sync them to until replica-backend wires up Supabase, and no
// device push token to actually act on them until a real build exists (push
// can't be delivered to, or tested in, a web preview).
const EVENTS: { key: string; label: string; description: string }[] = [
  { key: "expense", label: "New expenses", description: "Someone adds or edits a shared expense" },
  { key: "payment", label: "Payments", description: "Someone settles up with you" },
  { key: "comment", label: "Comments", description: "Someone comments on a shared expense" },
  { key: "group", label: "Group activity", description: "Members join, leave, or a group is renamed" },
];

export default function NotificationSettings() {
  const router = useRouter();
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  const [perEvent, setPerEvent] = useState<Record<string, boolean>>(
    () => Object.fromEntries(EVENTS.map((e) => [e.key, true]))
  );

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/account")}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Notifications</Text>
      </View>

      <ScrollView contentContainerClassName="gap-1 p-6">
        <Toggle label="Push notifications" description="On this device" value={push} onChange={setPush} />
        <Toggle label="Email notifications" description={`To your email`} value={email} onChange={setEmail} />

        <Text className="pb-1 pt-5 font-sans-semibold text-sm text-text">Notify me about</Text>
        {EVENTS.map((e) => (
          <Toggle
            key={e.key}
            label={e.label}
            description={e.description}
            value={perEvent[e.key]}
            onChange={(next) => setPerEvent((prev) => ({ ...prev, [e.key]: next }))}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
