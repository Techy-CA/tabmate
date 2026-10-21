import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/lib/nav";
import { useTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; description: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { value: "system", label: "Same as phone", description: "Follows your phone's light/dark setting", icon: "smartphone" },
  { value: "light", label: "Light", description: "Always light", icon: "sun" },
  { value: "dark", label: "Dark", description: "Always dark — easier on the eyes at night", icon: "moon" },
];

export default function Appearance() {
  const router = useRouter();
  const { preference, setPreference } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/account")}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">Appearance</Text>
      </View>

      <View className="gap-2 p-6">
        {OPTIONS.map((o) => {
          const on = preference === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => setPreference(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              className={`flex-row items-center gap-3 rounded-lg border p-4 ${on ? "border-accent bg-accent/5" : "border-border"}`}
            >
              <Feather name={o.icon} size={18} className={on ? "text-accent" : "text-muted"} />
              <View className="flex-1">
                <Text className="font-sans-medium text-sm text-text">{o.label}</Text>
                <Text className="font-sans text-xs text-muted">{o.description}</Text>
              </View>
              <Feather name={on ? "check-circle" : "circle"} size={20} className={on ? "text-accent" : "text-border-input"} />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
