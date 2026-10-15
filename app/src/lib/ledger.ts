import type { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import type { LedgerRowProps } from "@/components/LedgerRow";
import { expenseNetFor, expensePairEffect, formatCents } from "@/lib/data/balances";
import type { Expense, Payment, User } from "@/lib/data/types";

// Turns expenses and payments into history rows, worded from the current
// user's point of view: the right side is what the line means for you
// ("₹425 · you lent"), never the bill total.

export const CATEGORY_ICON: Record<string, ComponentProps<typeof Feather>["name"]> = {
  rent: "home",
  groceries: "shopping-cart",
  utilities: "zap",
  travel: "map-pin",
  food: "coffee",
  general: "file-text",
};

type RowData = Omit<LedgerRowProps, "onPress"> & { key: string; sortKey: string };
type GetUser = (id: string) => User | undefined;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-15" or an ISO timestamp -> "15 Oct" */
export function shortDate(iso: string) {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""}`;
}

export const firstName = (u: User | undefined) => u?.name.split(" ")[0] ?? "Someone";

const joinParts = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" · ");

function payerSummary(e: Expense, me: string, getUser: GetUser) {
  const payers = e.shares.filter((s) => s.paidCents > 0);
  const total = formatCents(e.amountCents, e.currencyCode);
  if (payers.length === 1) {
    return payers[0].userId === me ? `You paid ${total}` : `${firstName(getUser(payers[0].userId))} paid ${total}`;
  }
  return `${payers.length} people paid ${total}`;
}

function effect(cents: number, currency: string) {
  if (cents > 0) return { amount: formatCents(cents, currency), caption: "you lent", tone: "positive" as const };
  if (cents < 0) return { amount: formatCents(-cents, currency), caption: "you borrowed", tone: "negative" as const };
  return { caption: "settled", tone: "muted" as const };
}

/** An expense in a group (or search): who paid the bill, and your net from it. */
export function groupExpenseRow(e: Expense, me: string, getUser: GetUser, contextName?: string): RowData {
  const involved = e.shares.some((s) => s.userId === me);
  return {
    key: `e:${e.id}`,
    sortKey: `${e.expenseDate}|${e.createdAt}`,
    icon: CATEGORY_ICON[e.category] ?? "file-text",
    title: e.description,
    subtitle: joinParts(payerSummary(e, me, getUser), contextName, shortDate(e.expenseDate)),
    strikethrough: !!e.deletedAt,
    ...(involved ? effect(expenseNetFor(e, me), e.currencyCode) : { caption: "not involved", tone: "muted" as const }),
  };
}

/**
 * An expense on a friend's page: only what's between the two of you. The
 * page is already about that friend, so the row never repeats their name.
 */
export function friendExpenseRow(e: Expense, me: string, friendId: string, groupName?: string): RowData {
  return {
    key: `e:${e.id}`,
    sortKey: `${e.expenseDate}|${e.createdAt}`,
    title: e.description,
    subtitle: joinParts(groupName, shortDate(e.expenseDate)),
    strikethrough: !!e.deletedAt,
    ...effect(expensePairEffect(e, me, friendId), e.currencyCode),
  };
}

/**
 * A settle-up. On a friend's page (friendView) it reads "Paid you" / "You
 * paid" — no name, the page says who. In a group it names both people.
 */
export function paymentRow(p: Payment, me: string, getUser: GetUser, opts: { friendView?: boolean; contextName?: string } = {}): RowData {
  const cancelled = p.status === "cancelled";
  const iPaid = p.fromUserId === me;
  const iReceived = p.toUserId === me;
  const title = opts.friendView
    ? iPaid
      ? "You paid"
      : "Paid you"
    : `${iPaid ? "You" : firstName(getUser(p.fromUserId))} paid ${iReceived ? "you" : firstName(getUser(p.toUserId))}`;
  return {
    key: `p:${p.id}`,
    sortKey: `${p.createdAt.slice(0, 10)}|${p.createdAt}`,
    icon: opts.friendView ? undefined : "check-circle",
    title,
    subtitle: joinParts(opts.contextName, shortDate(p.createdAt), cancelled && "cancelled"),
    amount: formatCents(p.amountCents, p.currencyCode),
    caption: cancelled ? "cancelled" : iReceived ? "received" : iPaid ? "paid" : "payment",
    // money in = green, money out = red; a third party's payment is neutral
    tone: cancelled ? "muted" : iReceived ? "positive" : iPaid ? "negative" : "muted",
    strikethrough: cancelled,
  };
}

export function newestFirst<T extends { sortKey: string }>(rows: T[]) {
  return [...rows].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
