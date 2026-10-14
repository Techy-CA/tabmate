import type { Expense, RepeatInterval } from "./types";

function addInterval(dateStr: string, interval: RepeatInterval): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  switch (interval) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "fortnightly":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case "none":
      break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Client-side stand-in for the `post_recurring_expenses` pg_cron job
 * (replica/architecture.md) — there's no backend yet, so each series catches
 * itself up to today once here, the same state a client would see if the
 * real job had already run. Returns only the newly-generated instances.
 */
export function expandDueRecurringExpenses(expenses: Expense[], today = new Date().toISOString().slice(0, 10)): Expense[] {
  const generated: Expense[] = [];

  for (const root of expenses) {
    // Only a series' root (no recurringTemplateId of its own) drives
    // generation — a generated child is never itself a new root.
    if (root.repeatInterval === "none" || root.recurringTemplateId || root.deletedAt) continue;

    const seriesDates = expenses
      .filter((e) => e.id === root.id || e.recurringTemplateId === root.id)
      .map((e) => e.expenseDate)
      .sort();
    let cursor = seriesDates.at(-1)!;
    let next = addInterval(cursor, root.repeatInterval);

    while (next <= today) {
      generated.push({
        ...root,
        id: `e-${Math.random().toString(36).slice(2, 10)}`,
        expenseDate: next,
        recurringTemplateId: root.id,
        deletedAt: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      cursor = next;
      next = addInterval(cursor, root.repeatInterval);
    }
  }

  return generated;
}
