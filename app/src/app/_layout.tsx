import "../../global.css";

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts as useInter } from "@expo-google-fonts/inter";
import { Manrope_700Bold, useFonts as useManrope } from "@expo-google-fonts/manrope";
import { Stack } from "expo-router";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth";
import { DataProvider } from "@/lib/data/store";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [manropeLoaded] = useManrope({ Manrope_700Bold });
  const ready = interLoaded && manropeLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
