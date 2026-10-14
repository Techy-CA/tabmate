import type {
  ActivityItem,
  Expense,
  Group,
  GroupMember,
  Payment,
  User,
} from "./types";

export const CURRENT_USER_ID = "u-you";

export const seedUsers: User[] = [
  { id: CURRENT_USER_ID, name: "You", email: "me@example.com", defaultCurrency: "INR", timezone: "Asia/Kolkata" },
  { id: "u-rhea", name: "Rhea Kapoor", email: "rhea@example.com", defaultCurrency: "INR", timezone: "Asia/Kolkata" },
  { id: "u-dev", name: "Dev Malhotra", email: "dev@example.com", defaultCurrency: "INR", timezone: "Asia/Kolkata" },
  { id: "u-ayaan", name: "Ayaan Sheikh", email: "ayaan@example.com", defaultCurrency: "INR", timezone: "Asia/Kolkata" },
  { id: "u-nisha", name: "Nisha Rao", email: "nisha@example.com", defaultCurrency: "INR", timezone: "Asia/Kolkata" },
  // Deliberately not in any group or expense — exists so "add a friend by
  // email" has a real not-yet-connected account to find.
  { id: "u-priya", name: "Priya Nair", email: "priya@example.com", defaultCurrency: "INR", timezone: "Asia/Kolkata" },
];

export const seedGroups: Group[] = [
  {
    id: "g-flat",
    name: "Indiranagar Flat",
    defaultCurrency: "INR",
    simplifyDebts: true,
    createdBy: CURRENT_USER_ID,
    createdAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "g-goa",
    name: "Goa Trip",
    defaultCurrency: "INR",
    simplifyDebts: true,
    createdBy: "u-rhea",
    createdAt: "2026-09-15T00:00:00Z",
  },
];

export const seedGroupMembers: GroupMember[] = [
  { groupId: "g-flat", userId: CURRENT_USER_ID, joinedAt: "2026-07-01T00:00:00Z" },
  { groupId: "g-flat", userId: "u-dev", joinedAt: "2026-07-01T00:00:00Z" },
  { groupId: "g-flat", userId: "u-ayaan", joinedAt: "2026-07-02T00:00:00Z" },
  { groupId: "g-goa", userId: CURRENT_USER_ID, joinedAt: "2026-09-15T00:00:00Z" },
  { groupId: "g-goa", userId: "u-rhea", joinedAt: "2026-09-15T00:00:00Z" },
  { groupId: "g-goa", userId: "u-nisha", joinedAt: "2026-09-16T00:00:00Z" },
];

