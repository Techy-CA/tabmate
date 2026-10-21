import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Toggle } from "@/components/Toggle";
import { useAppLock } from "@/lib/appLock";
import { confirmAction } from "@/lib/confirm";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";
import { unregisterPush } from "@/lib/push";

export default function SecuritySettings() {
  const router = useRouter();
  const { currentUser, deleteAccount } = useData();
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const { available, enabled, setEnabled } = useAppLock();
  const [message, setMessage] = useState<string | undefined>();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/account")}>
          <Feather name="arrow-left" size={22} className="text-text" />
        </Pressable>
        <Text className="font-display text-lg text-text">Security</Text>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-1 rounded-lg border border-border bg-surface p-4">
          <Text className="font-sans-semibold text-sm text-text">Signed in as</Text>
          <Text className="font-sans text-sm text-muted">{currentUser.email}</Text>
        </View>

        <View>
          <Toggle
            label="App lock"
            description={
              Platform.OS === "web"
                ? "Available in the Android app"
                : available
                  ? "Ask for fingerprint, face or phone PIN when opening Tabmate"
                  : "Set up a fingerprint or screen lock on your phone first"
            }
            value={enabled}
            onChange={async (on) => {
              setMessage(undefined);
              const res = await setEnabled(on);
              if (res === "unavailable") setMessage("This phone has no fingerprint or screen lock set up.");
              if (res === "cancelled") setMessage("App lock wasn't turned on.");
            }}
          />
          {message ? <Text className="font-sans text-xs text-danger">{message}</Text> : null}
        </View>

        <Text className="font-sans text-xs text-muted">
          To change your password, log out and use &quot;Forgot password?&quot; on the login screen.
        </Text>

        <View className="gap-2 border-t border-border pt-5">
          <Text className="font-sans-semibold text-sm text-danger">Delete account</Text>
          <Text className="font-sans text-xs text-muted">
            Removes your login and personal details (name, email, mobile number, payment IDs) permanently. Expenses you
            shared stay in your friends&apos; history as &quot;Deleted user&quot; so their balances remain correct. Settle up
            first if you can.
          </Text>
          <Button
            label="Delete my account"
            variant="danger"
            onPress={() =>
              confirmAction({
                title: "Delete your account?",
                message: "This can't be undone. You'll be signed out and your personal details erased.",
                confirmLabel: "Delete forever",
                destructive: true,
                onConfirm: async () => {
                  setDeleteError(undefined);
                  try {
                    await unregisterPush();
                    await deleteAccount();
                    router.replace("/welcome");
                  } catch (e) {
                    setDeleteError(e instanceof Error ? e.message : "Couldn't delete your account. Try again.");
                  }
                },
              })
            }
          />
          {deleteError ? <Text className="font-sans text-xs text-danger">{deleteError}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
