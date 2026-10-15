import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import type { Href, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

// Push delivery itself happens server-side: every row inserted into
// `notifications` is forwarded to the Expo push service by a trigger
// (migration 002). The app's only jobs are to register this device's token
// and to open the right screen when a notification is tapped.
// Native only — the web bundle uses push.web.ts instead.

const isNative = Platform.OS !== "web";

if (isNative) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

let registeredToken: string | null = null;

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  // Must exist before the permission prompt on Android 13+, and its id must
  // match the `channelId` the server sends ("default").
  await Notifications.setNotificationChannelAsync("default", {
    name: "Tabmate",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: "#5B5FEF",
  });
}

/**
 * Asks for permission (once) and stores this device's Expo push token
 * against the signed-in user. Never throws — push is best-effort, and the
 * in-app realtime notifications work regardless.
 */
export async function registerForPush(): Promise<"registered" | "denied" | "unavailable"> {
  if (!isNative) return "unavailable";
  try {
    await ensureAndroidChannel();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return "denied";

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    // Throws on Android if the build has no google-services.json (Firebase).
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc("register_push_token", { p_token: token, p_platform: Platform.OS });
    if (error) return "unavailable";
    registeredToken = token;
    return "registered";
  } catch (e) {
    console.warn("Push registration failed:", e);
    return "unavailable";
  }
}

/** Call before signing out so this device stops receiving the account's pushes. */
export async function unregisterPush() {
  if (!registeredToken) return;
  try {
    await supabase.rpc("unregister_push_token", { p_token: registeredToken });
  } catch {
    // signing out anyway
  }
  registeredToken = null;
}

type Router = ReturnType<typeof useRouter>;

function urlFrom(response: Notifications.NotificationResponse | null | undefined) {
  const url = response?.notification.request.content.data?.url;
  return typeof url === "string" && url.startsWith("/") ? url : null;
}

/**
 * Registers for push while signed in, and routes notification taps —
 * including the tap that cold-started the app — to the screen in data.url.
 */
export function usePushNotifications(router: Router, signedIn: boolean, onOpen?: (notificationId: string) => void) {
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (isNative && signedIn) registerForPush();
  }, [signedIn]);

  useEffect(() => {
    if (!isNative || !signedIn || !lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const url = urlFrom(lastResponse);
    const notificationId = lastResponse.notification.request.content.data?.notification_id;
    if (typeof notificationId === "string") onOpen?.(notificationId);
    if (url) router.push(url as Href);
  }, [lastResponse, signedIn, router, onOpen]);
}
