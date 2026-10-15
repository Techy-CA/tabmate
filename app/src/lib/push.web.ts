import type { useRouter } from "expo-router";

// Web build of push.ts: expo-notifications' native APIs (including the
// useLastNotificationResponse hook) throw on web, so the web bundle never
// imports it. In-app notifications still arrive over realtime.

type Router = ReturnType<typeof useRouter>;

export async function registerForPush(): Promise<"registered" | "denied" | "unavailable"> {
  return "unavailable";
}

export async function unregisterPush() {}

export function usePushNotifications(_router: Router, _signedIn: boolean, _onOpen?: (notificationId: string) => void) {}
