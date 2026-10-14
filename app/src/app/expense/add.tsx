import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { SegmentedControl } from "@/components/SegmentedControl";
import { formatCents } from "@/lib/data/balances";
import { computeShares, remainderLabel } from "@/lib/data/split";
import { useData } from "@/lib/data/store";
import type { RepeatInterval, SplitType, User } from "@/lib/data/types";
import { goBack } from "@/lib/nav";

// "itemized" is a real SplitType in the data model (recon.md S07) but the
// item-assignment UI isn't built yet — left out here rather than shipping a
// selectable option that silently saves a zero split. See build-log.md.
const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: "equal", label: "Equally" },
  { value: "exact", label: "Exact" },
  { value: "percentage", label: "%" },
  { value: "shares", label: "Shares" },
  { value: "adjustment", label: "Adjust" },
];

const REPEAT_OPTIONS: { value: RepeatInterval; label: string }[] = [
  { value: "none", label: "Never" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const CATEGORIES = ["general", "rent", "groceries", "utilities", "travel", "food"];

// S06 + S07 — Add expense, with the full split-type picker inline.
// Also handles editing: ?editId=<id> loads an existing expense. Editing
// always reopens as an "exact amounts" split pre-filled with each person's
// current owed share — the original split type (e.g. "60/40") isn't
// round-tripped, since percentage/shares/adjustment inputs can't be
// reconstructed from a stored owedCents total alone. The user edits the
// literal amounts instead, which is always correct and never lossy.
export default function AddExpense() {
  const router = useRouter();
  const { groupId: groupIdParam, editId } = useLocalSearchParams<{ groupId?: string; editId?: string }>();
  const { listGroupMembers, listFriends, currentUser, createExpense, updateExpense, getExpense, getGroup } =
    useData();

  const editing = editId ? getExpense(editId) : undefined;
  const groupId = groupIdParam || editing?.groupId || undefined;
  const group = groupId ? getGroup(groupId) : undefined;
  const groupMembers = groupId ? listGroupMembers(groupId) : [];
  const friends = listFriends();

  const [friendIds, setFriendIds] = useState<Set<string>>(
    () => new Set(editing?.shares.map((s) => s.userId).filter((id) => id !== currentUser.id))
  );
  const participants: User[] = groupId ? groupMembers : [currentUser, ...friends.filter((f) => friendIds.has(f.id))];
  const participantIds = participants.map((p) => p.id);

  const [description, setDescription] = useState(editing?.description ?? "");
  const [amountText, setAmountText] = useState(editing ? (editing.amountCents / 100).toString() : "");
  const amountCents = Math.round((parseFloat(amountText || "0") || 0) * 100);
  const [category, setCategory] = useState(editing?.category ?? "general");
  const [paidBy, setPaidBy] = useState(editing?.shares.find((s) => s.paidCents > 0)?.userId ?? currentUser.id);
  const [splitType, setSplitType] = useState<SplitType>(editing ? "exact" : "equal");
  const [repeatInterval, setRepeatInterval] = useState<RepeatInterval>(editing?.repeatInterval ?? "none");
  const [inputs, setInputs] = useState<Record<string, number>>(() =>
    editing ? Object.fromEntries(editing.shares.map((s) => [s.userId, s.owedCents])) : {}
  );
  const [splitSheetOpen, setSplitSheetOpen] = useState(!!editing);
  const [error, setError] = useState<string | undefined>();

  const shares = computeShares(splitType, amountCents, participantIds, inputs);
  const remainder = remainderLabel(splitType, amountCents, participantIds, inputs);

  const toggleFriend = (id: string) => {
    setFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (!description.trim() || amountCents <= 0) {
      setError("Add a description and an amount greater than zero.");
      return;
    }
    if (participants.length < (groupId ? 1 : 2)) {
      setError("Add at least one other person to split with.");
      return;
    }
    if (!remainder.balanced) {
      setError("Fix the split before saving — " + remainder.message);
      return;
    }

    if (editing) {
      updateExpense(editing.id, {
        description: description.trim(),
        amountCents,
        category,
        splitType,
        repeatInterval,
        shares: shares.map((s) => ({
          userId: s.userId,
          owedCents: s.owedCents,
          paidCents: s.userId === paidBy ? amountCents : 0,
        })),
      });
      goBack(router, `/expense/${editing.id}`);
      return;
    }

    createExpense({
      groupId,
      description: description.trim(),
      amountCents,
      currencyCode: group?.defaultCurrency ?? currentUser.defaultCurrency,
      category,
      expenseDate: new Date().toISOString().slice(0, 10),
      splitType,
      repeatInterval,
      paidBy: [{ userId: paidBy, amountCents }],
      owedBy: shares,
    });
    goBack(router, groupId ? `/group/${groupId}` : "/");
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between border-b border-border p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => goBack(router, editing ? `/expense/${editing.id}` : groupId ? `/group/${groupId}` : "/")}
        >
          <Feather name="x" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">{editing ? "Edit expense" : "Add expense"}</Text>
        <View className="w-6" />
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6 pb-10">
        {group ? (
          <Text className="font-sans text-sm text-muted">In {group.name}</Text>
        ) : (
          <View className="gap-2">
            <Text className="font-sans-semibold text-sm text-text">With</Text>
            <View className="flex-row flex-wrap gap-2">
              {friends.map((f) => {
                const selected = friendIds.has(f.id);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => toggleFriend(f.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    className={`flex-row items-center gap-2 rounded-pill border px-3 py-1.5 ${
                      selected ? "border-accent bg-accent/5" : "border-border"
                    }`}
                  >
                    <Avatar id={f.id} name={f.name} size="xs" />
                    <Text className="font-sans text-sm text-text">{f.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Input label="Description" placeholder="Dinner at Toit" value={description} onChangeText={setDescription} />
        <Input
          label="Amount"
          prefix="₹"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={setAmountText}
          error={error}
        />

        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Category</Text>
          <SegmentedControl
            options={CATEGORIES.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))}
            value={category}
            onChange={setCategory}
          />
        </View>

        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Paid by</Text>
          <View className="flex-row flex-wrap gap-2">
            {participants.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPaidBy(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: paidBy === p.id }}
                className={`flex-row items-center gap-2 rounded-pill border px-3 py-1.5 ${
                  paidBy === p.id ? "border-accent bg-accent/5" : "border-border"
                }`}
              >
                <Avatar id={p.id} name={p.name} size="xs" />
                <Text className="font-sans text-sm text-text">{p.id === currentUser.id ? "You" : p.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={() => setSplitSheetOpen((v) => !v)}
          accessibilityRole="button"
          className="flex-row items-center justify-between rounded-lg border border-border p-3"
        >
          <Text className="font-sans text-sm text-text">
            Split {SPLIT_OPTIONS.find((o) => o.value === splitType)?.label.toLowerCase()}
          </Text>
          <Feather name={splitSheetOpen ? "chevron-up" : "chevron-down"} size={18} color="#6b7280" />
        </Pressable>

        {splitSheetOpen ? (
          <View className="gap-3 rounded-lg border border-border bg-surface p-4">
            <SegmentedControl options={SPLIT_OPTIONS} value={splitType} onChange={setSplitType} />

            {splitType !== "equal" && participants.length > 0 ? (
              <View className="gap-2">
                {participants.map((p) => (
                  <View key={p.id} className="flex-row items-center justify-between gap-3">
                    <View className="flex-row items-center gap-2">
                      <Avatar id={p.id} name={p.name} size="xs" />
                      <Text className="font-sans text-sm text-text">{p.id === currentUser.id ? "You" : p.name}</Text>
                    </View>
                    <View className="w-28">
                      <Input
                        label={`Amount for ${p.id === currentUser.id ? "you" : p.name}`}
                        hideLabel
                        keyboardType="decimal-pad"
                        prefix={splitType === "percentage" ? "%" : splitType === "shares" ? "x" : "₹"}
                        value={inputs[p.id] ? String(inputs[p.id]) : ""}
                        onChangeText={(t) => {
                          const raw = parseFloat(t || "0") || 0;
                          const cents = splitType === "percentage" || splitType === "shares" ? raw : Math.round(raw * 100);
                          setInputs((prev) => ({ ...prev, [p.id]: cents }));
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="font-sans text-sm text-muted">
                Splits {formatCents(Math.floor(amountCents / Math.max(participants.length, 1)), "INR")} each.
              </Text>
            )}

            <Text className={`font-sans-medium text-xs ${remainder.balanced ? "text-muted" : "text-danger"}`} accessibilityLiveRegion="polite">
              {remainder.message}
            </Text>
          </View>
        ) : null}

        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Repeats</Text>
          <SegmentedControl options={REPEAT_OPTIONS} value={repeatInterval} onChange={setRepeatInterval} />
        </View>

        <Button label={editing ? "Save changes" : "Save expense"} size="lg" onPress={submit} />
      </ScrollView>
    </SafeAreaView>
  );
}
