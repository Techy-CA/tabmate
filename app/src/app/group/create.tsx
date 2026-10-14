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

// Part of F01 — new user creates a group (feeds into S04/S12)
export default function CreateGroup() {
  const router = useRouter();
  const { listFriends, createGroup } = useData();
  const friends = listFriends();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | undefined>();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (!name.trim()) {
      setError("Give your group a name.");
      return;
    }
    const group = createGroup(name.trim(), [...selected]);
    router.replace(`/group/${group.id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">New group</Text>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6">
        <Input label="Group name" placeholder="Indiranagar Flat" value={name} onChangeText={setName} error={error} autoFocus />

        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Add members</Text>
          {friends.length === 0 ? (
            <Text className="font-sans text-sm text-muted">
              You don&apos;t have any friends on Tabmate yet. You can invite people once the group is
              created.
            </Text>
          ) : (
            friends.map((f) => {
              const isSelected = selected.has(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => toggle(f.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  className={`flex-row items-center justify-between rounded-lg border p-3 ${
                    isSelected ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <Avatar id={f.id} name={f.name} size="sm" />
                    <Text className="font-sans text-sm text-text">{f.name}</Text>
                  </View>
                  {isSelected ? <Feather name="check-circle" size={20} color="#5b5fef" /> : null}
                </Pressable>
              );
            })
          )}
        </View>

        <Button label="Create group" size="lg" onPress={submit} />
      </ScrollView>
    </SafeAreaView>
  );
}
