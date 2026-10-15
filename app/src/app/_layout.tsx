import "../../global.css";

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts as useInter } from "@expo-google-fonts/inter";
import { Manrope_700Bold, useFonts as useManrope } from "@expo-google-fonts/manrope";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ConfirmDialogHost } from "@/components/ConfirmDialogHost";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DataProvider, useOptionalData } from "@/lib/data/store";
import { usePushNotifications } from "@/lib/push";
import { supabaseConfigError } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Registers this device for push once signed in, and opens the right
// screen when a notification is tapped (also on a cold start from a tap).
function PushBridge() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const data = useOptionalData();
  usePushNotifications(router, isAuthenticated && !!data, data?.markNotificationRead);
  return null;
}

export default function RootLayout() {
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [manropeLoaded] = useManrope({ Manrope_700Bold });
  const ready = interLoaded && manropeLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  if (supabaseConfigError) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#ffffff" }}>
        <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Tabmate isn&apos;t configured</Text>
        <Text style={{ textAlign: "center", color: "#6b7280" }}>{supabaseConfigError}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <ConfirmDialogHost />
          <PushBridge />
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
