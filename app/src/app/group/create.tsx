import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

const SEARCH_THRESHOLD = 8;

// Part of F01 — new user creates a group (feeds into S04/S12)
export default function CreateGroup() {
  const router = useRouter();
  const { listFriends, listMyGroups, listGroupMembers, createGroup, currentUser } = useData();
  const friends = listFriends().sort((a, b) => a.name.localeCompare(b.name));
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const friendIds = new Set(friends.map((f) => f.id));
  // "Same people as…": earlier groups whose other members are all still
  // your friends — one tap selects them all (a new trip with the same gang).
  const previousGroups = listMyGroups()
    .map((g) => ({ group: g, others: listGroupMembers(g.id).filter((m) => m.id !== currentUser.id && friendIds.has(m.id)) }))
    .filter((x) => x.others.length > 0)
    .slice(0, 4);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (ids: string[]) => setSelected((prev) => new Set([...prev, ...ids]));

  const q = filter.trim().toLowerCase();
  const visibleFriends = q ? friends.filter((f) => f.name.toLowerCase().includes(q)) : friends;

  const submit = async () => {
    if (!name.trim()) {
      setError("Give your group a name.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const group = await createGroup(name.trim(), [...selected]);
      router.replace(`/group/${group.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the group. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">New group</Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6 pb-8" keyboardShouldPersistTaps="handled">
        <Input
          label="Group name"
          placeholder="e.g. Goa Trip, Flat 302, Office lunch"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(undefined);
          }}
          error={error}
          autoFocus
        />

        {previousGroups.length > 0 ? (
          <View className="gap-2">
            <Text className="font-sans-semibold text-sm text-text">Same people as</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {previousGroups.map(({ group, others }) => {
                const allIn = others.every((m) => selected.has(m.id));
                return (
                  <Pressable
                    key={group.id}
                    onPress={() => selectAll(others.map((m) => m.id))}
                    accessibilityRole="button"
                    accessibilityLabel={`Add everyone from ${group.name}`}
                    className={`gap-1 rounded-lg border px-3 py-2 ${allIn ? "border-accent bg-accent/5" : "border-border bg-bg"}`}
                  >
                    <Text className="font-sans-medium text-sm text-text">{group.name}</Text>
                    <Text className="font-sans text-xs text-muted">
                      {others.length} {others.length === 1 ? "person" : "people"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View className="gap-1">
          <View className="flex-row items-center justify-between pb-1">
            <Text className="font-sans-semibold text-sm text-text">Members</Text>
            <Text className="font-sans text-xs text-muted">{selected.size + 1} in group</Text>
          </View>

          {/* You're always in your own group — shown so the count adds up. */}
          <View className="flex-row items-center gap-3 border-b border-border py-3">
            <Avatar id={currentUser.id} name={currentUser.name} size="sm" />
            <Text className="flex-1 font-sans text-sm text-text">You</Text>
            <Feather name="check-circle" size={20} className="text-muted" />
          </View>

          {friends.length > SEARCH_THRESHOLD ? (
            <View className="py-2">
              <Input label="Search friends" hideLabel placeholder="Search friends" value={filter} onChangeText={setFilter} />
            </View>
          ) : null}

          {visibleFriends.map((f) => {
            const isSelected = selected.has(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => toggle(f.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                className="flex-row items-center gap-3 border-b border-border py-3"
              >
                <Avatar id={f.id} name={f.name} size="sm" />
                <Text className="flex-1 font-sans text-sm text-text">{f.name}</Text>
                <Feather
                  name={isSelected ? "check-circle" : "circle"}
                  size={20}
                  className={isSelected ? "text-accent" : "text-border-input"}
                />
              </Pressable>
            );
          })}

          {friends.length === 0 ? (
            <Text className="py-2 font-sans text-sm text-muted">No friends on Tabmate yet.</Text>
          ) : null}

          <Pressable
            onPress={() => router.push("/friend/add")}
            accessibilityRole="button"
            className="flex-row items-center gap-3 py-3"
          >
            <View className="h-8 w-8 items-center justify-center rounded-pill bg-surface">
              <Feather name="user-plus" size={15} className="text-accent" />
            </View>
            <Text className="flex-1 font-sans-medium text-sm text-accent">Add a new friend</Text>
          </Pressable>

          <Text className="font-sans text-xs text-muted">
            Anyone else can join later with the group&apos;s invite code (Group settings → Invite).
          </Text>
        </View>
      </ScrollView>

      {/* pinned so it's reachable however long the friend list gets */}
      <View className="border-t border-border p-4">
        <Button
          label={selected.size > 0 ? `Create group with ${selected.size + 1} people` : "Create group"}
          size="lg"
          loading={saving}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}