export const seedExpenses: Expense[] = [
  {
    id: "e-rent",
    groupId: "g-flat",
    description: "October rent",
    amountCents: 4_500_000,
    currencyCode: "INR",
    category: "rent",
    expenseDate: "2026-10-01",
    splitType: "equal",
    repeatInterval: "monthly",
    createdBy: CURRENT_USER_ID,
    shares: [
      { userId: CURRENT_USER_ID, paidCents: 4_500_000, owedCents: 1_500_000 },
      { userId: "u-dev", paidCents: 0, owedCents: 1_500_000 },
      { userId: "u-ayaan", paidCents: 0, owedCents: 1_500_000 },
    ],
    createdAt: "2026-10-01T09:00:00Z",
    updatedAt: "2026-10-01T09:00:00Z",
  },
  {
    id: "e-groceries",
    groupId: "g-flat",
    description: "BigBasket groceries",
    amountCents: 320000,
    currencyCode: "INR",
    category: "groceries",
    expenseDate: "2026-10-08",
    splitType: "equal",
    repeatInterval: "none",
    createdBy: "u-dev",
    shares: [
      { userId: CURRENT_USER_ID, paidCents: 0, owedCents: 106667 },
      { userId: "u-dev", paidCents: 320000, owedCents: 106667 },
      { userId: "u-ayaan", paidCents: 0, owedCents: 106666 },
    ],
    createdAt: "2026-10-08T18:30:00Z",
    updatedAt: "2026-10-08T18:30:00Z",
  },
  {
    id: "e-wifi",
    groupId: "g-flat",
    description: "Wifi bill",
    amountCents: 120000,
    currencyCode: "INR",
    category: "utilities",
    expenseDate: "2026-10-05",
    splitType: "exact",
    repeatInterval: "monthly",
    createdBy: "u-ayaan",
    shares: [
      { userId: CURRENT_USER_ID, paidCents: 0, owedCents: 40000 },
      { userId: "u-dev", paidCents: 0, owedCents: 40000 },
      { userId: "u-ayaan", paidCents: 120000, owedCents: 40000 },
    ],
    createdAt: "2026-10-05T11:00:00Z",
    updatedAt: "2026-10-05T11:00:00Z",
  },
  {
    id: "e-flights",
    groupId: "g-goa",
    description: "Flights to Goa",
    amountCents: 1_800_000,
    currencyCode: "INR",
    category: "travel",
    expenseDate: "2026-09-20",
    splitType: "equal",
    repeatInterval: "none",
    createdBy: "u-rhea",
    shares: [
      { userId: CURRENT_USER_ID, paidCents: 0, owedCents: 600000 },
      { userId: "u-rhea", paidCents: 1_800_000, owedCents: 600000 },
      { userId: "u-nisha", paidCents: 0, owedCents: 600000 },
    ],
    createdAt: "2026-09-20T14:00:00Z",
    updatedAt: "2026-09-20T14:00:00Z",
  },
  {
    id: "e-villa",
    groupId: "g-goa",
    description: "Beach villa (3 nights)",
    amountCents: 2_400_000,
    currencyCode: "INR",
    category: "travel",
    expenseDate: "2026-09-21",
    splitType: "equal",
    repeatInterval: "none",
    createdBy: CURRENT_USER_ID,
    shares: [
      { userId: CURRENT_USER_ID, paidCents: 2_400_000, owedCents: 800000 },
      { userId: "u-rhea", paidCents: 0, owedCents: 800000 },
      { userId: "u-nisha", paidCents: 0, owedCents: 800000 },
    ],
    createdAt: "2026-09-21T10:00:00Z",
    updatedAt: "2026-09-21T10:00:00Z",
  },
  {
    id: "e-lunch-nisha",
    description: "Lunch at Cafe Mondegar",
    amountCents: 160000,
    currencyCode: "INR",
    category: "food",
    expenseDate: "2026-10-10",
    splitType: "equal",
    repeatInterval: "none",
    createdBy: "u-nisha",
    shares: [
      { userId: CURRENT_USER_ID, paidCents: 0, owedCents: 80000 },
      { userId: "u-nisha", paidCents: 160000, owedCents: 80000 },
    ],
    createdAt: "2026-10-10T13:15:00Z",
    updatedAt: "2026-10-10T13:15:00Z",
  },
];

export const seedPayments: Payment[] = [
  {
    id: "p-dev-partial",
    groupId: "g-flat",
    fromUserId: "u-dev",
    toUserId: CURRENT_USER_ID,
    amountCents: 500000,
    currencyCode: "INR",
    status: "confirmed",
    createdAt: "2026-10-09T08:00:00Z",
  },
];

export const seedActivity: ActivityItem[] = [
  { id: "a1", actorUserId: CURRENT_USER_ID, groupId: "g-flat", type: "expense_added", refId: "e-rent", metadata: { description: "October rent" }, createdAt: "2026-10-01T09:00:00Z" },
  { id: "a2", actorUserId: "u-ayaan", groupId: "g-flat", type: "expense_added", refId: "e-wifi", metadata: { description: "Wifi bill" }, createdAt: "2026-10-05T11:00:00Z" },
  { id: "a3", actorUserId: "u-dev", groupId: "g-flat", type: "expense_added", refId: "e-groceries", metadata: { description: "BigBasket groceries" }, createdAt: "2026-10-08T18:30:00Z" },
  { id: "a4", actorUserId: "u-dev", groupId: "g-flat", type: "payment_recorded", refId: "p-dev-partial", metadata: { description: "₹5,000 to You" }, createdAt: "2026-10-09T08:00:00Z" },
  { id: "a5", actorUserId: "u-nisha", type: "expense_added", refId: "e-lunch-nisha", metadata: { description: "Lunch at Cafe Mondegar" }, createdAt: "2026-10-10T13:15:00Z" },
];
