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

/**
 * Who owes whom, person to person. For each expense, every participant's
 * owed share is owed to the payer(s) in proportion to what each paid — the
 * same rule the server uses (pair_context_debts in migration 003), so the
 * app and the database never disagree. Payments between two people reduce
 * that pair's debt. Returns unrounded cents keyed "debtor>creditor".
 */
function pairwiseLedger(expenses: Expense[], payments: Payment[]) {
  const debt = new Map<string, number>();
  const add = (from: string, to: string, cents: number) => {
    if (from === to || cents === 0) return;
    debt.set(`${from}>${to}`, (debt.get(`${from}>${to}`) ?? 0) + cents);
  };
  for (const e of expenses) {
    if (e.deletedAt || e.amountCents <= 0) continue;
    for (const ower of e.shares) {
      if (ower.owedCents === 0) continue;
      for (const payer of e.shares) {
        if (payer.paidCents === 0) continue;
        add(ower.userId, payer.userId, (ower.owedCents * payer.paidCents) / e.amountCents);
      }
    }
  }
  for (const p of payments) {
    if (p.status !== "confirmed") continue;
    add(p.fromUserId, p.toUserId, -p.amountCents);
  }
  return debt;
}

/**
 * What one expense means between two people: positive = `other` owes `me`
 * because of it ("you lent X"), negative = `me` owes `other` ("X lent you").
 */
export function expensePairEffect(expense: Expense, me: string, other: string): number {
  return Math.round(pairNet(pairwiseLedger([expense], []), me, other));
}

/** What one expense means for `me` overall: paid minus own share. */
export function expenseNetFor(expense: Expense, me: string): number {
  const s = expense.shares.find((x) => x.userId === me);
  return s ? s.paidCents - s.owedCents : 0;
}

/** Net amount `other` owes `me` (negative = I owe them), unrounded. */
function pairNet(ledger: Map<string, number>, me: string, other: string) {
  return (ledger.get(`${other}>${me}`) ?? 0) - (ledger.get(`${me}>${other}`) ?? 0);
}

/**
 * What a friend owes me, split by context — each group, plus "" for
 * expenses/payments outside any group. Positive = they owe me.
 */
export function friendBalanceByContext(
  expenses: Expense[],
  payments: Payment[],
  me: string,
  friend: string
): Map<string, number> {
  const byContext = new Map<string, { e: Expense[]; p: Payment[] }>();
  const bucket = (groupId: string | undefined) => {
    const key = groupId ?? "";
    if (!byContext.has(key)) byContext.set(key, { e: [], p: [] });
    return byContext.get(key)!;
  };
  for (const e of expenses) {
    if (e.shares.some((s) => s.userId === me) && e.shares.some((s) => s.userId === friend)) bucket(e.groupId).e.push(e);
  }
  for (const p of payments) {
    const between = (p.fromUserId === me && p.toUserId === friend) || (p.fromUserId === friend && p.toUserId === me);
    if (between) bucket(p.groupId).p.push(p);
  }
  const result = new Map<string, number>();
  for (const [key, { e, p }] of byContext) {
    const cents = Math.round(pairNet(pairwiseLedger(e, p), me, friend));
    if (cents !== 0) result.set(key, cents);
  }
  return result;
}

/**
 * Settle-up suggestions inside a group when Simplify Debts is off: each pair
 * settles exactly what one owes the other directly.
 */
export function pairwiseTransfers(expenses: Expense[], payments: Payment[], currencyCode: string): Transfer[] {
  const ledger = pairwiseLedger(
    expenses.filter((e) => e.currencyCode === currencyCode),
    payments.filter((p) => p.currencyCode === currencyCode)
  );
  const people = new Set<string>();
  for (const key of ledger.keys()) for (const id of key.split(">")) people.add(id);
  const ids = [...people].sort();
  const transfers: Transfer[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const cents = Math.round(pairNet(ledger, ids[i], ids[j])); // ids[j] owes ids[i]
      if (cents > 0) transfers.push({ from: ids[j], to: ids[i], amountCents: cents, currencyCode });
      if (cents < 0) transfers.push({ from: ids[i], to: ids[j], amountCents: -cents, currencyCode });
    }
  }
  return transfers.sort((a, b) => b.amountCents - a.amountCents);
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };

export function currencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] ?? currencyCode;
}

export function formatCents(cents: number, currencyCode: string): string {
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? `${currencyCode} `;
  const sign = cents < 0 ? "-" : "";
  return `${sign}${symbol}${(Math.abs(cents) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
