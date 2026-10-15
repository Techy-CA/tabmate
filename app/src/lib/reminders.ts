import { Linking, Platform, Share } from "react-native";

import { formatCents } from "@/lib/data/balances";
import type { Transfer, User } from "@/lib/data/types";

// WhatsApp is where Indian friend groups actually talk, so reminders and
// group summaries go there first; SMS / the share sheet are the fallback.

const firstName = (u: User | undefined) => u?.name.split(" ")[0] ?? "Someone";

/** "Hey Rahul, quick reminder: you owe me ₹500 on Tabmate. UPI: soham@okaxis" */
export function reminderMessage(me: User, them: User, amountCents: number, currency: string, groupName?: string) {
  return [
    `Hey ${firstName(them)}, quick reminder: you owe me ${formatCents(amountCents, currency)}${groupName ? ` for "${groupName}"` : ""} on Tabmate.`,
    me.upiId ? `UPI: ${me.upiId}` : null,
    "Thanks! 🙏",
  ]
    .filter(Boolean)
    .join("\n");
}

/** WhatsApp chat summary: who owes whom, ready to paste into the group. */
export function groupSummaryMessage(
  groupName: string,
  transfers: Transfer[],
  getUser: (id: string) => User | undefined,
  extra: string[] = []
) {
  const name = (id: string) => {
    const u = getUser(id);
    return u?.isKitty ? "Kitty" : firstName(u);
  };
  const lines = transfers.length
    ? transfers.map((t) => `• ${name(t.from)} → ${name(t.to)}: ${formatCents(t.amountCents, t.currencyCode)}`)
    : ["Everyone is settled up 🎉"];
  return [`*${groupName}* — balances on Tabmate`, ...extra, "", ...lines].join("\n");
}

/** Opens WhatsApp (to this number if known), else SMS, else the share sheet. */
export async function sendViaWhatsApp(message: string, phone?: string | null) {
  const text = encodeURIComponent(message);
  const digits = phone?.replace(/\D/g, "");
  const urls = [
    digits ? `whatsapp://send?phone=${digits}&text=${text}` : `whatsapp://send?text=${text}`,
    digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`,
  ];
  if (Platform.OS !== "web") {
    for (const url of urls) {
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // WhatsApp not installed — try the next option
      }
    }
    if (digits) {
      try {
        await Linking.openURL(`sms:${phone}?body=${text}`);
        return;
      } catch {
        // fall through to the share sheet
      }
    }
  } else {
    window.open(urls[1], "_blank");
    return;
  }
  try {
    await Share.share({ message });
  } catch {
    // nothing else to try
  }
}
