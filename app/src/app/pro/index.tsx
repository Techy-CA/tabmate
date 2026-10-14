import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/lib/nav";

const FEATURES: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; body: string }[] = [
  { icon: "camera", title: "Receipt scanning", body: "Photograph a bill and split it item by item." },
  { icon: "pie-chart", title: "Spending charts", body: "See where your group's money actually goes." },
  { icon: "download", title: "Export history", body: "Download any group's expenses as CSV or JSON." },
];

// S18 — Pro / upgrade (could-have; never gates a must-have flow)
export default function Pro() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Tabmate Pro</Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6">
        <Text className="font-sans text-sm text-muted">
          Everything you need to split costs is already free, no daily limits and no ads. Pro
          adds a few extras for power users.
        </Text>

        <View className="gap-4">
          {FEATURES.map((f) => (
            <View key={f.title} className="flex-row gap-3 rounded-lg border border-border bg-surface p-4">
              <Feather name={f.icon} size={20} color="#5b5fef" />
              <View className="flex-1 gap-0.5">
                <Text className="font-sans-semibold text-sm text-text">{f.title}</Text>
                <Text className="font-sans text-xs text-muted">{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="items-center gap-2 rounded-lg border border-dashed border-border p-6">
          <Text className="font-sans-medium text-sm text-muted">Coming soon</Text>
          <Text className="text-center font-sans text-xs text-muted">
            We&apos;re still building Pro. These extras will unlock here once they&apos;re ready.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
