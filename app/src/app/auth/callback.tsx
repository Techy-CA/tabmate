import * as Linking from "expo-linking";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { createSessionFromUrl, useAuth } from "@/lib/auth";

// Landing route for auth redirects: Google sign-in on web, and the
// "confirm your email" link opened on the phone (tabmate://auth/callback#…).
// On native Google sign-in the browser session already handed the URL back,
// but Android may also deliver it here as a deep link — harmless either way.
export default function AuthCallback() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const linkingUrl = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);
  const [noSession, setNoSession] = useState(false);

  useEffect(() => {
    const url = Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : linkingUrl;
    if (!url) return;
    createSessionFromUrl(url)
      .then((ok) => {
        // ok=false: the URL carried no session (e.g. an email link that was
        // already used) — fall through to the login screen.
        setNoSession(!ok);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Sign-in failed."));
  }, [linkingUrl]);

  if (isAuthenticated) return <Redirect href="/(tabs)" />;
  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg p-6">
        <Text className="text-center font-sans text-sm text-danger">{error}</Text>
        <Button label="Back to login" variant="secondary" onPress={() => router.replace("/login")} />
      </View>
    );
  }
  if (noSession) return <Redirect href="/login" />;
  // ok=true: waiting for onAuthStateChange to flip isAuthenticated.
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <ActivityIndicator className="text-accent" />
    </View>
  );
}
