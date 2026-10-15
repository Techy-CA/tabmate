import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

import { computeBalances, friendBalanceByContext, pairwiseTransfers, simplifyDebts } from "./balances";
import {
  mapActivity,
  mapComment,
  mapExpense,
  mapFriendship,
  mapGroup,
  mapGroupMember,
  mapHistory,
  mapNotification,
  mapPayment,
  mapUser,
  type FriendshipRow,
} from "./mappers";
import type {
  ActivityItem,
  AppNotification,
  Balance,
  Expense,
  ExpenseComment,
  ExpenseHistoryEntry,
  Group,
  GroupMember,
  NotificationPrefs,
  Payment,
  SplitType,
  Transfer,
  User,
} from "./types";

type NewExpenseInput = {
  groupId?: string;
  description: string;
  amountCents: number;
  currencyCode: string;
  category: string;
  expenseDate: string;
  splitType: SplitType;
  paidBy: { userId: string; amountCents: number }[];
  owedBy: { userId: string; owedCents: number }[];
  repeatInterval?: Expense["repeatInterval"];
  notes?: string;
  /** itemized bills: kept for display/editing; shares are computed by the app */
  items?: ExpenseItemInput[];
};

export type ExpenseItemInput = { name: string; amountCents: number; kind?: "item" | "tax" | "tip" | "discount"; userIds: string[] };

const itemsPayload = (items: ExpenseItemInput[]) =>
  items.map((i) => ({ name: i.name, amount_cents: i.amountCents, kind: i.kind ?? "item", user_ids: i.userIds }));

type NewPaymentInput = {
  groupId?: string;
  fromUserId?: string;
  toUserId: string;
  amountCents: number;
  currencyCode: string;
};

type AddedUser = { id: string; name: string; pending: boolean };
export type AddFriendResult =
  | { status: "added"; user: AddedUser }
  | { status: "already"; user: AddedUser }
  // not on Tabmate yet, created as a pending friend you can add to groups
  // and expenses right away; email/phone is where to send the invite
  | { status: "invited"; user: AddedUser; email: string | null; phone: string | null }
  // not on Tabmate and no name given yet — ask for one, then call again
  | { status: "needs_name"; email: string | null; phone: string | null }
  | { status: "self" }
  | { status: "invalid" };

export type AddGroupMemberResult =
  | AddFriendResult
  | ({ status: "added_to_group" | "already_member"; user_id: string } & Partial<{ user: AddedUser; email: string | null; phone: string | null }>);

/** A phone contact who's already on Tabmate, keyed by the contact's raw number/email. */
export type ContactMatch = { userId: string; name: string; isFriend: boolean };

