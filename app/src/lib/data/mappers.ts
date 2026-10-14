// Snake-case DB rows (schema.sql) -> camelCase app types (types.ts). One
// place for this so store.tsx's fetches and realtime handlers agree exactly.
import type { ActivityItem, Expense, ExpenseComment, Group, GroupMember, Payment, User } from "./types";

export function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    avatarUrl: (row.avatar_url as string | null) ?? undefined,
    defaultCurrency: row.default_currency as string,
    timezone: row.timezone as string,
    upiId: (row.upi_id as string | null) ?? undefined,
    paypalMeHandle: (row.paypal_me_handle as string | null) ?? undefined,
    venmoUsername: (row.venmo_username as string | null) ?? undefined,
  };
}

export function mapGroup(row: Record<string, unknown>): Group {
  return {
    id: row.id as string,
    name: row.name as string,
    coverPhotoUrl: (row.cover_photo_url as string | null) ?? undefined,
    defaultCurrency: row.default_currency as string,
    simplifyDebts: row.simplify_debts as boolean,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    deletedAt: (row.deleted_at as string | null) ?? undefined,
  };
}

export function mapGroupMember(row: Record<string, unknown>): GroupMember {
  return {
    groupId: row.group_id as string,
    userId: row.user_id as string,
    joinedAt: row.joined_at as string,
    leftAt: (row.left_at as string | null) ?? undefined,
  };
}

// expenses fetched with a nested `expense_shares(*)` select.
export function mapExpense(row: Record<string, unknown>): Expense {
  const shareRows = (row.expense_shares as Record<string, unknown>[] | null) ?? [];
  return {
    id: row.id as string,
    groupId: (row.group_id as string | null) ?? undefined,
    description: row.description as string,
    amountCents: Number(row.amount_cents),
    currencyCode: row.currency_code as string,
    category: row.category as string,
    expenseDate: row.expense_date as string,
    splitType: row.split_type as Expense["splitType"],
    repeatInterval: row.repeat_interval as Expense["repeatInterval"],
    recurringTemplateId: (row.recurring_template_id as string | null) ?? undefined,
    receiptUrl: (row.receipt_url as string | null) ?? undefined,
    createdBy: row.created_by as string,
    shares: shareRows.map((s) => ({
      userId: s.user_id as string,
      paidCents: Number(s.paid_share_cents),
      owedCents: Number(s.owed_share_cents),
    })),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? undefined,
  };
}

export function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    groupId: (row.group_id as string | null) ?? undefined,
    fromUserId: row.from_user_id as string,
    toUserId: row.to_user_id as string,
    amountCents: Number(row.amount_cents),
    currencyCode: row.currency_code as string,
    status: row.status as Payment["status"],
    createdAt: row.created_at as string,
  };
}

export function mapComment(row: Record<string, unknown>): ExpenseComment {
  return {
    id: row.id as string,
    expenseId: row.expense_id as string,
    userId: row.user_id as string,
    body: row.body as string,
    createdAt: row.created_at as string,
  };
}

export function mapActivity(row: Record<string, unknown>): ActivityItem {
  return {
    id: row.id as string,
    actorUserId: (row.actor_user_id as string | null) ?? undefined,
    groupId: (row.group_id as string | null) ?? undefined,
    type: row.type as ActivityItem["type"],
    refId: row.ref_id as string,
    metadata: (row.metadata as Record<string, string>) ?? {},
    createdAt: row.created_at as string,
  };
}

export type FriendshipRow = { userIdA: string; userIdB: string };
export function mapFriendship(row: Record<string, unknown>): FriendshipRow {
  return { userIdA: row.user_id_a as string, userIdB: row.user_id_b as string };
}
