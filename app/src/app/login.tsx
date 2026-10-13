import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth";

// S03 — Log in
export default function LogIn() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.includes("@") || password.length < 1) {
      setError("Enter your email and password to continue.");
      return;
    }
    setError(undefined);
    setLoading(true);
    await signIn(email);
    setLoading(false);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 gap-5 p-6 pt-12">
        <Text className="font-display text-xl text-text">Welcome back</Text>

        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={error}
        />

        <Button label="Log in" size="lg" loading={loading} onPress={submit} />
        <Button label="Forgot password?" variant="ghost" onPress={() => {}} />

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-border" />
          <Text className="font-sans text-xs text-muted">or</Text>
          <View className="h-px flex-1 bg-border" />
        </View>

        <Button
          label="Continue with Google"
          variant="secondary"
          size="lg"
          onPress={async () => {
            await signInWithGoogle();
            router.replace("/(tabs)");
          }}
        />
      </View>
    </SafeAreaView>
  );
}
