import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { createSessionFromUrl, useAuth } from "@/lib/auth";

// Opened from the password-reset email (tabmate://reset-password#…). The
// link carries a short-lived recovery session; with it in place the user
// can set a new password.
export default function ResetPassword() {
  const router = useRouter();
  const { isAuthenticated, updatePassword } = useAuth();
  const linkingUrl = Linking.useLinkingURL();
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const url = Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : linkingUrl;
    if (!url) return;
    createSessionFromUrl(url)
      .then((ok) => {
        if (!ok && !isAuthenticated) setLinkError("This reset link is invalid or has expired. Request a new one.");
      })
      .catch((e) => setLinkError(e instanceof Error ? e.message : "This reset link didn't work."));
    // isAuthenticated deliberately omitted: only re-run for a new link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkingUrl]);

  const submit = async () => {
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setSaving(true);
    const err = await updatePassword(password);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace("/(tabs)");
  };

  if (linkError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-bg p-6">
        <Text className="text-center font-sans text-sm text-danger">{linkError}</Text>
        <Button label="Back to login" variant="secondary" onPress={() => router.replace("/login")} />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#5b5fef" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 gap-5 p-6 pt-12">
        <Text className="font-display text-xl text-text">Set a new password</Text>
        <Input label="New password" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secureTextEntry />
        <Input label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry error={error} />
        <Button label="Save password" size="lg" loading={saving} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}
