import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Toggle } from "@/components/Toggle";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

function Row({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center justify-between py-3">
      <View className="flex-row items-center gap-3">
        <Feather name={icon} size={18} color="#1f2430" />
        <Text className="font-sans text-sm text-text">{label}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#6b7280" />
    </Pressable>
  );
}

// S13 — Account settings
export default function Account() {
  const router = useRouter();
  const { currentUser, getTotalBalance } = useData();
  const { signOut } = useAuth();
  const [notifications, setNotifications] = useState(true);

  const total = getTotalBalance();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="items-center gap-3 pt-4">
          <Avatar id={currentUser.id} name={currentUser.name} size="lg" />
          <Text className="font-display text-lg text-text">{currentUser.name}</Text>
          <Text className="font-sans text-sm text-muted">{currentUser.email}</Text>
        </View>

        <View className="items-center rounded-lg border border-border bg-surface p-4">
          <Text className="font-sans text-xs text-muted">Overall balance</Text>
          <Text className={`font-display text-lg ${total >= 0 ? "text-success" : "text-danger"}`}>
            {formatCents(total, "INR")}
          </Text>
        </View>

        <View className="border-t border-border">
          <Row icon="dollar-sign" label="Default currency · INR" />
          <Row icon="bell" label="Notifications" />
          <Toggle label="Push notifications" value={notifications} onChange={setNotifications} />
          <Row icon="shield" label="Security" />
          <Row icon="star" label="Splitsy Pro" onPress={() => router.push("/pro")} />
          <Row icon="help-circle" label="Help & support" />
        </View>

        <Pressable
          onPress={() => {
            signOut();
            router.replace("/");
          }}
          accessibilityRole="button"
          className="items-center rounded-md border border-border py-3"
        >
          <Text className="font-sans-semibold text-sm text-danger">Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
