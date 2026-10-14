import type { User } from "./data/types";

export type PaymentLink = { label: string; icon: "credit-card" | "dollar-sign"; url: string };

/**
 * Builds one-tap deep links to the recipient's own payment handles — never
 * money the app moves itself, just a prefilled shortcut to the app the user
 * would open manually anyway (same pattern as Splitwise's own payment
 * buttons, minus the gateway integration we deliberately don't have).
 */
export function buildPaymentLinks(recipient: User, amountCents: number): PaymentLink[] {
  const amount = (amountCents / 100).toFixed(2);
  const links: PaymentLink[] = [];

  if (recipient.upiId) {
    const params = new URLSearchParams({
      pa: recipient.upiId,
      pn: recipient.name,
      am: amount,
      cu: "INR",
    });
    links.push({ label: "Pay via UPI", icon: "credit-card", url: `upi://pay?${params.toString()}` });
  }

  if (recipient.paypalMeHandle) {
    links.push({
      label: "Pay via PayPal",
      icon: "dollar-sign",
      url: `https://paypal.me/${encodeURIComponent(recipient.paypalMeHandle)}/${amount}`,
    });
  }

  if (recipient.venmoUsername) {
    const params = new URLSearchParams({
      txn: "pay",
      recipients: recipient.venmoUsername,
      amount,
    });
    links.push({ label: "Pay via Venmo", icon: "dollar-sign", url: `venmo://paycharge?${params.toString()}` });
  }

  return links;
}
