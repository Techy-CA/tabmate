import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// Options the rest of the app already knows how to format (balances.ts'
// formatCents) — picking anything else would show as a raw "CODE 1,234"
// which is correct but not as polished, so the picker stays to these three
// until more symbols are added there too.
const CURRENCIES = [
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
];

export default function CurrencySettings() {
  const router = useRouter();
  const { currentUser, updateCurrentUser } = useData();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/account")}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Default currency</Text>
      </View>

      <ScrollView contentContainerClassName="p-2">
        {CURRENCIES.map((c) => {
          const selected = c.code === currentUser.defaultCurrency;
          return (
            <Pressable
              key={c.code}
              onPress={() => updateCurrentUser({ defaultCurrency: c.code })}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              className="flex-row items-center justify-between px-4 py-3.5"
            >
              <View>
                <Text className="font-sans-medium text-sm text-text">
                  {c.symbol} {c.code}
                </Text>
                <Text className="font-sans text-xs text-muted">{c.label}</Text>
              </View>
              {selected ? <Feather name="check" size={20} color="#5b5fef" /> : null}
            </Pressable>
          );
        })}
        <Text className="px-4 pt-2 font-sans text-xs text-muted">
          New non-group expenses default to this currency. Group expenses use the group&apos;s own
          default instead, and existing expenses keep whatever currency they were created with.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
