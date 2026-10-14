import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth";

// S02 — Sign up
export default function SignUp() {
  const router = useRouter();
  const { signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.includes("@")) {
      setError("Enter your name and a valid email to continue.");
      return;
    }
    setError(undefined);
    setLoading(true);
    await signUp(name);
    setLoading(false);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 gap-5 p-6 pt-12">
        <Text className="font-display text-xl text-text">Create your account</Text>

        <Input label="Your name" placeholder="Ayaan Sheikh" value={name} onChangeText={setName} autoFocus />
        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          error={error}
        />

        <Button label="Count me in" size="lg" loading={loading} onPress={submit} />

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

        <Text className="font-sans text-xs text-muted">
          By signing up, you accept Tabmate&apos;s Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}
