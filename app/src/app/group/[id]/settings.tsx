import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Toggle } from "@/components/Toggle";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

// S12 — Group settings
export default function GroupSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getGroup, listGroupMembers, updateGroup, removeMember, leaveGroup, createGroupInvite, currentUser } =
    useData();

  const group = getGroup(id);
  const [name, setName] = useState(group?.name ?? "");

  if (!group) return null;
  const members = listGroupMembers(group.id);

  const invite = async () => {
    const code = createGroupInvite(group.id);
    await Share.share({ message: `Join "${group.name}" on Splitsy — invite code: ${code}` });
  };

  const confirmLeave = () => {
    Alert.alert("Leave group?", `You'll stop seeing expenses in ${group.name}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          leaveGroup(group.id);
          router.replace("/(tabs)");
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, `/group/${id}`)}>
          <Feather name="arrow-left" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Group settings</Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6">
        <Input
          label="Group name"
          value={name}
          onChangeText={setName}
          onBlur={() => name.trim() && name !== group.name && updateGroup(group.id, { name: name.trim() })}
        />

        <View className="gap-1">
          <Text className="font-sans-semibold text-sm text-text">Members</Text>
          {members.map((m) => (
            <View key={m.id} className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center gap-3">
                <Avatar id={m.id} name={m.name} size="sm" />
                <Text className="font-sans text-sm text-text">{m.name}</Text>
              </View>
              {m.id !== currentUser.id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${m.name}`}
                  onPress={() => removeMember(group.id, m.id)}
                >
                  <Feather name="x" size={18} color="#6b7280" />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Button label="Invite via link" variant="secondary" onPress={invite} />
        </View>

        <View className="border-t border-border">
          <Toggle
            label="Simplify Debts"
            description="Minimize the number of payments needed to settle up. Never changes anyone's total balance."
            value={group.simplifyDebts}
            onChange={(v) => updateGroup(group.id, { simplifyDebts: v })}
          />
        </View>

        <Button label="Leave group" variant="danger" onPress={confirmLeave} />
      </ScrollView>
    </SafeAreaView>
  );
}
