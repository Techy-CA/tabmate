// Mirrors replica/schema.sql (+ migrations). Rows are mapped from snake_case
// in mappers.ts; store.tsx loads them from Supabase.

export type SplitType = "equal" | "exact" | "percentage" | "shares" | "adjustment" | "itemized";
export type RepeatInterval = "none" | "weekly" | "fortnightly" | "monthly" | "yearly";
// Settle-up only ever records a payment made outside the app (cash, bank
// transfer, UPI the user did themselves) — Tabmate is an expense tracker
// between friends, not a payment processor, so there's no payment-gateway
// method or async pending/failed state to model.
export type PaymentStatus = "confirmed" | "cancelled";
export type ActivityType =
  | "expense_added"
  | "expense_updated"
  | "expense_deleted"
  | "payment_recorded"
  | "comment_added"
  | "member_joined"
  | "member_left"
  | "group_updated";

export type User = {
  id: string;
  name: string;
  // null for someone invited by number only
  email: string;
  /** Invited but hasn't signed up yet (migration 005). They can be in
   * groups and expenses like anyone; on sign-up they take over this record. */
  isPending: boolean;
  /** A group's common pool (migration 008) — a member that holds money, never a person. */
  isKitty: boolean;
  /** E.164, e.g. +919876543210 — optional, lets friends find you by number */
  phone?: string;
  avatarUrl?: string;
  defaultCurrency: string;
  timezone: string;
  // Payment handles the user has set on their own profile, read by Settle
  // Up to build a one-tap pay link to THEM — never collected or stored for
  // anyone else, and never used to move money through the app itself.
  upiId?: string;
  paypalMeHandle?: string;
  venmoUsername?: string;
  notificationPrefs: NotificationPrefs;
};

// Keys match the first word of a notification type (expense_added ->
// "expense"), plus "push" as the master switch for device push.
export type NotificationPrefs = {
  push: boolean;
  expense: boolean;
  payment: boolean;
  comment: boolean;
  group: boolean;
  friend: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  push: true,
  expense: true,
  payment: true,
  comment: true,
  group: true,
  friend: true,
};

export type AppNotification = {
  id: string;
  userId: string;
  actorUserId?: string;
  type: string;
  title: string;
  body: string;
  // data.url is an in-app route to open when the notification is tapped
  data: { url?: string } & Record<string, unknown>;
  readAt?: string;
  createdAt: string;
};

export type GroupType = "trip" | "home" | "couple" | "other";

export type Group = {
  id: string;
  name: string;
  groupType: GroupType;
  /** trip mode: yyyy-mm-dd */
  startDate?: string;
  endDate?: string;
  budgetCents?: number;
  coverPhotoUrl?: string;
  defaultCurrency: string;
  simplifyDebts: boolean;
  createdBy: string;
  createdAt: string;
  deletedAt?: string;
};

export type GroupMember = {
  groupId: string;
  userId: string;
  joinedAt: string;
  leftAt?: string;
};

export type GroupInvite = {
  id: string;
  groupId: string;
  code: string;
  createdBy: string;
  expiresAt: string;
};

export type ExpenseShare = {
  userId: string;
  paidCents: number;
  owedCents: number;
};

export type ExpenseItem = {
  id: string;
  name: string;
  amountCents: number;
  kind: "item" | "tax" | "tip" | "discount";
  assignedUserIds: string[];
};

export type Expense = {
  id: string;
  groupId?: string;
  description: string;
  amountCents: number;
  currencyCode: string;
  category: string;
  expenseDate: string;
  splitType: SplitType;
  repeatInterval: RepeatInterval;
  recurringTemplateId?: string;
  receiptUrl?: string;
  notes?: string;
  createdBy: string;
  shares: ExpenseShare[];
  items?: ExpenseItem[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type ExpenseHistoryEntry = {
  id: string;
  expenseId: string;
  changedBy?: string;
  action: "created" | "edited" | "deleted" | "restored";
  before?: ExpenseSnapshot;
  after?: ExpenseSnapshot;
  createdAt: string;
};

export type ExpenseSnapshot = {
  description: string;
  amount_cents: number;
  category: string;
  expense_date: string;
  notes: string | null;
  split_type: SplitType;
  shares: { user_id: string; paid_cents: number; owed_cents: number }[];
};

export type ExpenseComment = {
  id: string;
  expenseId: string;
  userId: string;
  body: string;
  createdAt: string;
};

export type Payment = {
  id: string;
  groupId?: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  currencyCode: string;
  status: PaymentStatus;
  createdAt: string;
  // A payment recorded outside a group is split across the groups where the
  // two people owe each other (migration 003); the pieces share a batchId,
  // and the largest piece's id equals it.
  batchId?: string;
};

export type ActivityItem = {
  id: string;
  actorUserId?: string;
  groupId?: string;
  type: ActivityType;
  refId: string;
  metadata: Record<string, string>;
  createdAt: string;
};

export type Balance = { userId: string; balanceCents: number; currencyCode: string };
export type Transfer = { from: string; to: string; amountCents: number; currencyCode: string };
