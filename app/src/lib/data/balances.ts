import type { Balance, Expense, Payment, Transfer } from "./types";

/**
 * Net balance per user: sum(paid) - sum(owed) across expenses, plus the
 * netting effect of payments already made. Positive = the group owes them,
 * negative = they owe the group. Matches architecture.md's get_group_balances.
 */
export function computeBalances(
  expenses: Expense[],
  payments: Payment[],
  currencyCode: string
): Balance[] {
  const net = new Map<string, number>();
  const bump = (userId: string, delta: number) => net.set(userId, (net.get(userId) ?? 0) + delta);

  for (const e of expenses) {
    if (e.deletedAt || e.currencyCode !== currencyCode) continue;
    for (const s of e.shares) {
      bump(s.userId, s.paidCents - s.owedCents);
    }
  }
  for (const p of payments) {
    if (p.status !== "confirmed" || p.currencyCode !== currencyCode) continue;
    // paying someone reduces what you're owed (or increases what you owe);
    // receiving a payment does the opposite.
    bump(p.fromUserId, p.amountCents);
    bump(p.toUserId, -p.amountCents);
  }

  return [...net.entries()]
    .filter(([, cents]) => cents !== 0)
    .map(([userId, balanceCents]) => ({ userId, balanceCents, currencyCode }));
}

/**
 * Simplify Debts: a greedy min-transaction-count algorithm. Repeatedly
 * matches the largest debtor against the largest creditor until every
 * balance is zero. This never changes anyone's total balance (recon.md,
 * "What is Simplify Debts?") — it only changes who pays whom.
 *
 * Greedy largest-vs-largest is optimal for minimizing transfer count in the
 * common case and is O(n log n); an exactly-optimal solver is NP-hard in
 * general, which is overkill for typical group sizes (a handful to a few
 * dozen people).
 */
export function simplifyDebts(balances: Balance[]): Transfer[] {
  if (balances.length === 0) return [];
  const currencyCode = balances[0].currencyCode;

  const debtors = balances.filter((b) => b.balanceCents < 0).map((b) => ({ ...b }));
  const creditors = balances.filter((b) => b.balanceCents > 0).map((b) => ({ ...b }));

  debtors.sort((a, b) => a.balanceCents - b.balanceCents); // most negative first
  creditors.sort((a, b) => b.balanceCents - a.balanceCents); // most positive first

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(-debtor.balanceCents, creditor.balanceCents);

    if (amount > 0) {
      transfers.push({ from: debtor.userId, to: creditor.userId, amountCents: amount, currencyCode });
      debtor.balanceCents += amount;
      creditor.balanceCents -= amount;
    }
    if (debtor.balanceCents === 0) i++;
    if (creditor.balanceCents === 0) j++;
  }
  return transfers;
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };

export function formatCents(cents: number, currencyCode: string): string {
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? `${currencyCode} `;
  const sign = cents < 0 ? "-" : "";
  return `${sign}${symbol}${(Math.abs(cents) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
