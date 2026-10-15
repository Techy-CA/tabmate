import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { DateField, localISODate } from "@/components/DateField";
import { Input } from "@/components/Input";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Toggle } from "@/components/Toggle";
import { useData } from "@/lib/data/store";
import { confirmAction } from "@/lib/confirm";
import { inviteMessage, sendInvite } from "@/lib/invite";
import { goBack } from "@/lib/nav";

// S12 — Group settings
export default function GroupSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    getGroup,
    listGroupMembers,
    listFriends,
    addGroupMember,
    updateGroup,
    removeMember,
    leaveGroup,
    createGroupInvite,
    getGroupKitty,
    enableKitty,
    currentUser,
  } = useData();

  const group = getGroup(id);
  const [name, setName] = useState(group?.name ?? "");
  const [inviteCode, setInviteCode] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [budgetText, setBudgetText] = useState(group?.budgetCents ? String(group.budgetCents / 100) : "");
  // "Add people": by email/number; newName is asked for when they're not on Tabmate
  const [addEntry, setAddEntry] = useState("");
  const [newName, setNewName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addInfo, setAddInfo] = useState<string | undefined>();

  if (!group) return null;
  const members = listGroupMembers(group.id).filter((m) => !m.isKitty);
  const kitty = getGroupKitty(group.id);
  const memberIds = new Set(members.map((m) => m.id));
  const friendsNotInGroup = listFriends()
    .filter((f) => !memberIds.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const run = async (action: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  };

  const invite = () => run(async () => {
    const code = await createGroupInvite(group.id);
    // Always show the code in-app — some platforms (web) have no Share
    // implementation at all, and even where Share works, showing the code
    // directly means the invitee can be told the code out loud or over
    // chat, not just via whatever the OS share sheet offers.
    setInviteCode(code);
    try {
      await Share.share({
        message: [
          `Join "${group.name}" on Tabmate to split expenses together.`,
          process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL ? `Get the app: ${process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL}` : null,
          `Then tap "Join a group" and enter code: ${code}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });
    } catch {
      // Share is unavailable (e.g. the web preview) — the on-screen code above is the fallback.
    }
  });

  const addByEntry = () =>
    run(async () => {
      if (!addEntry.trim() || adding) return;
      setAdding(true);
      setAddInfo(undefined);
      try {
        const res = await addGroupMember(group.id, { identifier: addEntry, name: needsName ? newName : undefined });
        if (res.status === "needs_name") {
          setNeedsName(true);
          return;
        }
        if (res.status === "invalid") throw new Error("Enter an email, or a mobile number (with country code if not Indian).");
        if (res.status === "self") throw new Error("You're already in this group.");
        const who = "user" in res && res.user ? res.user.name : "They";
        if (res.status === "already_member") {
          setAddInfo(`${who} is already in the group.`);
        } else {
          const pending = "user" in res && res.user?.pending;
          setAddInfo(pending ? `${who} added (invited) — they'll see this group when they join.` : `${who} added to the group.`);
          if (pending) {
            const target = ("email" in res && res.email) || ("phone" in res && res.phone) || addEntry.trim();
            sendInvite(inviteMessage(currentUser.name, target), "phone" in res ? res.phone : null);
          }
        }
        setAddEntry("");
        setNewName("");
        setNeedsName(false);
      } finally {
        setAdding(false);
      }
    });

  const confirmLeave = () => {
    confirmAction({
      title: "Leave group?",
      message: `You'll stop seeing expenses in ${group.name}.`,
      confirmLabel: "Leave",
      destructive: true,
      onConfirm: async () => {
        await run(async () => {
          await leaveGroup(group.id);
          router.replace("/(tabs)");
        });
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, `/group/${id}`)}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">Group settings</Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6">
        <Input
          label="Group name"
          value={name}
          onChangeText={setName}
          onBlur={() => {
            if (name.trim() && name !== group.name) run(() => updateGroup(group.id, { name: name.trim() }));
          }}
        />

        <View className="gap-1">
          <Text className="font-sans-semibold text-sm text-text">Members</Text>
          {members.map((m) => (
            <View key={m.id} className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center gap-3">
                <Avatar id={m.id} name={m.name} size="sm" />
                <View>
                  <Text className="font-sans text-sm text-text">{m.id === currentUser.id ? `${m.name} (you)` : m.name}</Text>
                  {m.isPending ? <Text className="font-sans text-xs text-muted">Invited · not on Tabmate yet</Text> : null}
                </View>
              </View>
              {m.id !== currentUser.id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${m.name}`}
                  onPress={() =>
                    confirmAction({
                      title: `Remove ${m.name}?`,
                      message: `They'll stop seeing expenses in ${group.name}. Their past expenses stay.`,
                      confirmLabel: "Remove",
                      destructive: true,
                      onConfirm: () => run(() => removeMember(group.id, m.id)),
                    })
                  }
                >
                  <Feather name="x" size={18} className="text-muted" />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        <View className="gap-3">
          <Text className="font-sans-semibold text-sm text-text">Add people</Text>

          {friendsNotInGroup.length > 0 ? (
            <View>
              {friendsNotInGroup.map((f) => (
                <View key={f.id} className="flex-row items-center gap-3 py-2">
                  <Avatar id={f.id} name={f.name} size="sm" />
                  <View className="flex-1">
                    <Text className="font-sans text-sm text-text">{f.name}</Text>
                    {f.isPending ? <Text className="font-sans text-xs text-muted">Invited</Text> : null}
                  </View>
                  <Pressable
                    onPress={() => run(() => addGroupMember(group.id, { userId: f.id }))}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${f.name}`}
                    className="rounded-pill border border-accent px-3 py-1"
                  >
                    <Text className="font-sans-semibold text-xs text-accent">Add</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Input
            label="Email or mobile number"
            placeholder="Email or mobile number"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={addEntry}
            onChangeText={(t) => {
              setAddEntry(t);
              setNeedsName(false);
              setAddInfo(undefined);
            }}
            onSubmitEditing={addByEntry}
          />
          {needsName ? (
            <>
              <Text className="font-sans text-xs text-muted">
                Not on Tabmate yet — add them anyway and they&apos;ll see everything when they join.
              </Text>
              <Input label="Their name" placeholder="e.g. Chinmay" value={newName} onChangeText={setNewName} autoFocus />
            </>
          ) : null}
          <Button
            label={needsName ? "Add & send invite" : "Add to group"}
            variant="secondary"
            loading={adding}
            disabled={!addEntry.trim() || (needsName && !newName.trim())}
            onPress={addByEntry}
          />
          {addInfo ? <Text className="font-sans text-sm text-success">{addInfo}</Text> : null}

          <Button label="Share invite code" variant="ghost" onPress={invite} />
          {inviteCode ? (
            <View className="flex-row items-center justify-between rounded-md bg-surface px-3 py-2">
              <Text className="font-sans text-xs text-muted">
                Invite code: <Text className="font-sans-semibold text-text">{inviteCode}</Text>
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-3">
          <Text className="font-sans-semibold text-sm text-text">Group type</Text>
          <SegmentedControl
            options={[
              { value: "trip", label: "Trip" },
              { value: "home", label: "Home" },
              { value: "couple", label: "Couple" },
              { value: "other", label: "Other" },
            ]}
            value={group.groupType}
            onChange={(v) =>
              run(() =>
                updateGroup(group.id, {
                  groupType: v,
                  // a trip starts today unless dates are already set
                  ...(v === "trip" && !group.startDate ? { startDate: localISODate() } : {}),
                })
              )
            }
          />
          {group.groupType === "trip" ? (
            <View className="gap-4 rounded-lg border border-border p-4">
              <DateField
                label="Trip starts"
                allowFuture
                value={group.startDate ?? localISODate()}
                onChange={(d) => run(() => updateGroup(group.id, { startDate: d }))}
              />
              <DateField
                label="Trip ends"
                allowFuture
                value={group.endDate ?? group.startDate ?? localISODate()}
                onChange={(d) => run(() => updateGroup(group.id, { endDate: d }))}
              />
              <Input
                label="Trip budget (optional)"
                prefix="₹"
                keyboardType="decimal-pad"
                placeholder="e.g. 50000"
                value={budgetText}
                onChangeText={setBudgetText}
                onBlur={() => {
                  const cents = Math.round((parseFloat(budgetText || "0") || 0) * 100);
                  if (cents !== (group.budgetCents ?? 0)) run(() => updateGroup(group.id, { budgetCents: cents || undefined }));
                }}
              />
              <Text className="font-sans text-xs text-muted">
                The group screen shows the trip day, spend per person per day, and how much budget is left.
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-2 rounded-lg border border-border p-4">
          <Text className="font-sans-semibold text-sm text-text">Kitty (common pool)</Text>
          {kitty ? (
            <Text className="font-sans text-sm text-muted">
              This group has a kitty. Use &quot;Add money&quot; on the group screen to put money in, and pick &quot;Kitty&quot; as
              the payer when an expense is paid from it.
            </Text>
          ) : (
            <>
              <Text className="font-sans text-sm text-muted">
                Everyone puts money into one pool and shared costs are paid from it — handy for trips. Balances still work out
                automatically.
              </Text>
              <Button label="Start a kitty" variant="secondary" onPress={() => run(() => enableKitty(group.id))} />
            </>
          )}
        </View>

        <View className="border-t border-border">
          <Toggle
            label="Simplify Debts"
            description="Minimize the number of payments needed to settle up. Never changes anyone's total balance."
            value={group.simplifyDebts}
            onChange={(v) => run(() => updateGroup(group.id, { simplifyDebts: v }))}
          />
        </View>

        {error ? <Text className="font-sans text-sm text-danger">{error}</Text> : null}

        <Button label="Leave group" variant="danger" onPress={confirmLeave} />
      </ScrollView>
    </SafeAreaView>
  );
}
