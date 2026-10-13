import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";

// S08 — Expense detail
export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getExpense, getUser, currentUser, listComments, addComment, softDeleteExpense, restoreExpense } = useData();
  const [comment, setComment] = useState("");

  const expense = getExpense(id);
  if (!expense) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <Text className="font-sans text-sm text-muted">Expense not found.</Text>
      </SafeAreaView>
    );
  }

  const comments = listComments(expense.id);
  const payer = expense.shares.find((s) => s.paidCents > 0);

  const confirmDelete = () => {
    Alert.alert("Delete expense?", "You can restore it later from this screen.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => softDeleteExpense(expense.id) },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text" numberOfLines={1}>
          {expense.description}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expense.deletedAt ? "Restore expense" : "Delete expense"}
          onPress={() => (expense.deletedAt ? restoreExpense(expense.id) : confirmDelete())}
        >
          <Feather name={expense.deletedAt ? "rotate-ccw" : "trash-2"} size={20} color="#1f2430" />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6 pb-10">
        {expense.deletedAt ? (
          <View className="rounded-lg bg-danger/10 p-3">
            <Text className="font-sans-medium text-sm text-danger">
              This expense was deleted. Tap the restore icon above to bring it back.
            </Text>
          </View>
        ) : null}

        <View className="items-center gap-1">
          <Text className="font-display text-display text-text">{formatCents(expense.amountCents, expense.currencyCode)}</Text>
          <Text className="font-sans text-sm text-muted">
            {getUser(payer?.userId ?? "")?.name ?? "Someone"} paid on {expense.expenseDate}
          </Text>
        </View>

        <View className="gap-2 rounded-lg border border-border p-4">
          <Text className="font-sans-semibold text-sm text-text">Split {expense.splitType}</Text>
          {expense.shares.map((s) => {
            const user = getUser(s.userId);
            return (
              <View key={s.userId} className="flex-row items-center justify-between py-1.5">
                <View className="flex-row items-center gap-2">
                  <Avatar id={s.userId} name={user?.name ?? "?"} size="xs" />
                  <Text className="font-sans text-sm text-text">{s.userId === currentUser.id ? "You" : user?.name}</Text>
                </View>
                <Text className="font-sans text-sm text-muted">
                  paid {formatCents(s.paidCents, expense.currencyCode)} · owes {formatCents(s.owedCents, expense.currencyCode)}
                </Text>
              </View>
            );
          })}
        </View>

        <View className="gap-3">
          <Text className="font-sans-semibold text-sm text-text">Comments</Text>
          {comments.length === 0 ? (
            <Text className="font-sans text-sm text-muted">No comments yet.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} className="flex-row gap-2">
                <Avatar id={c.userId} name={getUser(c.userId)?.name ?? "?"} size="xs" />
                <View className="flex-1 gap-0.5">
                  <Text className="font-sans-medium text-xs text-text">
                    {c.userId === currentUser.id ? "You" : getUser(c.userId)?.name}
                  </Text>
                  <Text className="font-sans text-sm text-text">{c.body}</Text>
                </View>
              </View>
            ))
          )}
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <Input label="Add a comment" hideLabel placeholder="Add a comment" value={comment} onChangeText={setComment} />
            </View>
            <Button
              label="Send"
              size="md"
              disabled={!comment.trim()}
              onPress={() => {
                addComment(expense.id, comment.trim());
                setComment("");
              }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
