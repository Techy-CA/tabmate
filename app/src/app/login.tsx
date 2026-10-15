import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth";

// S03 — Log in
export default function LogIn() {
  const router = useRouter();
  const { signIn, signInWithGoogle, sendPasswordReset, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [info, setInfo] = useState<string | undefined>();

  const forgotPassword = async () => {
    setInfo(undefined);
    if (!email.includes("@")) {
      setError("Enter your email above first, then tap \"Forgot password?\".");
      return;
    }
    setError(undefined);
    const err = await sendPasswordReset(email.trim());
    if (err) setError(err);
    else setInfo(`We sent a reset link to ${email.trim()}. Open it on this phone.`);
  };

  const submit = async () => {
    if (!email.includes("@") || password.length < 1) {
      setError("Enter your email and password to continue.");
      return;
    }
    setError(undefined);
    setLoading(true);
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace("/(tabs)");
  };

  // Google sign-in completes asynchronously (browser round trip); once the
  // session lands, leave the login screen.
  if (isAuthenticated) return <Redirect href="/(tabs)" />;

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
        <Button label="Forgot password?" variant="ghost" onPress={forgotPassword} />
        {info ? <Text className="text-center font-sans text-sm text-success">{info}</Text> : null}

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-border" />
          <Text className="font-sans text-xs text-muted">or</Text>
          <View className="h-px flex-1 bg-border" />
        </View>

        <Button
          label="Continue with Google"
          variant="secondary"
          size="lg"
          loading={googleLoading}
          onPress={async () => {
            setError(undefined);
            setGoogleLoading(true);
            const err = await signInWithGoogle();
            setGoogleLoading(false);
            if (err) setError(err);
          }}
        />
      </View>
    </SafeAreaView>
  );
}
