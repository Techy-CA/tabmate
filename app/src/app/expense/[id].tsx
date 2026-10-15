import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { prettyDate } from "@/components/DateField";
import { Input } from "@/components/Input";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";
import type { ExpenseHistoryEntry, ExpenseSnapshot } from "@/lib/data/types";
import { confirmAction } from "@/lib/confirm";
import { goBack } from "@/lib/nav";

// S08 — Expense detail
export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getExpense, getUser, currentUser, listComments, addComment, softDeleteExpense, restoreExpense, getExpenseHistory } =
    useData();
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();

  const run = async (action: () => Promise<unknown>) => {
    setActionError(undefined);
    try {
      await action();
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      return false;
    }
  };

  const expense = getExpense(id);
  const [history, setHistory] = useState<ExpenseHistoryEntry[]>([]);
  // reload whenever the expense itself changes (edit, delete, restore)
  const version = expense ? `${expense.updatedAt}|${expense.deletedAt ?? ""}` : "";
  useEffect(() => {
    if (!version) return;
    let cancelled = false;
    getExpenseHistory(id)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, version, getExpenseHistory]);

  if (!expense) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <Text className="font-sans text-sm text-muted">Expense not found.</Text>
        <Button label="Go back" variant="ghost" onPress={() => goBack(router, "/")} />
      </SafeAreaView>
    );
  }

  const comments = listComments(expense.id);
  const payer = expense.shares.find((s) => s.paidCents > 0);
  const payerUser = payer ? getUser(payer.userId) : undefined;
  const payerName = payer?.userId === currentUser.id ? "You" : payerUser?.isKitty ? "Kitty" : payerUser?.name ?? "Someone";

  const confirmDelete = () => {
    confirmAction({
      title: "Remove this from the tab?",
      message: "You can bring it back anytime from this screen.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => run(() => softDeleteExpense(expense.id)),
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between border-b border-border p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => goBack(router, expense.groupId ? `/group/${expense.groupId}` : "/")}
        >
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="mx-3 flex-1 font-display text-lg text-text" numberOfLines={1}>
          {expense.description}
        </Text>
        <View className="flex-row items-center gap-4">
          {!expense.deletedAt ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit expense"
              onPress={() =>
                router.push(
                  `/expense/add?editId=${expense.id}${expense.groupId ? `&groupId=${expense.groupId}` : ""}`
                )
              }
            >
              <Feather name="edit-2" size={20} className="text-text" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expense.deletedAt ? "Restore expense" : "Delete expense"}
            onPress={() => (expense.deletedAt ? run(() => restoreExpense(expense.id)) : confirmDelete())}
          >
            <Feather name={expense.deletedAt ? "rotate-ccw" : "trash-2"} size={20} className="text-text" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6 pb-10" keyboardShouldPersistTaps="handled">
        {actionError ? <Text className="font-sans text-sm text-danger">{actionError}</Text> : null}
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
            {payerName} paid · {prettyDate(expense.expenseDate)}
          </Text>
          {expense.repeatInterval !== "none" || expense.recurringTemplateId ? (
            <View className="mt-1 flex-row items-center gap-1 rounded-pill bg-accent/10 px-3 py-1">
              <Feather name="repeat" size={12} className="text-accent" />
              <Text className="font-sans-medium text-xs text-accent">
                {expense.recurringTemplateId ? "Added automatically (recurring)" : `Repeats ${expense.repeatInterval}`}
              </Text>
            </View>
          ) : null}
        </View>

        {expense.notes ? (
          <View className="gap-1 rounded-lg bg-surface p-4">
            <Text className="font-sans-semibold text-xs text-muted">Notes</Text>
            <Text className="font-sans text-sm text-text">{expense.notes}</Text>
          </View>
        ) : null}

        {expense.items?.length ? (
          <View className="gap-2 rounded-lg border border-border p-4">
            <Text className="font-sans-semibold text-sm text-text">Bill items</Text>
            {[...expense.items]
              .sort((a, b) => (a.kind === "item" ? 0 : 1) - (b.kind === "item" ? 0 : 1))
              .map((it) => (
                <View key={it.id} className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="font-sans text-sm text-text">{it.name}</Text>
                    <Text className="font-sans text-xs text-muted">
                      {it.kind === "item"
                        ? it.assignedUserIds.map((u) => (u === currentUser.id ? "You" : getUser(u)?.name ?? "?")).join(", ")
                        : "shared in proportion"}
                    </Text>
                  </View>
                  <Text className={`font-sans-medium text-sm ${it.kind === "discount" ? "text-success" : "text-text"}`}>
                    {it.kind === "discount" ? "−" : ""}
                    {formatCents(it.amountCents, expense.currencyCode)}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}

        <View className="gap-2 rounded-lg border border-border p-4">
          <Text className="font-sans-semibold text-sm text-text">
            {
              {
                equal: "Split equally",
                exact: "Split by exact amounts",
                percentage: "Split by percentage",
                shares: "Split by shares",
                adjustment: "Split with adjustments",
                itemized: "Split by item",
              }[expense.splitType]
            }
          </Text>
          {expense.shares.map((s) => {
            const user = getUser(s.userId);
            const isMe = s.userId === currentUser.id;
            const amt = (c: number) => formatCents(c, expense.currencyCode);
            // Splitwise-style sentence per person: what they put in vs their share.
            const line =
              s.paidCents > 0
                ? `paid ${amt(s.paidCents)} and ${isMe ? "owe" : "owes"} ${amt(s.owedCents)}`
                : `${isMe ? "owe" : "owes"} ${amt(s.owedCents)}`;
            return (
              <View key={s.userId} className="flex-row items-center justify-between py-1.5">
                <View className="flex-row items-center gap-2">
                  <Avatar id={s.userId} name={user?.name ?? "?"} size="xs" />
                  <Text className="font-sans text-sm text-text">
                    {s.userId === currentUser.id ? "You" : user?.isKitty ? "Kitty" : user?.name}
                  </Text>
                </View>
                <Text className="font-sans text-sm text-muted">{line}</Text>
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
              loading={sending}
              onPress={async () => {
                if (sending) return;
                setSending(true);
                // keep the text if posting fails, so nothing is lost
                if (await run(() => addComment(expense.id, comment.trim()))) setComment("");
                setSending(false);
              }}
            />
          </View>
        </View>

        {history.length > 0 ? (
          <View className="gap-2">
            <Text className="font-sans-semibold text-sm text-text">History</Text>
            {[...history].reverse().map((h) => {
              const who = !h.changedBy ? "Tabmate" : h.changedBy === currentUser.id ? "You" : getUser(h.changedBy)?.name ?? "Someone";
              const changes = h.action === "edited" && h.before && h.after ? describeChanges(h.before, h.after, expense.currencyCode) : [];
              return (
                <View key={h.id} className="flex-row gap-3">
                  <View className="mt-1.5 h-2 w-2 rounded-pill bg-border-input" />
                  <View className="flex-1 gap-0.5">
                    <Text className="font-sans text-sm text-text">
                      <Text className="font-sans-semibold">{who}</Text> {ACTION_TEXT[h.action]}
                    </Text>
                    {changes.map((c) => (
                      <Text key={c} className="font-sans text-xs text-muted">
                        {c}
                      </Text>
                    ))}
                    <Text className="font-sans text-xs text-muted">
                      {new Date(h.createdAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const ACTION_TEXT: Record<ExpenseHistoryEntry["action"], string> = {
  created: "added this expense",
  edited: "edited it",
  deleted: "deleted it",
  restored: "restored it",
};

/** Human-readable list of what an edit changed. */
function describeChanges(before: ExpenseSnapshot, after: ExpenseSnapshot, currency: string): string[] {
  const out: string[] = [];
  const money = (c: number) => formatCents(Number(c), currency);
  if (before.description !== after.description) out.push(`Name: "${before.description}" → "${after.description}"`);
  if (Number(before.amount_cents) !== Number(after.amount_cents)) {
    out.push(`Amount: ${money(before.amount_cents)} → ${money(after.amount_cents)}`);
  }
  if (before.expense_date !== after.expense_date) out.push(`Date: ${prettyDate(before.expense_date)} → ${prettyDate(after.expense_date)}`);
  if (before.category !== after.category) out.push(`Category: ${before.category} → ${after.category}`);
  if ((before.notes ?? "") !== (after.notes ?? "")) out.push(after.notes ? `Notes: "${after.notes}"` : "Notes removed");
  if (JSON.stringify(before.shares) !== JSON.stringify(after.shares)) out.push("Who paid / who owes was changed");
  return out;
}
