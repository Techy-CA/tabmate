import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { DateField, localISODate } from "@/components/DateField";
import { Input } from "@/components/Input";
import { SegmentedControl } from "@/components/SegmentedControl";
import { formatCents } from "@/lib/data/balances";
import { computeItemizedShares, computeShares, remainderLabel, type BillItem } from "@/lib/data/split";
import { useData } from "@/lib/data/store";
import type { RepeatInterval, SplitType, User } from "@/lib/data/types";
import { goBack } from "@/lib/nav";

const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: "equal", label: "Equally" },
  { value: "exact", label: "Exact" },
  { value: "percentage", label: "%" },
  { value: "shares", label: "Shares" },
  { value: "adjustment", label: "Adjust" },
  { value: "itemized", label: "Items" },
];

const REPEAT_OPTIONS: { value: RepeatInterval; label: string }[] = [
  { value: "none", label: "Never" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const CATEGORIES = ["general", "rent", "groceries", "utilities", "travel", "food"];

type ItemDraft = { key: string; name: string; amountText: string; userIds: string[] };
const toCents = (t: string) => Math.round((parseFloat(t || "0") || 0) * 100);
const newKey = () => Math.random().toString(36).slice(2);

// S06 + S07 — Add expense, with the full split-type picker inline.
// Editing (?editId=) reopens itemized bills as items; any other split
// reopens as exact amounts pre-filled from the stored shares (percentage /
// shares inputs can't be reconstructed from owed totals alone).
export default function AddExpense() {
  const router = useRouter();
  const { groupId: groupIdParam, editId } = useLocalSearchParams<{ groupId?: string; editId?: string }>();
  const { listGroupMembers, listFriends, currentUser, createExpense, updateExpense, getExpense, getGroup, getGroupKitty } =
    useData();

  const editing = editId ? getExpense(editId) : undefined;
  const groupId = groupIdParam || editing?.groupId || undefined;
  const group = groupId ? getGroup(groupId) : undefined;
  const kitty = groupId ? getGroupKitty(groupId) : undefined;
  const groupMembers = groupId ? listGroupMembers(groupId).filter((m) => !m.isKitty) : [];
  const friends = listFriends();
  const currency = group?.defaultCurrency ?? currentUser.defaultCurrency;

  const [friendIds, setFriendIds] = useState<Set<string>>(
    () => new Set(editing?.shares.map((s) => s.userId).filter((id) => id !== currentUser.id))
  );
  // who splits the cost (a kitty pays, it never owes)
  const participants: User[] = groupId ? groupMembers : [currentUser, ...friends.filter((f) => friendIds.has(f.id))];
  const participantIds = participants.map((p) => p.id);
  const payerOptions: User[] = kitty ? [...participants, kitty] : participants;

  const editingItemized = editing?.splitType === "itemized" && !!editing.items?.length;
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amountText, setAmountText] = useState(editing ? (editing.amountCents / 100).toString() : "");
  const [category, setCategory] = useState(editing?.category ?? "general");
  const [paidBy, setPaidBy] = useState(editing?.shares.find((s) => s.paidCents > 0)?.userId ?? currentUser.id);
  const [splitType, setSplitType] = useState<SplitType>(editing ? (editingItemized ? "itemized" : "exact") : "equal");
  const [repeatInterval, setRepeatInterval] = useState<RepeatInterval>(editing?.repeatInterval ?? "none");
  const [expenseDate, setExpenseDate] = useState(editing?.expenseDate ?? localISODate());
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [inputs, setInputs] = useState<Record<string, number>>(() =>
    editing ? Object.fromEntries(editing.shares.map((s) => [s.userId, s.owedCents])) : {}
  );
  const [items, setItems] = useState<ItemDraft[]>(() =>
    editingItemized
      ? editing!.items!.filter((i) => i.kind === "item").map((i) => ({
          key: i.id,
          name: i.name,
          amountText: (i.amountCents / 100).toString(),
          userIds: i.assignedUserIds,
        }))
      : [{ key: newKey(), name: "", amountText: "", userIds: [] }]
  );
  const [extraText, setExtraText] = useState(() => {
    const c = editing?.items?.filter((i) => i.kind === "tax" || i.kind === "tip").reduce((s, i) => s + i.amountCents, 0) ?? 0;
    return c ? (c / 100).toString() : "";
  });
  const [discountText, setDiscountText] = useState(() => {
    const c = editing?.items?.filter((i) => i.kind === "discount").reduce((s, i) => s + i.amountCents, 0) ?? 0;
    return c ? (c / 100).toString() : "";
  });
  const [splitSheetOpen, setSplitSheetOpen] = useState(!!editing);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const itemized = splitType === "itemized";
  const billItems: BillItem[] = items.map((i) => ({ name: i.name, amountCents: toCents(i.amountText), userIds: i.userIds }));
  const itemizedResult = computeItemizedShares(billItems, toCents(extraText), toCents(discountText), participantIds);
  const amountCents = itemized ? itemizedResult.totalCents : toCents(amountText);
  const shares = itemized ? itemizedResult.shares : computeShares(splitType, amountCents, participantIds, inputs);
  const remainder = itemized
    ? itemizedCheck(items)
    : remainderLabel(splitType, amountCents, participantIds, inputs);

  const toggleFriend = (id: string) => {
    setFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const toggleItemPerson = (key: string, userId: string) =>
    setItems((prev) =>
      prev.map((i) =>
        i.key === key
          ? { ...i, userIds: i.userIds.includes(userId) ? i.userIds.filter((u) => u !== userId) : [...i.userIds, userId] }
          : i
      )
    );

  const submit = async () => {
    if (!description.trim() || amountCents <= 0) {
      setError(itemized ? "Add a description and at least one item with a price." : "Add a description and an amount greater than zero.");
      return;
    }
    if (participants.length < (groupId ? 1 : 2)) {
      setError("Add at least one other person to split with.");
      return;
    }
    if (!remainder.balanced) {
      setError("Fix the split before saving: " + remainder.message);
      return;
    }
    if (saving) return; // double-tap guard
    setSaving(true);
    try {
      await save();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  };

  const itemsInput = () =>
    itemized
      ? [
          ...billItems
            .filter((i) => i.amountCents > 0 && i.userIds.length > 0)
            .map((i) => ({ name: i.name.trim() || "Item", amountCents: i.amountCents, kind: "item" as const, userIds: i.userIds })),
          ...(toCents(extraText) > 0 ? [{ name: "Tax / tip", amountCents: toCents(extraText), kind: "tax" as const, userIds: [] }] : []),
          ...(toCents(discountText) > 0
            ? [{ name: "Discount", amountCents: toCents(discountText), kind: "discount" as const, userIds: [] }]
            : []),
        ]
      : [];

  // the payer may be the kitty, which isn't in `shares` (it owes nothing)
  const fullShares = () => {
    const rows = shares.map((s) => ({ userId: s.userId, owedCents: s.owedCents, paidCents: s.userId === paidBy ? amountCents : 0 }));
    if (!rows.some((r) => r.userId === paidBy)) rows.push({ userId: paidBy, owedCents: 0, paidCents: amountCents });
    return rows;
  };

  const save = async () => {
    if (editing) {
      await updateExpense(editing.id, {
        description: description.trim(),
        amountCents,
        category,
        splitType,
        repeatInterval,
        expenseDate,
        notes: notes.trim() || undefined,
        shares: fullShares(),
        itemsInput: itemsInput(),
      });
      goBack(router, `/expense/${editing.id}`);
      return;
    }

    const rows = fullShares();
    await createExpense({
      groupId,
      description: description.trim(),
      amountCents,
      currencyCode: currency,
      category,
      expenseDate,
      splitType,
      repeatInterval,
      notes: notes.trim() || undefined,
      items: itemized ? itemsInput() : undefined,
      paidBy: [{ userId: paidBy, amountCents }],
      owedBy: rows.map((r) => ({ userId: r.userId, owedCents: r.owedCents })),
    });
    goBack(router, groupId ? `/group/${groupId}` : "/");
  };

  const nameOf = (p: User) => (p.id === currentUser.id ? "You" : p.name);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between border-b border-border p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => goBack(router, editing ? `/expense/${editing.id}` : groupId ? `/group/${groupId}` : "/")}
        >
          <Feather name="x" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">{editing ? "Edit expense" : "Add expense"}</Text>
        <View className="w-6" />
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6 pb-10" keyboardShouldPersistTaps="handled">
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
        {itemized ? (
          <View className="gap-1">
            <Text className="font-sans-medium text-xs text-muted">Amount</Text>
            <Text className="font-display text-xl text-text">{formatCents(amountCents, currency)}</Text>
            <Text className="font-sans text-xs text-muted">Total of the items below</Text>
            {error ? <Text className="font-sans text-xs text-danger">{error}</Text> : null}
          </View>
        ) : (
          <Input
            label="Amount"
            prefix="₹"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={amountText}
            onChangeText={setAmountText}
            error={error}
          />
        )}

        <DateField label="Date" value={expenseDate} onChange={setExpenseDate} />

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
            {payerOptions.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPaidBy(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: paidBy === p.id }}
                className={`flex-row items-center gap-2 rounded-pill border px-3 py-1.5 ${
                  paidBy === p.id ? "border-accent bg-accent/5" : "border-border"
                }`}
              >
                {p.isKitty ? (
                  <Feather name="archive" size={14} className="text-accent" />
                ) : (
                  <Avatar id={p.id} name={p.name} size="xs" />
                )}
                <Text className="font-sans text-sm text-text">{p.isKitty ? "Kitty" : nameOf(p)}</Text>
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
            {itemized ? "Split by items" : `Split ${SPLIT_OPTIONS.find((o) => o.value === splitType)?.label.toLowerCase()}`}
          </Text>
          <Feather name={splitSheetOpen ? "chevron-up" : "chevron-down"} size={18} className="text-muted" />
        </Pressable>

        {splitSheetOpen ? (
          <View className="gap-3 rounded-lg border border-border bg-surface p-4">
            <SegmentedControl options={SPLIT_OPTIONS} value={splitType} onChange={setSplitType} />

            {itemized ? (
              <View className="gap-4">
                {items.map((it, idx) => (
                  <View key={it.key} className="gap-2 rounded-md border border-border bg-bg p-3">
                    <View className="flex-row items-end gap-2">
                      <View className="flex-1">
                        <Input
                          label={`Item ${idx + 1}`}
                          placeholder="e.g. Paneer tikka"
                          value={it.name}
                          onChangeText={(t) => updateItem(it.key, { name: t })}
                        />
                      </View>
                      <View className="w-28">
                        <Input
                          label="Price"
                          prefix="₹"
                          keyboardType="decimal-pad"
                          placeholder="0"
                          value={it.amountText}
                          onChangeText={(t) => updateItem(it.key, { amountText: t })}
                        />
                      </View>
                      {items.length > 1 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove item ${idx + 1}`}
                          onPress={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                          className="h-11 justify-center"
                        >
                          <Feather name="trash-2" size={18} className="text-muted" />
                        </Pressable>
                      ) : null}
                    </View>
                    <Text className="font-sans text-xs text-muted">Who had it?</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {participants.map((p) => {
                        const on = it.userIds.includes(p.id);
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => toggleItemPerson(it.key, p.id)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: on }}
                            className={`rounded-pill border px-3 py-1 ${on ? "border-accent bg-accent/10" : "border-border"}`}
                          >
                            <Text className={`font-sans text-xs ${on ? "text-accent" : "text-text"}`}>{nameOf(p)}</Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        onPress={() => updateItem(it.key, { userIds: participantIds })}
                        accessibilityRole="button"
                        className="rounded-pill px-2 py-1"
                      >
                        <Text className="font-sans-medium text-xs text-accent">Everyone</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                <Pressable
                  onPress={() => setItems((prev) => [...prev, { key: newKey(), name: "", amountText: "", userIds: [] }])}
                  accessibilityRole="button"
                  className="flex-row items-center gap-2"
                >
                  <Feather name="plus-circle" size={16} className="text-accent" />
                  <Text className="font-sans-semibold text-sm text-accent">Add item</Text>
                </Pressable>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Input label="Tax / tip / service" prefix="₹" keyboardType="decimal-pad" placeholder="0" value={extraText} onChangeText={setExtraText} />
                  </View>
                  <View className="flex-1">
                    <Input label="Discount" prefix="₹" keyboardType="decimal-pad" placeholder="0" value={discountText} onChangeText={setDiscountText} />
                  </View>
                </View>
                <Text className="font-sans text-xs text-muted">Tax and discount are shared in proportion to what each person had.</Text>
                {amountCents > 0 ? (
                  <View className="gap-1 border-t border-border pt-3">
                    {shares
                      .filter((s) => s.owedCents > 0)
                      .map((s) => {
                        const p = participants.find((x) => x.id === s.userId);
                        return (
                          <View key={s.userId} className="flex-row justify-between">
                            <Text className="font-sans text-sm text-text">{p ? nameOf(p) : "Someone"}</Text>
                            <Text className="font-sans-medium text-sm text-text">{formatCents(s.owedCents, currency)}</Text>
                          </View>
                        );
                      })}
                  </View>
                ) : null}
              </View>
            ) : splitType !== "equal" && participants.length > 0 ? (
              <View className="gap-2">
                {participants.map((p) => (
                  <View key={p.id} className="flex-row items-center justify-between gap-3">
                    <View className="flex-1 flex-row items-center gap-2">
                      <Avatar id={p.id} name={p.name} size="xs" />
                      <Text numberOfLines={1} className="flex-1 font-sans text-sm text-text">{nameOf(p)}</Text>
                    </View>
                    <View className="w-28">
                      <Input
                        label={`Amount for ${p.id === currentUser.id ? "you" : p.name}`}
                        hideLabel
                        keyboardType="decimal-pad"
                        prefix={splitType === "percentage" ? "%" : splitType === "shares" ? "x" : "₹"}
                        value={inputs[p.id] ? String(splitType === "percentage" || splitType === "shares" ? inputs[p.id] : inputs[p.id] / 100) : ""}
                        onChangeText={(t) => {
                          const raw = parseFloat(t || "0") || 0;
                          const v = splitType === "percentage" || splitType === "shares" ? raw : Math.round(raw * 100);
                          setInputs((prev) => ({ ...prev, [p.id]: v }));
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="font-sans text-sm text-muted">
                Splits {formatCents(Math.floor(amountCents / Math.max(participants.length, 1)), currency)} each.
              </Text>
            )}

            {remainder.message ? (
              <Text className={`font-sans-medium text-xs ${remainder.balanced ? "text-muted" : "text-danger"}`} accessibilityLiveRegion="polite">
                {remainder.message}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Repeats</Text>
          <SegmentedControl options={REPEAT_OPTIONS} value={repeatInterval} onChange={setRepeatInterval} />
          {repeatInterval !== "none" ? (
            <Text className="font-sans text-xs text-muted">
              Tabmate adds it automatically every {repeatInterval === "fortnightly" ? "two weeks" : repeatInterval.replace("ly", "")}, starting from this date.
            </Text>
          ) : null}
        </View>

        <Input label="Notes (optional)" placeholder="Anything to remember about this" value={notes} onChangeText={setNotes} multiline />

        <Button label={editing ? "Update the tab" : "Add to the tab"} size="lg" loading={saving} onPress={submit} />
      </ScrollView>
    </SafeAreaView>
  );
}

function itemizedCheck(items: ItemDraft[]): { balanced: boolean; message: string } {
  const priced = items.filter((i) => toCents(i.amountText) > 0);
  if (priced.length === 0) return { balanced: false, message: "Add at least one item with a price." };
  const unassigned = priced.filter((i) => i.userIds.length === 0);
  if (unassigned.length > 0) {
    return { balanced: false, message: `Pick who had ${unassigned[0].name.trim() || "each item"}.` };
  }
  return { balanced: true, message: "" };
}
