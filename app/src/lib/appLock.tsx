import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";

import { Button } from "@/components/Button";

// Optional fingerprint / face / device-PIN lock. Per device (AsyncStorage),
// asked on launch and whenever the app comes back after a short break.

const STORAGE_KEY = "tabmate.applock";
const RELOCK_AFTER_MS = 30_000;
const supported = Platform.OS !== "web";

type AppLockValue = {
  available: boolean;
  enabled: boolean;
  /** Turning it on asks for the fingerprint once, so nobody gets locked out by accident. */
  setEnabled: (on: boolean) => Promise<"ok" | "unavailable" | "cancelled">;
};

const AppLockContext = createContext<AppLockValue>({ available: false, enabled: false, setEnabled: async () => "unavailable" });

async function deviceCanAuthenticate() {
  if (!supported) return false;
  try {
    const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
    // a device PIN/pattern also works as the fallback even without biometrics
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return (hw && enrolled) || level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  // lock, and ask for the fingerprint straight away
  const unlock = useCallback(async () => {
    try {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Tabmate", disableDeviceFallback: false });
      if (res.success) setLocked(false);
    } catch {
      // stay locked; the button lets them retry
    }
  }, []);
  const lockNow = useCallback(() => {
    setLocked(true);
    unlock();
  }, [unlock]);

  useEffect(() => {
    if (!supported) return;
    deviceCanAuthenticate().then(setAvailable);
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "1") {
          setEnabledState(true);
          lockNow(); // locked on launch
        }
      })
      .catch(() => {});
  }, [lockNow]);

  useEffect(() => {
    if (!supported || !enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") backgroundedAt.current = Date.now();
      if (state === "active" && backgroundedAt.current && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) {
        lockNow();
      }
      if (state === "active") backgroundedAt.current = null;
    });
    return () => sub.remove();
  }, [enabled, lockNow]);

  const setEnabled = useCallback(async (on: boolean) => {
    if (!on) {
      setEnabledState(false);
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      return "ok" as const;
    }
    if (!(await deviceCanAuthenticate())) return "unavailable" as const;
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Confirm to turn on app lock" });
    if (!res.success) return "cancelled" as const;
    setEnabledState(true);
    await AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => {});
    return "ok" as const;
  }, []);

  return (
    <AppLockContext.Provider value={{ available, enabled, setEnabled }}>
      {children}
      {locked ? (
        <View className="absolute inset-0 items-center justify-center gap-5 bg-bg p-8">
          <View className="h-16 w-16 items-center justify-center rounded-pill bg-accent/10">
            <Feather name="lock" size={28} className="text-accent" />
          </View>
          <Text className="font-display text-xl text-text">Tabmate is locked</Text>
          <Text className="text-center font-sans text-sm text-muted">Use your fingerprint, face or phone PIN to continue.</Text>
          <Button label="Unlock" size="lg" onPress={unlock} />
        </View>
      ) : null}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  return useContext(AppLockContext);
}
