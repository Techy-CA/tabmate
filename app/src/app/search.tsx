import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { LedgerRow } from "@/components/LedgerRow";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import { CATEGORY_ICON, groupExpenseRow } from "@/lib/ledger";
import { goBack } from "@/lib/nav";

const CATEGORIES = ["food", "groceries", "rent", "utilities", "travel", "general"];
const label = (c: string) => c[0].toUpperCase() + c.slice(1);
const RECENT_LIMIT = 15;

// Search across friends, groups and expenses — a simple substring match,
// same scale as architecture.md scopes it for v1 (no search index). With no
// query it shows category shortcuts and recent expenses instead of a blank
// page, so it's useful the moment it opens.
export default function Search() {
  const router = useRouter();
  const { listMyExpenses, listMyGroups, listFriends, getGroup, getUser, getFriendBalance, getGroupBalances, currentUser } =
    useData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const allExpenses = listMyExpenses();

  const friends = q ? listFriends().filter((f) => f.name.toLowerCase().includes(q)) : [];
  const groups = q ? listMyGroups().filter((g) => g.name.toLowerCase().includes(q)) : [];
  const expenses = allExpenses.filter((e) => {
    if (category && e.category !== category) return false;
    if (!q) return true;
    const groupName = e.groupId ? getGroup(e.groupId)?.name.toLowerCase() ?? "" : "";
    return e.description.toLowerCase().includes(q) || e.category.includes(q) || groupName.includes(q);
  });
  const searching = !!q || !!category;
  const shownExpenses = searching ? expenses : expenses.slice(0, RECENT_LIMIT);
  // only offer categories that actually have expenses
  const usedCategories = CATEGORIES.filter((c) => allExpenses.some((e) => e.category === c));

  const expenseRow = (e: (typeof allExpenses)[number]) => {
    const { key, sortKey: _sortKey, ...row } = groupExpenseRow(
      e,
      currentUser.id,
      getUser,
      e.groupId ? getGroup(e.groupId)?.name : "Non-group"
    );
    return <LedgerRow key={key} {...row} onPress={() => router.push(`/expense/${e.id}`)} />;
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => goBack(router, "/")}>
          <Feather name="x" size={22} className="text-text" />
        </Pressable>
        <View className="flex-1">
          <Input
            label="Search"
            hideLabel
            placeholder="Search friends, groups, expenses"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6 pb-10" keyboardShouldPersistTaps="handled">
        {usedCategories.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {usedCategories.map((c) => {
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(active ? null : c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`flex-row items-center gap-1.5 rounded-pill border px-3 py-1.5 ${
                    active ? "border-accent bg-accent" : "border-border bg-bg"
                  }`}
                >
                  <Feather name={CATEGORY_ICON[c] ?? "file-text"} size={13} className={active ? "text-on-accent" : "text-muted"} />
                  <Text className={`font-sans-medium text-xs ${active ? "text-on-accent" : "text-text"}`}>{label(c)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {friends.length > 0 ? (
          <View>
            <Text className="pb-1 font-sans-semibold text-sm text-text">Friends</Text>
            {friends.map((f) => {
              const balance = getFriendBalance(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => router.push(`/friend/${f.id}`)}
                  accessibilityRole="button"
                  className="flex-row items-center gap-3 border-b border-border py-3"
                >
                  <Avatar id={f.id} name={f.name} size="sm" />
                  <Text className="flex-1 font-sans-medium text-sm text-text">{f.name}</Text>
                  <Text className={`font-sans text-xs ${balance > 0 ? "text-success" : balance < 0 ? "text-danger" : "text-muted"}`}>
                    {balance > 0
                      ? `owes you ${formatCents(balance, currentUser.defaultCurrency)}`
                      : balance < 0
                        ? `you owe ${formatCents(-balance, currentUser.defaultCurrency)}`
                        : "settled up"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {groups.length > 0 ? (
          <View>
            <Text className="pb-1 font-sans-semibold text-sm text-text">Groups</Text>
            {groups.map((g) => {
              const mine = getGroupBalances(g.id).find((b) => b.userId === currentUser.id)?.balanceCents ?? 0;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => router.push(`/group/${g.id}`)}
                  accessibilityRole="button"
                  className="flex-row items-center gap-3 border-b border-border py-3"
                >
                  <View className="h-8 w-8 items-center justify-center rounded-sm bg-surface">
                    <Feather name="users" size={15} className="text-muted" />
                  </View>
                  <Text className="flex-1 font-sans-medium text-sm text-text">{g.name}</Text>
                  <Text className={`font-sans text-xs ${mine > 0 ? "text-success" : mine < 0 ? "text-danger" : "text-muted"}`}>
                    {mine > 0
                      ? `you are owed ${formatCents(mine, g.defaultCurrency)}`
                      : mine < 0
                        ? `you owe ${formatCents(-mine, g.defaultCurrency)}`
                        : "settled up"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {shownExpenses.length > 0 ? (
          <View>
            <Text className="pb-1 font-sans-semibold text-sm text-text">
              {searching ? `Expenses${category ? ` · ${label(category)}` : ""}` : "Recent expenses"}
            </Text>
            {shownExpenses.map(expenseRow)}
          </View>
        ) : null}

        {allExpenses.length === 0 && !q ? (
          <EmptyState icon="search" title="Nothing to search yet" body="Your expenses, friends and groups will be searchable here." />
        ) : searching && friends.length === 0 && groups.length === 0 && shownExpenses.length === 0 ? (
          <EmptyState icon="search" title="No matches" body={q ? `Nothing found for "${query.trim()}".` : "No expenses in this category."} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
