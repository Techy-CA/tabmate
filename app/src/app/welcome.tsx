import { Redirect, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";

// S01 — Welcome / splash
export default function Welcome() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  if (loading) return null;
  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "bottom"]}>
      <View className="flex-1 justify-between p-6">
        <View />

        <View className="gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-lg bg-accent">
            <Text className="font-display text-xl text-on-accent">T</Text>
          </View>
          <Text className="font-display text-display text-text">Settle up.{"\n"}Stay mates.</Text>
          <Text className="font-sans text-base text-muted">
            Track what everyone chips in for: trips, rent, dinners. Settle up without the
            awkward maths. No caps on how much you can add, ever.
          </Text>
        </View>

        <View className="gap-3">
          <Button label="Create an account" size="lg" onPress={() => router.push("/signup")} />
          <Button
            label="I already have an account"
            variant="secondary"
            size="lg"
            onPress={() => router.push("/login")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
