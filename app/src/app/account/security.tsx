import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

export default function SecuritySettings() {
  const router = useRouter();
  const { currentUser } = useData();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/account")}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">Security</Text>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-1 rounded-lg border border-border bg-surface p-4">
          <Text className="font-sans-semibold text-sm text-text">Signed in as</Text>
          <Text className="font-sans text-sm text-muted">{currentUser.email}</Text>
        </View>

        <View className="gap-2 rounded-lg border border-dashed border-border p-4">
          <Text className="font-sans-medium text-sm text-text">Password and sign-in methods</Text>
          <Text className="font-sans text-xs text-muted">
            Sign-in isn&apos;t backed by a real account system yet, so there&apos;s no password to
            change or sessions to manage here. This screen fills in once accounts move to
            Supabase Auth.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
