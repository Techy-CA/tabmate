import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

export default function EditName() {
  const router = useRouter();
  const { currentUser, updateCurrentUser } = useData();
  const [name, setName] = useState(currentUser.name);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError("Name can't be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateCurrentUser({ name: name.trim() });
      goBack(router, "/account");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => goBack(router, "/account")}>
          <Feather name="x" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">Edit name</Text>
      </View>

      <View className="gap-5 p-6">
        <Input label="Name" value={name} onChangeText={setName} error={error} autoFocus />
        <Button label="Save" size="lg" loading={saving} onPress={save} />
      </View>
    </SafeAreaView>
  );
}
