import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth";

// S02 — Sign up
export default function SignUp() {
  const router = useRouter();
  const { signUp, signInWithGoogle, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.includes("@") || password.length < 6) {
      setError("Enter your name, a valid email, and a password of at least 6 characters.");
      return;
    }
    setError(undefined);
    setLoading(true);
    const result = await signUp(name.trim(), email.trim(), password);
    setLoading(false);
    if (result === "confirm-email") {
      setCheckEmail(true);
      return;
    }
    if (result) {
      setError(result);
      return;
    }
    router.replace("/(tabs)");
  };

  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  if (checkEmail) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-bg p-6">
        <Text className="font-display text-xl text-text">Check your email</Text>
        <Text className="text-center font-sans text-sm text-muted">
          We sent a confirmation link to {email}. Open it on this phone and you&apos;ll be signed in.
        </Text>
        <Button label="Back to login" variant="secondary" onPress={() => router.replace("/login")} />
      </SafeAreaView>
    );
  }

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
        />
        <Input
          label="Password"
          placeholder="At least 6 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
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
            // On success this redirects the browser to Google — there's
            // nothing to navigate to afterward here. An error (e.g. Google
            // isn't configured as an auth provider yet) resolves instead of
            // redirecting, so it's safe to just show it.
            const err = await signInWithGoogle();
            if (err) setError(err);
          }}
        />

        <Text className="font-sans text-xs text-muted">
          By signing up, you accept Tabmate&apos;s Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}
