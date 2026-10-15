import type { SplitType } from "./types";

export type ParticipantInput = {
  userId: string;
  // meaning depends on splitType: exact=cents, percentage=whole %, shares=share count, adjustment=cents
  value: number;
};

export type ComputedShare = { userId: string; owedCents: number };

/**
 * Turns the split-type form state into real per-person owed amounts that
 * always sum to exactly amountCents — any rounding remainder lands on the
 * first participant, same rule the UI's remainder line warns about before
 * submit (recon.md S07's "doesn't add up" error state).
 */
export function computeShares(
  splitType: SplitType,
  amountCents: number,
  participantIds: string[],
  inputs: Record<string, number>
): ComputedShare[] {
  if (participantIds.length === 0) return [];

  if (splitType === "equal") {
    const base = Math.floor(amountCents / participantIds.length);
    let remainder = amountCents - base * participantIds.length;
    return participantIds.map((userId) => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder--;
      return { userId, owedCents: base + extra };
    });
  }

  if (splitType === "exact") {
    return participantIds.map((userId) => ({ userId, owedCents: Math.round(inputs[userId] ?? 0) }));
  }

  if (splitType === "percentage") {
    const shares = participantIds.map((userId) => ({
      userId,
      owedCents: Math.round((amountCents * (inputs[userId] ?? 0)) / 100),
    }));
    fixRemainder(shares, amountCents);
    return shares;
  }

  if (splitType === "shares") {
    const totalShares = participantIds.reduce((s, id) => s + (inputs[id] ?? 0), 0) || 1;
    const shares = participantIds.map((userId) => ({
      userId,
      owedCents: Math.round((amountCents * (inputs[userId] ?? 0)) / totalShares),
    }));
    fixRemainder(shares, amountCents);
    return shares;
  }

  if (splitType === "adjustment") {
    const totalAdjustment = participantIds.reduce((s, id) => s + (inputs[id] ?? 0), 0);
    const equalPortion = Math.floor((amountCents - totalAdjustment) / participantIds.length);
    const shares = participantIds.map((userId) => ({
      userId,
      owedCents: equalPortion + (inputs[userId] ?? 0),
    }));
    fixRemainder(shares, amountCents);
    return shares;
  }

  // itemized: not computed here — built from expense_items in a later pass.
  return participantIds.map((userId) => ({ userId, owedCents: 0 }));
}

export type BillItem = { name: string; amountCents: number; userIds: string[] };

/**
 * Itemized ("who had what") split. Each item is shared equally by the people
 * who had it; tax/tip/service charge and discount are spread in proportion
 * to each person's item subtotal (how restaurants and delivery apps work).
 * Always sums to exactly the bill total; returns that total too.
 */
export function computeItemizedShares(
  items: BillItem[],
  extraCents: number,
  discountCents: number,
  participantIds: string[]
): { shares: ComputedShare[]; totalCents: number } {
  const subtotal = new Map<string, number>(participantIds.map((id) => [id, 0]));
  for (const it of items) {
    const people = it.userIds.filter((id) => subtotal.has(id));
    if (it.amountCents <= 0 || people.length === 0) continue;
    const base = Math.floor(it.amountCents / people.length);
    let rest = it.amountCents - base * people.length;
    for (const id of people) {
      subtotal.set(id, (subtotal.get(id) ?? 0) + base + (rest > 0 ? 1 : 0));
      if (rest > 0) rest--;
    }
  }
  const itemsTotal = [...subtotal.values()].reduce((a, b) => a + b, 0);
  const totalCents = Math.max(itemsTotal + extraCents - discountCents, 0);
  if (itemsTotal === 0) return { shares: participantIds.map((userId) => ({ userId, owedCents: 0 })), totalCents };

  const shares = participantIds.map((userId) => ({
    userId,
    owedCents: Math.round(((subtotal.get(userId) ?? 0) * totalCents) / itemsTotal),
  }));
  // rounding leftovers go to whoever had the most, not just the first person
  const sum = shares.reduce((s, x) => s + x.owedCents, 0);
  if (sum !== totalCents) {
    const biggest = shares.reduce((a, b) => (b.owedCents > a.owedCents ? b : a));
    biggest.owedCents += totalCents - sum;
  }
  return { shares, totalCents };
}

function fixRemainder(shares: ComputedShare[], amountCents: number) {
  const sum = shares.reduce((s, x) => s + x.owedCents, 0);
  const diff = amountCents - sum;
  if (diff !== 0 && shares.length > 0) shares[0].owedCents += diff;
}

export function remainderLabel(
  splitType: SplitType,
  amountCents: number,
  participantIds: string[],
  inputs: Record<string, number>
): { balanced: boolean; message: string } {
  if (splitType === "equal") return { balanced: true, message: "" };

  if (splitType === "exact") {
    const sum = participantIds.reduce((s, id) => s + (inputs[id] ?? 0), 0);
    const diff = amountCents - sum;
    return diff === 0
      ? { balanced: true, message: "Splits add up." }
      : { balanced: false, message: `${diff > 0 ? "₹" + (diff / 100).toFixed(2) + " left to assign" : "Over by ₹" + (-diff / 100).toFixed(2)}` };
  }

  if (splitType === "percentage") {
    const sum = participantIds.reduce((s, id) => s + (inputs[id] ?? 0), 0);
    return sum === 100
      ? { balanced: true, message: "Splits add up to 100%." }
      : { balanced: false, message: `${(100 - sum).toFixed(0)}% left to assign` };
  }

  if (splitType === "shares") {
    const total = participantIds.reduce((s, id) => s + (inputs[id] ?? 0), 0);
    return total > 0 ? { balanced: true, message: `${total} total shares` } : { balanced: false, message: "Assign at least one share" };
  }

  if (splitType === "adjustment") {
    return { balanced: true, message: "Remaining amount splits equally after adjustments." };
  }

  return { balanced: true, message: "" };
}
