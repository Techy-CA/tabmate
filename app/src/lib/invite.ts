import { Linking, Platform, Share } from "react-native";

const DOWNLOAD_URL = process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL;

/** The invite text for someone not on Tabmate yet. `target` is the email/number they should sign up with. */
export function inviteMessage(inviterName: string, target: string) {
  return [
    `${inviterName} added you on Tabmate to split expenses together.`,
    DOWNLOAD_URL ? `Get the app: ${DOWNLOAD_URL}` : null,
    `Sign up with ${target} — your shared groups and expenses will already be there.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** SMS when there's a number (Android opens Messages prefilled), share sheet otherwise. */
export async function sendInvite(message: string, phone?: string | null) {
  if (phone && Platform.OS !== "web") {
    try {
      await Linking.openURL(`sms:${phone}?body=${encodeURIComponent(message)}`);
      return;
    } catch {
      // no SMS app — fall back to the share sheet
    }
  }
  try {
    await Share.share({ message });
  } catch {
    // no share sheet (web preview) — nothing else to do
  }
}
