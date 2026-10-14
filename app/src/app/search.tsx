import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// Expense search — a simple substring match on description/category, same
// scale as architecture.md scopes it for v1 (no dedicated search index).
export default function Search() {
  const router = useRouter();
  const { listMyExpenses, getGroup, currentUser } = useData();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const results = q
    ? listMyExpenses().filter(
        (e) => e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
      )
    : [];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => goBack(router, "/")}>
          <Feather name="x" size={22} color="#1f2430" />
        </Pressable>
        <View className="flex-1">
          <Input
            label="Search expenses"
            hideLabel
            placeholder="Search by description or category"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-1 p-6">
        {q === "" ? (
          <Text className="font-sans text-sm text-muted">Search across every expense you&apos;re part of.</Text>
        ) : results.length === 0 ? (
          <EmptyState icon="search" title="No matches" body={`Nothing found for "${query}".`} />
        ) : (
          results.map((e) => {
            const mine = e.shares.find((s) => s.userId === currentUser.id);
            const group = e.groupId ? getGroup(e.groupId) : undefined;
            return (
              <Pressable
                key={e.id}
                onPress={() => router.push(`/expense/${e.id}`)}
                accessibilityRole="button"
                className="flex-row items-center justify-between border-b border-border py-3"
              >
                <View className="flex-1">
                  <Text className="font-sans-medium text-sm text-text">{e.description}</Text>
                  <Text className="font-sans text-xs text-muted">
                    {group ? `${group.name} · ` : ""}
                    {e.expenseDate}
                  </Text>
                </View>
                <Text
                  className={`font-sans-semibold text-sm ${
                    (mine?.paidCents ?? 0) - (mine?.owedCents ?? 0) >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {formatCents(e.amountCents, e.currencyCode)}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
