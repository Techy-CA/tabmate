// Mirrors replica/schema.sql. This is the fake, in-memory data layer for
// replica-build — function signatures match the RPCs in architecture.md so
// replica-backend can swap in real Supabase calls without touching screens.

export type SplitType = "equal" | "exact" | "percentage" | "shares" | "adjustment" | "itemized";
export type RepeatInterval = "none" | "weekly" | "fortnightly" | "monthly" | "yearly";
export type PaymentMethod = "manual" | "razorpay_link";
export type PaymentStatus = "pending" | "confirmed" | "failed" | "cancelled";
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
  email: string;
  avatarUrl?: string;
  defaultCurrency: string;
  timezone: string;
};

export type Group = {
  id: string;
  name: string;
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
  createdBy: string;
  shares: ExpenseShare[];
  items?: ExpenseItem[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
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
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
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