type DataContextValue = {
  currentUser: User;
  users: User[];
  groups: Group[];
  groupMembers: GroupMember[];

  getUser: (id: string) => User | undefined;
  updateCurrentUser: (
    patch: Partial<Pick<User, "name" | "phone" | "defaultCurrency" | "upiId" | "paypalMeHandle" | "venmoUsername">>
  ) => Promise<void>;
  getGroup: (id: string) => Group | undefined;
  listMyGroups: () => Group[];
  listGroupMembers: (groupId: string) => User[];
  listFriends: () => User[];
  /** Email or mobile number — the server tells them apart. `name` is only
   * needed (and used) when they're not on Tabmate yet. */
  addFriend: (identifier: string, name?: string) => Promise<AddFriendResult>;
  /** Add an existing friend by id, or anyone by email/number (+ name if new). */
  addGroupMember: (
    groupId: string,
    who: { userId: string } | { identifier: string; name?: string }
  ) => Promise<AddGroupMemberResult>;
  /** Which of these phone contacts are on Tabmate; keyed by the raw phone/email passed in. */
  matchContacts: (phones: string[], emails: string[]) => Promise<Map<string, ContactMatch>>;

  getGroupExpenses: (groupId: string) => Expense[];
  getExpense: (id: string) => Expense | undefined;
  getFriendExpenses: (friendId: string) => Expense[];
  listMyExpenses: () => Expense[];

  getGroupBalances: (groupId: string) => Balance[];
  getSimplifiedTransfers: (groupId: string) => Transfer[];
  /** Who should pay whom to settle the group: simplified when the group has
   * Simplify Debts on, otherwise each pair's direct debt. */
  getGroupTransfers: (groupId: string) => Transfer[];
  /** Positive = the friend owes me. Includes every group plus non-group. */
  getFriendBalance: (friendId: string) => number;
  /** The friend balance split by context: groupId, or "" for non-group. */
  getFriendBalanceByContext: (friendId: string) => Map<string, number>;
  getTotalBalance: () => number;

  createGroup: (name: string, memberIds: string[]) => Promise<Group>;
  updateGroup: (
    id: string,
    patch: Partial<Pick<Group, "name" | "simplifyDebts" | "groupType" | "startDate" | "endDate" | "budgetCents">>
  ) => Promise<void>;
  /** The group's kitty (common pool) member, if it has one. */
  getGroupKitty: (groupId: string) => User | undefined;
  enableKitty: (groupId: string) => Promise<string>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  createGroupInvite: (groupId: string) => Promise<string>;
  joinGroupByCode: (code: string) => Promise<Group | null>;
  previewGroupByCode: (code: string) => Promise<Group | null>;

  createExpense: (input: NewExpenseInput) => Promise<Expense>;
  updateExpense: (id: string, patch: Partial<Expense> & { itemsInput?: ExpenseItemInput[] }) => Promise<void>;
  getExpenseHistory: (expenseId: string) => Promise<ExpenseHistoryEntry[]>;
  softDeleteExpense: (id: string) => Promise<void>;
  restoreExpense: (id: string) => Promise<void>;

  createPayment: (input: NewPaymentInput) => Promise<Payment>;
  getPayment: (id: string) => Payment | undefined;
  getFriendPayments: (friendId: string) => Payment[];
  getGroupPayments: (groupId: string) => Payment[];
  cancelPayment: (id: string) => Promise<void>;
  /** In-app + push nudge to someone who owes you (max once a day per person). */
  sendReminder: (userId: string, amountCents: number, currencyCode: string) => Promise<"sent" | "too_soon">;

  listComments: (expenseId: string) => ExpenseComment[];
  addComment: (expenseId: string, body: string) => Promise<void>;

  getActivityFeed: (groupId?: string) => ActivityItem[];

  notifications: AppNotification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateNotificationPrefs: (patch: Partial<NotificationPrefs>) => Promise<void>;
  refresh: () => Promise<void>;
};

// Local caches, and which of them a change to each realtime table can
// invalidate. A new group membership, for example, makes a whole group's
// expenses and payments newly visible under RLS.
type CacheKey =
  | "users"
  | "groups"
  | "groupMembers"
  | "expenses"
  | "payments"
  | "friendships"
  | "comments"
  | "activity"
  | "notifications";

const TABLE_INVALIDATES: Record<string, CacheKey[]> = {
  users: ["users"],
  groups: ["groups"],
  group_members: ["groupMembers", "groups", "users", "expenses", "payments", "activity"],
  friendships: ["friendships", "users"],
  expenses: ["expenses", "users", "friendships"],
  expense_shares: ["expenses"],
  expense_items: ["expenses"],
  payments: ["payments"],
  expense_comments: ["comments"],
  activity_items: ["activity"],
  notifications: ["notifications"],
};

