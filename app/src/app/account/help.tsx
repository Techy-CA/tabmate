import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/lib/nav";

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does settling up work?",
    a: "Settle Up only records that cash, a bank transfer, or UPI happened outside the app. Tabmate never moves money itself.",
  },
  {
    q: "Can I undo a deleted expense?",
    a: "Yes. Open the expense (it stays visible, marked as deleted) and tap the restore icon in the top right.",
  },
  {
    q: "What does \"Simplify Debts\" do?",
    a: "It reduces a group's debts to the fewest possible payments without changing what anyone owes or is owed overall.",
  },
  {
    q: "Is there a limit on how much I can add?",
    a: "No. Unlike some expense trackers, Tabmate never caps how many expenses you can add.",
  },
];

export default function Help() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/account")}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Help & support</Text>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-4">
          {FAQ.map((item) => (
            <View key={item.q} className="gap-1">
              <Text className="font-sans-semibold text-sm text-text">{item.q}</Text>
              <Text className="font-sans text-sm text-muted">{item.a}</Text>
            </View>
          ))}
        </View>

        <View className="gap-1 rounded-lg border border-border bg-surface p-4">
          <Text className="font-sans-semibold text-sm text-text">Still stuck?</Text>
          <Text className="font-sans text-xs text-muted">
            In-app contact support isn&apos;t wired up yet. Reach the team directly once that&apos;s
            built.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
