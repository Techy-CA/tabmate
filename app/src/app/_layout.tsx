import "../../global.css";

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts as useInter } from "@expo-google-fonts/inter";
import { Manrope_700Bold, useFonts as useManrope } from "@expo-google-fonts/manrope";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ConfirmDialogHost } from "@/components/ConfirmDialogHost";
import { AppLockProvider } from "@/lib/appLock";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DataProvider, useOptionalData } from "@/lib/data/store";
import { usePushNotifications } from "@/lib/push";
import { supabaseConfigError } from "@/lib/supabase";
import { ThemeProvider, useTheme } from "@/lib/theme";

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

// Applies the light/dark colour variables to everything below it.
function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { rootStyle, colors, scheme } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, rootStyle]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {children}
    </View>
  );
}

function AppStack() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
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
      <ThemeProvider>
        <ThemedRoot>
          <AppLockProvider>
            <AuthProvider>
              <DataProvider>
                <AppStack />
                <ConfirmDialogHost />
                <PushBridge />
              </DataProvider>
            </AuthProvider>
          </AppLockProvider>
        </ThemedRoot>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