function check(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { userId, isAuthenticated, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [comments, setComments] = useState<ExpenseComment[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);

  // Each table's RLS policy already scopes rows to what the signed-in user
  // can see, so "fetch everything" here really means "fetch everything this
  // user is allowed to see" — no client-side filtering needed on top.
  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from("users").select("*");
    if (data) setUsers(data.map(mapUser));
  }, []);
  const fetchGroups = useCallback(async () => {
    const { data } = await supabase.from("groups").select("*");
    if (data) setGroups(data.map(mapGroup));
  }, []);
  const fetchGroupMembers = useCallback(async () => {
    const { data } = await supabase.from("group_members").select("*");
    if (data) setGroupMembers(data.map(mapGroupMember));
  }, []);
  const fetchExpenses = useCallback(async () => {
    const { data } = await supabase
      .from("expenses")
      .select("*, expense_shares(*), expense_items(*, expense_item_assignees(user_id))");
    if (data) setExpenses(data.map(mapExpense));
  }, []);
  const fetchPayments = useCallback(async () => {
    const { data } = await supabase.from("payments").select("*");
    if (data) setPayments(data.map(mapPayment));
  }, []);
  const fetchFriendships = useCallback(async () => {
    const { data } = await supabase.from("friendships").select("*");
    if (data) setFriendships(data.map(mapFriendship));
  }, []);
  const fetchComments = useCallback(async () => {
    const { data } = await supabase.from("expense_comments").select("*");
    if (data) setComments(data.map(mapComment));
  }, []);
  const fetchActivity = useCallback(async () => {
    const { data } = await supabase.from("activity_items").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setActivity(data.map(mapActivity));
  }, []);
  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setNotifications(data.map(mapNotification));
  }, []);

  const fetchers = useMemo<Record<CacheKey, () => Promise<void>>>(
    () => ({
      users: fetchUsers,
      groups: fetchGroups,
      groupMembers: fetchGroupMembers,
      expenses: fetchExpenses,
      payments: fetchPayments,
      friendships: fetchFriendships,
      comments: fetchComments,
      activity: fetchActivity,
      notifications: fetchNotifications,
    }),
    [
      fetchUsers,
      fetchGroups,
      fetchGroupMembers,
      fetchExpenses,
      fetchPayments,
      fetchFriendships,
      fetchComments,
      fetchActivity,
      fetchNotifications,
    ]
  );

  const refetchAll = useCallback(async () => {
    await Promise.all(Object.values(fetchers).map((f) => f()));
  }, [fetchers]);

  // One write (e.g. create_expense) fires a burst of row events — the
  // expense, each share, the activity row, each notification. Collect the
  // affected caches and refetch each one once, right after the burst.
  const dirty = useRef(new Set<CacheKey>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidate = useCallback(
    (keys: CacheKey[]) => {
      for (const k of keys) dirty.current.add(k);
      if (flushTimer.current) return;
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        const keysToFetch = [...dirty.current];
        dirty.current.clear();
        Promise.all(keysToFetch.map((k) => fetchers[k]())).catch(() => {});
      }, 250);
    },
    [fetchers]
  );

  useEffect(() => {
    // Signing out (userId -> null) doesn't need its own setState here — the
    // previous run's cleanup below already reset "ready" when it tore down.
    if (!isAuthenticated || !userId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      await refetchAll();
      if (!cancelled) setReady(true);
      // Fallback for projects without pg_cron: post any due recurring
      // expenses (rent, wifi, ...). Idempotent; realtime picks up new rows.
      supabase.rpc("post_recurring_expenses").then(
        () => {},
        () => {}
      );
    }

    // Realtime: any insert/update/delete on these tables — by this user, a
    // groupmate, or a friend — lands here within a second, so other people's
    // changes show up without closing and reopening the app. RLS still
    // decides which rows each user's subscription can see. (Requires the
    // tables to be in the supabase_realtime publication — migration 002.)
    function subscribe() {
      if (cancelled) return;
      let ch = supabase.channel(`tabmate-${userId}-${Date.now()}`);
      for (const [table, keys] of Object.entries(TABLE_INVALIDATES)) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => invalidate(keys));
      }
      const thisChannel = ch;
      channel = ch.subscribe((status) => {
        if (cancelled || channel !== thisChannel) return;
        if (status === "SUBSCRIBED") {
          // Anything that changed while disconnected was missed — catch up.
          refetchAll().catch(() => {});
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          // Mobile networks drop sockets all the time; rebuild the channel.
          if (retryTimer) return;
          retryTimer = setTimeout(() => {
            retryTimer = null;
            supabase.removeChannel(thisChannel);
            subscribe();
          }, 3000);
        }
      });
    }

    load();
    subscribe();

    // Android suspends the socket while the app is backgrounded; on return,
    // catch up immediately instead of waiting for the reconnect.
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") refetchAll().catch(() => {});
    });

    return () => {
      cancelled = true;
      setReady(false);
      appStateSub.remove();
      if (retryTimer) clearTimeout(retryTimer);
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      if (channel) supabase.removeChannel(channel);
    };
  }, [isAuthenticated, userId, refetchAll, invalidate]);

  const currentUser = users.find((u) => u.id === userId);

  const getUser = useCallback((id: string) => users.find((u) => u.id === id), [users]);

  const updateCurrentUser = useCallback(
    async (patch: Partial<Pick<User, "name" | "phone" | "defaultCurrency" | "upiId" | "paypalMeHandle" | "venmoUsername">>) => {
      if (!userId) return;
      const payload: Record<string, unknown> = {};
      if (patch.name !== undefined) payload.name = patch.name;
      // normalized (+91 default) server-side; not OTP-verified (product decision)
      if (patch.phone !== undefined) payload.phone = patch.phone?.trim() || null;
      if (patch.defaultCurrency !== undefined) payload.default_currency = patch.defaultCurrency;
      if (patch.upiId !== undefined) payload.upi_id = patch.upiId || null;
      if (patch.paypalMeHandle !== undefined) payload.paypal_me_handle = patch.paypalMeHandle || null;
      if (patch.venmoUsername !== undefined) payload.venmo_username = patch.venmoUsername || null;
      const { error } = await supabase.from("users").update(payload).eq("id", userId);
      if (error?.code === "23505") throw new Error("That mobile number is already used by another account.");
      if (error?.message?.includes("invalid phone number")) {
        throw new Error("That doesn't look like a valid mobile number. Add the country code if it's not Indian, e.g. +44…");
      }
      check(error, "Couldn't save your profile");
      // a new number can take over a pending (invited) person — reload what moved
      if (patch.phone !== undefined) await refetchAll();
      else await fetchUsers();
    },
    [userId, fetchUsers, refetchAll]
  );

  const getGroup = useCallback((id: string) => groups.find((g) => g.id === id), [groups]);

  const listMyGroups = useCallback(
    () =>
      groups.filter(
        (g) => !g.deletedAt && groupMembers.some((m) => m.groupId === g.id && m.userId === userId && !m.leftAt)
      ),
    [groups, groupMembers, userId]
  );

  const listGroupMembers = useCallback(
    (groupId: string) =>
      groupMembers
        .filter((m) => m.groupId === groupId && !m.leftAt)
        .map((m) => getUser(m.userId))
        .filter((u): u is User => !!u),
    [groupMembers, getUser]
  );

  const listFriends = useCallback(() => {
    const ids = new Set<string>();
    const myGroupIds = new Set(groupMembers.filter((x) => x.userId === userId && !x.leftAt).map((x) => x.groupId));
    for (const m of groupMembers) {
      if (!m.leftAt && myGroupIds.has(m.groupId) && m.userId !== userId) ids.add(m.userId);
    }
    for (const e of expenses) {
      if (!e.groupId && !e.deletedAt) {
        for (const s of e.shares) if (s.userId !== userId) ids.add(s.userId);
      }
    }
    for (const f of friendships) {
      if (f.userIdA === userId) ids.add(f.userIdB);
      if (f.userIdB === userId) ids.add(f.userIdA);
    }
    return [...ids].map((id) => getUser(id)).filter((u): u is User => !!u && !u.isKitty);
  }, [groupMembers, expenses, friendships, userId, getUser]);

  // Existing user -> friendship + a notification to them. Not on Tabmate
  // yet -> a pending invite; they're auto-friended the moment they sign up
  // with that email (handle_new_auth_user, migration 002).
  const addFriend = useCallback(
    async (identifier: string, name?: string): Promise<AddFriendResult> => {
      const { data, error } = await supabase.rpc("add_friend", {
        p_identifier: identifier.trim(),
        p_name: name?.trim() || null,
      });
      check(error, "Couldn't add friend");
      const result = data as AddFriendResult;
      if (result.status === "added" || result.status === "already" || result.status === "invited") {
        await Promise.all([fetchFriendships(), fetchUsers()]);
      }
      return result;
    },
    [fetchFriendships, fetchUsers]
  );

  const addGroupMember = useCallback(
    async (groupId: string, who: { userId: string } | { identifier: string; name?: string }) => {
      const { data, error } = await supabase.rpc(
        "add_group_member",
        "userId" in who
          ? { p_group_id: groupId, p_user_id: who.userId }
          : { p_group_id: groupId, p_identifier: who.identifier.trim(), p_name: who.name?.trim() || null }
      );
      check(error, "Couldn't add them to the group");
      const result = data as AddGroupMemberResult;
      if (result.status === "added_to_group") await Promise.all([fetchGroupMembers(), fetchUsers(), fetchFriendships()]);
      return result;
    },
    [fetchGroupMembers, fetchUsers, fetchFriendships]
  );

  const matchContacts = useCallback(async (phones: string[], emails: string[]) => {
    const result = new Map<string, ContactMatch>();
    // chunked: the server caps one request at 3000 entries
    const CHUNK = 1000;
    const all = [...phones.map((v) => ({ v, phone: true })), ...emails.map((v) => ({ v, phone: false }))];
    for (let i = 0; i < all.length; i += CHUNK) {
      const slice = all.slice(i, i + CHUNK);
      const { data, error } = await supabase.rpc("match_contacts", {
        p_phones: slice.filter((x) => x.phone).map((x) => x.v),
        p_emails: slice.filter((x) => !x.phone).map((x) => x.v),
      });
      check(error, "Couldn't check your contacts");
      for (const row of (data ?? []) as { input: string; user_id: string; name: string; is_friend: boolean }[]) {
        result.set(row.input, { userId: row.user_id, name: row.name, isFriend: row.is_friend });
      }
    }
    return result;
  }, []);

  const getGroupExpenses = useCallback(
    (groupId: string) => expenses.filter((e) => e.groupId === groupId).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)),
    [expenses]
  );

  const getExpense = useCallback((id: string) => expenses.find((e) => e.id === id), [expenses]);

  const getFriendExpenses = useCallback(
    (friendId: string) =>
      expenses
        .filter((e) => e.shares.some((s) => s.userId === friendId) && e.shares.some((s) => s.userId === userId))
        .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)),
    [expenses, userId]
  );

  const listMyExpenses = useCallback(() => {
    const myGroupIds = new Set(listMyGroups().map((g) => g.id));
    return expenses
      .filter((e) => !e.deletedAt && (e.groupId ? myGroupIds.has(e.groupId) : e.shares.some((s) => s.userId === userId)))
      .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  }, [expenses, listMyGroups, userId]);

  const getGroupBalances = useCallback(
    (groupId: string) => {
      const group = getGroup(groupId);
      if (!group) return [];
      const groupExpenses = expenses.filter((e) => e.groupId === groupId);
      const groupPayments = payments.filter((p) => p.groupId === groupId);
      return computeBalances(groupExpenses, groupPayments, group.defaultCurrency);
    },
    [expenses, payments, getGroup]
  );

  const getSimplifiedTransfers = useCallback((groupId: string) => simplifyDebts(getGroupBalances(groupId)), [getGroupBalances]);

  const getGroupTransfers = useCallback(
    (groupId: string) => {
      const group = getGroup(groupId);
      if (!group) return [];
      if (group.simplifyDebts) return getSimplifiedTransfers(groupId);
      return pairwiseTransfers(
        expenses.filter((e) => e.groupId === groupId),
        payments.filter((p) => p.groupId === groupId),
        group.defaultCurrency
      );
    },
    [getGroup, getSimplifiedTransfers, expenses, payments]
  );

  const getFriendBalanceByContext = useCallback(
    (friendId: string) => (userId ? friendBalanceByContext(expenses, payments, userId, friendId) : new Map<string, number>()),
    [expenses, payments, userId]
  );

  const getFriendBalance = useCallback(
    (friendId: string) => {
      let total = 0;
      for (const cents of getFriendBalanceByContext(friendId).values()) total += cents;
      return total;
    },
    [getFriendBalanceByContext]
  );

  const getTotalBalance = useCallback(() => {
    const groupTotal = listMyGroups().reduce((sum, g) => {
      const mine = getGroupBalances(g.id).find((b) => b.userId === userId);
      return sum + (mine?.balanceCents ?? 0);
    }, 0);
    const nonGroupExpenseTotal = expenses.reduce((sum, e) => {
      if (e.groupId || e.deletedAt) return sum;
      const mine = e.shares.find((s) => s.userId === userId);
      return sum + (mine ? mine.paidCents - mine.owedCents : 0);
    }, 0);
    const nonGroupPaymentTotal = payments.reduce((sum, p) => {
      if (p.groupId || p.status !== "confirmed") return sum;
      if (p.fromUserId === userId) return sum + p.amountCents;
      if (p.toUserId === userId) return sum - p.amountCents;
      return sum;
    }, 0);
    return groupTotal + nonGroupExpenseTotal + nonGroupPaymentTotal;
  }, [listMyGroups, getGroupBalances, expenses, payments, userId]);

  const createGroup = useCallback(
    async (name: string, memberIds: string[]) => {
      // Group + creator + chosen members in one transaction (the RPC), so a
      // failure can't leave a group missing half its members.
      const { data, error } = await supabase.rpc("create_group", { p_name: name, p_member_ids: memberIds });
      if (error || !data) throw new Error(error?.message ?? "Failed to create group");
      const group = mapGroup(data as Record<string, unknown>);
      await Promise.all([fetchGroups(), fetchGroupMembers()]);
      return group;
    },
    [fetchGroups, fetchGroupMembers]
  );

  const updateGroup = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Group, "name" | "simplifyDebts" | "groupType" | "startDate" | "endDate" | "budgetCents">>
    ) => {
      const payload: Record<string, unknown> = {};
      if (patch.name !== undefined) payload.name = patch.name;
      if (patch.simplifyDebts !== undefined) payload.simplify_debts = patch.simplifyDebts;
      if (patch.groupType !== undefined) payload.group_type = patch.groupType;
      if ("startDate" in patch) payload.start_date = patch.startDate || null;
      if ("endDate" in patch) payload.end_date = patch.endDate || null;
      if ("budgetCents" in patch) payload.budget_cents = patch.budgetCents || null;
      const { error } = await supabase.from("groups").update(payload).eq("id", id);
      check(error, "Couldn't update the group");
      await fetchGroups();
    },
    [fetchGroups]
  );

  const removeMember = useCallback(
    async (groupId: string, memberId: string) => {
      const { error } = await supabase
        .from("group_members")
        .update({ left_at: new Date().toISOString() })
        .eq("group_id", groupId)
        .eq("user_id", memberId);
      check(error, "Couldn't remove member");
      await fetchGroupMembers();
    },
    [fetchGroupMembers]
  );

  const getGroupKitty = useCallback(
    (groupId: string) =>
      groupMembers
        .filter((m) => m.groupId === groupId && !m.leftAt)
        .map((m) => getUser(m.userId))
        .find((u): u is User => !!u && u.isKitty),
    [groupMembers, getUser]
  );

  const enableKitty = useCallback(
    async (groupId: string) => {
      const { data, error } = await supabase.rpc("enable_kitty", { p_group_id: groupId });
      check(error, "Couldn't start a kitty");
      await Promise.all([fetchGroupMembers(), fetchUsers()]);
      return data as string;
    },
    [fetchGroupMembers, fetchUsers]
  );

  const leaveGroup = useCallback((groupId: string) => (userId ? removeMember(groupId, userId) : Promise.resolve()), [removeMember, userId]);

  const createGroupInvite = useCallback(async (groupId: string) => {
    const { data, error } = await supabase.rpc("create_group_invite", { p_group_id: groupId });
    if (error || !data) throw new Error(error?.message ?? "Failed to create invite");
    return data as string;
  }, []);

  const previewGroupByCode = useCallback(async (code: string) => {
    const { data, error } = await supabase.rpc("preview_group_by_code", { p_code: code });
    check(error, "Couldn't check that code");
    const row = (data as { group_id: string; name: string; cover_photo_url: string | null }[] | null)?.[0];
    if (!row) return null;
    return {
      id: row.group_id,
      name: row.name,
      coverPhotoUrl: row.cover_photo_url ?? undefined,
      defaultCurrency: "INR",
      simplifyDebts: true,
      groupType: "other",
      createdBy: "",
      createdAt: "",
    } satisfies Group;
  }, []);

  const joinGroupByCode = useCallback(
    async (code: string) => {
      const { data, error } = await supabase.rpc("join_group", { p_code: code });
      check(error, "Couldn't join the group");
      // An invalid/expired code returns null rather than raising (so the
      // rate-limit attempt is recorded) — PostgREST may surface that as a
      // row of nulls rather than null itself.
      if (!data || !(data as { id?: string }).id) return null;
      const group = mapGroup(data as Record<string, unknown>);
      // Joining makes the group's whole history visible — load all of it.
      await refetchAll();
      return group;
    },
    [refetchAll]
  );

  const createExpense = useCallback(
    async (input: NewExpenseInput) => {
      const payload = {
        group_id: input.groupId ?? null,
        description: input.description,
        amount_cents: input.amountCents,
        currency_code: input.currencyCode,
        category: input.category,
        expense_date: input.expenseDate,
        split_type: input.splitType,
        repeat_interval: input.repeatInterval ?? "none",
        notes: input.notes ?? null,
        ...(input.items ? { items: itemsPayload(input.items) } : {}),
        shares: input.owedBy.map((o) => ({
          user_id: o.userId,
          owed_cents: o.owedCents,
          paid_cents: input.paidBy.find((p) => p.userId === o.userId)?.amountCents ?? 0,
        })),
      };
      const { data, error } = await supabase.rpc("create_expense", { payload });
      if (error || !data) throw new Error(error?.message ?? "Failed to add expense");
      await Promise.all([fetchExpenses(), fetchFriendships(), fetchActivity()]);
      return mapExpense(data as Record<string, unknown>);
    },
    [fetchExpenses, fetchFriendships, fetchActivity]
  );

  const updateExpense = useCallback(
    async (id: string, patch: Partial<Expense> & { itemsInput?: ExpenseItemInput[] }) => {
      const payload: Record<string, unknown> = {};
      if (patch.description !== undefined) payload.description = patch.description;
      if (patch.expenseDate !== undefined) payload.expense_date = patch.expenseDate;
      if ("notes" in patch) payload.notes = patch.notes ?? null;
      if (patch.itemsInput !== undefined) payload.items = itemsPayload(patch.itemsInput);
      if (patch.amountCents !== undefined) payload.amount_cents = patch.amountCents;
      if (patch.category !== undefined) payload.category = patch.category;
      if (patch.splitType !== undefined) payload.split_type = patch.splitType;
      if (patch.repeatInterval !== undefined) payload.repeat_interval = patch.repeatInterval;
      if (patch.shares !== undefined) {
        payload.shares = patch.shares.map((s) => ({ user_id: s.userId, owed_cents: s.owedCents, paid_cents: s.paidCents }));
      }
      const { error } = await supabase.rpc("update_expense", { p_id: id, payload });
      if (error) throw new Error(error.message);
      await fetchExpenses();
    },
    [fetchExpenses]
  );

  const getExpenseHistory = useCallback(async (expenseId: string) => {
    const { data, error } = await supabase
      .from("expense_history")
      .select("*")
      .eq("expense_id", expenseId)
      .order("created_at", { ascending: true });
    check(error, "Couldn't load history");
    return (data ?? []).map(mapHistory);
  }, []);

  const softDeleteExpense = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      check(error, "Couldn't delete the expense");
      await fetchExpenses();
    },
    [fetchExpenses]
  );

  const restoreExpense = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("expenses").update({ deleted_at: null }).eq("id", id);
      check(error, "Couldn't restore the expense");
      await fetchExpenses();
    },
    [fetchExpenses]
  );

  const createPayment = useCallback(
    async (input: NewPaymentInput) => {
      const fromUserId = input.fromUserId ?? userId;
      const { data, error } = await supabase.rpc("create_payment", {
        p_group_id: input.groupId ?? null,
        p_from_user_id: fromUserId,
        p_to_user_id: input.toUserId,
        p_amount_cents: input.amountCents,
        p_currency_code: input.currencyCode,
      });
      if (error || !data) throw new Error(error?.message ?? "Failed to record payment");
      await Promise.all([fetchPayments(), fetchActivity()]);
      return mapPayment(data as Record<string, unknown>);
    },
    [userId, fetchPayments, fetchActivity]
  );

  const getPayment = useCallback((id: string) => payments.find((p) => p.id === id), [payments]);

  const getFriendPayments = useCallback(
    (friendId: string) =>
      payments
        .filter((p) => (p.fromUserId === friendId && p.toUserId === userId) || (p.fromUserId === userId && p.toUserId === friendId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [payments, userId]
  );

  const getGroupPayments = useCallback(
    (groupId: string) => payments.filter((p) => p.groupId === groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [payments]
  );

  const cancelPayment = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("cancel_payment", { p_id: id });
      if (error) throw new Error(error.message);
      await Promise.all([fetchPayments(), fetchActivity()]);
    },
    [fetchPayments, fetchActivity]
  );

  const sendReminder = useCallback(async (toUserId: string, amountCents: number, currencyCode: string) => {
    const { data, error } = await supabase.rpc("send_payment_reminder", {
      p_user: toUserId,
      p_amount_cents: amountCents,
      p_currency: currencyCode,
    });
    check(error, "Couldn't send the reminder");
    return ((data as { status: string }).status === "too_soon" ? "too_soon" : "sent") as "sent" | "too_soon";
  }, []);

  const listComments = useCallback(
    (expenseId: string) => comments.filter((c) => c.expenseId === expenseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [comments]
  );

  const addComment = useCallback(
    async (expenseId: string, body: string) => {
      if (!userId) return;
      const { error } = await supabase.from("expense_comments").insert({ expense_id: expenseId, user_id: userId, body });
      check(error, "Couldn't post your comment");
      await Promise.all([fetchComments(), fetchActivity()]);
    },
    [userId, fetchComments, fetchActivity]
  );

  const getActivityFeed = useCallback(
    (groupId?: string) => activity.filter((a) => (groupId ? a.groupId === groupId : true)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activity]
  );

  const unreadNotificationCount = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  const markNotificationRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now } : n)));
    await supabase.from("notifications").update({ read_at: now }).eq("id", id).is("read_at", null);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
  }, [userId]);

  const updateNotificationPrefs = useCallback(
    async (patch: Partial<NotificationPrefs>) => {
      if (!userId || !currentUser) return;
      const next = { ...currentUser.notificationPrefs, ...patch };
      // optimistic — toggles should flip instantly
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, notificationPrefs: next } : u)));
      const { error } = await supabase.from("users").update({ notification_prefs: next }).eq("id", userId);
      if (error) {
        await fetchUsers();
        throw new Error(error.message);
      }
    },
    [userId, currentUser, fetchUsers]
  );

  const value = useMemo<DataContextValue | null>(() => {
    if (!currentUser) return null;
    return {
      currentUser,
      users,
      groups,
      groupMembers,
      getUser,
      updateCurrentUser,
      getGroup,
      listMyGroups,
      listGroupMembers,
      listFriends,
      addFriend,
      addGroupMember,
      matchContacts,
      getGroupExpenses,
      getExpense,
      getFriendExpenses,
      listMyExpenses,
      getGroupBalances,
      getSimplifiedTransfers,
      getGroupTransfers,
      getFriendBalance,
      getFriendBalanceByContext,
      getTotalBalance,
      createGroup,
      updateGroup,
      getGroupKitty,
      enableKitty,
      removeMember,
      leaveGroup,
      createGroupInvite,
      joinGroupByCode,
      previewGroupByCode,
      createExpense,
      updateExpense,
      getExpenseHistory,
      softDeleteExpense,
      restoreExpense,
      createPayment,
      getPayment,
      getFriendPayments,
      getGroupPayments,
      cancelPayment,
      sendReminder,
      listComments,
      addComment,
      getActivityFeed,
      notifications,
      unreadNotificationCount,
      markNotificationRead,
      markAllNotificationsRead,
      updateNotificationPrefs,
      refresh: refetchAll,
    };
  }, [
    currentUser,
    users,
    groups,
    groupMembers,
    getUser,
    updateCurrentUser,
    getGroup,
    listMyGroups,
    listGroupMembers,
    listFriends,
    addFriend,
    addGroupMember,
    matchContacts,
    getGroupExpenses,
    getExpense,
    getFriendExpenses,
    listMyExpenses,
    getGroupBalances,
    getSimplifiedTransfers,
    getGroupTransfers,
    getFriendBalance,
    getFriendBalanceByContext,
    getTotalBalance,
    createGroup,
    updateGroup,
    getGroupKitty,
    enableKitty,
    removeMember,
    leaveGroup,
    createGroupInvite,
    joinGroupByCode,
    previewGroupByCode,
    createExpense,
    updateExpense,
    getExpenseHistory,
    softDeleteExpense,
    restoreExpense,
    createPayment,
    getPayment,
    getFriendPayments,
    getGroupPayments,
    cancelPayment,
    sendReminder,
    listComments,
    addComment,
    getActivityFeed,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    updateNotificationPrefs,
    refetchAll,
  ]);

  // Screens that call useData() assume currentUser is always defined —
  // rather than touch every call site to handle "not loaded yet", block
  // rendering children until the first real fetch resolves and the user's
  // own row is in cache.
  //
  // authLoading matters here too: useAuth()'s getSession() is async, so
  // isAuthenticated reads false for a brief window even when a session
  // will restore successfully. Any screen outside (tabs) — the account/*
  // sub-screens, expense detail, settle-up — has no auth guard of its own
  // and calls useData() directly, so skipping the Provider during that
  // window (not just "genuinely logged out") crashed them on a direct
  // reload with "useData must be used inside DataProvider".
  if (authLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator className="text-accent" />
      </View>
    );
  }
  if (!isAuthenticated) return <>{children}</>;
  if (!ready || !value) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator className="text-accent" />
      </View>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

/** For components rendered outside the signed-in tree (e.g. root-level push wiring). */
export function useOptionalData() {
  return useContext(DataContext);
}
