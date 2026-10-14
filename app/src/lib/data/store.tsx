import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

import { computeBalances, simplifyDebts } from "./balances";
import {
  mapActivity,
  mapComment,
  mapExpense,
  mapFriendship,
  mapGroup,
  mapGroupMember,
  mapPayment,
  mapUser,
  type FriendshipRow,
} from "./mappers";
import type {
  ActivityItem,
  Balance,
  Expense,
  ExpenseComment,
  Group,
  GroupMember,
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
};

type NewPaymentInput = {
  groupId?: string;
  fromUserId?: string;
  toUserId: string;
  amountCents: number;
  currencyCode: string;
};

type DataContextValue = {
  currentUser: User;
  users: User[];
  groups: Group[];
  groupMembers: GroupMember[];

  getUser: (id: string) => User | undefined;
  updateCurrentUser: (
    patch: Partial<Pick<User, "name" | "defaultCurrency" | "upiId" | "paypalMeHandle" | "venmoUsername">>
  ) => Promise<void>;
  getGroup: (id: string) => Group | undefined;
  listMyGroups: () => Group[];
  listGroupMembers: (groupId: string) => User[];
  listFriends: () => User[];
  addFriendByEmail: (email: string) => Promise<User | "already-friends" | "self" | null>;

  getGroupExpenses: (groupId: string) => Expense[];
  getExpense: (id: string) => Expense | undefined;
  getFriendExpenses: (friendId: string) => Expense[];
  listMyExpenses: () => Expense[];

  getGroupBalances: (groupId: string) => Balance[];
  getSimplifiedTransfers: (groupId: string) => Transfer[];
  getFriendBalance: (friendId: string) => number;
  getTotalBalance: () => number;

  createGroup: (name: string, memberIds: string[]) => Promise<Group>;
  updateGroup: (id: string, patch: Partial<Pick<Group, "name" | "simplifyDebts">>) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  createGroupInvite: (groupId: string) => Promise<string>;
  joinGroupByCode: (code: string) => Promise<Group | null>;
  previewGroupByCode: (code: string) => Promise<Group | null>;

  createExpense: (input: NewExpenseInput) => Promise<Expense>;
  updateExpense: (id: string, patch: Partial<Expense>) => Promise<void>;
  softDeleteExpense: (id: string) => Promise<void>;
  restoreExpense: (id: string) => Promise<void>;

  createPayment: (input: NewPaymentInput) => Promise<Payment>;
  getPayment: (id: string) => Payment | undefined;
  getFriendPayments: (friendId: string) => Payment[];
  cancelPayment: (id: string) => Promise<void>;

  listComments: (expenseId: string) => ExpenseComment[];
  addComment: (expenseId: string, body: string) => Promise<void>;

  getActivityFeed: (groupId?: string) => ActivityItem[];
};

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
    const { data } = await supabase.from("expenses").select("*, expense_shares(*)");
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

  // Initial load, and a full refetch of everything whenever a realtime
  // change lands — simpler and safer than hand-patching every table's local
  // state from a partial change payload, at the cost of an extra round trip
  // per change. Fine at this app's scale.
  const refetchAll = useCallback(async () => {
    await Promise.all([
      fetchUsers(),
      fetchGroups(),
      fetchGroupMembers(),
      fetchExpenses(),
      fetchPayments(),
      fetchFriendships(),
      fetchComments(),
      fetchActivity(),
    ]);
  }, [fetchUsers, fetchGroups, fetchGroupMembers, fetchExpenses, fetchPayments, fetchFriendships, fetchComments, fetchActivity]);

  useEffect(() => {
    // Signing out (userId -> null) doesn't need its own setState here — the
    // previous run's cleanup below already reset "ready" when it tore down.
    if (!isAuthenticated || !userId) return;
    // No setReady(false) needed here: it starts false and the previous
    // run's cleanup already resets it to false before this one starts.
    let cancelled = false;
    async function load() {
      await refetchAll();
      if (!cancelled) setReady(true);
    }
    load();

    // Realtime: any insert/update/delete on these tables (from this user, a
    // groupmate, or a friend — RLS still applies to what the subscription
    // can see) triggers a full refetch, so changes made by other users show
    // up here without a manual reload.
    const channel = supabase
      .channel("tabmate-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_shares" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_comments" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_items" }, () => refetchAll())
      .subscribe();

    return () => {
      cancelled = true;
      setReady(false);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, userId, refetchAll]);

  const currentUser = users.find((u) => u.id === userId);

  const getUser = useCallback((id: string) => users.find((u) => u.id === id), [users]);

  const updateCurrentUser = useCallback(
    async (patch: Partial<Pick<User, "name" | "defaultCurrency" | "upiId" | "paypalMeHandle" | "venmoUsername">>) => {
      if (!userId) return;
      const payload: Record<string, unknown> = {};
      if (patch.name !== undefined) payload.name = patch.name;
      if (patch.defaultCurrency !== undefined) payload.default_currency = patch.defaultCurrency;
      if (patch.upiId !== undefined) payload.upi_id = patch.upiId || null;
      if (patch.paypalMeHandle !== undefined) payload.paypal_me_handle = patch.paypalMeHandle || null;
      if (patch.venmoUsername !== undefined) payload.venmo_username = patch.venmoUsername || null;
      await supabase.from("users").update(payload).eq("id", userId);
      await fetchUsers();
    },
    [userId, fetchUsers]
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
    for (const m of groupMembers) {
      if (m.leftAt) continue;
      const myGroupIds = groupMembers.filter((x) => x.userId === userId && !x.leftAt).map((x) => x.groupId);
      if (myGroupIds.includes(m.groupId) && m.userId !== userId) ids.add(m.userId);
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
    return [...ids].map((id) => getUser(id)).filter((u): u is User => !!u);
  }, [groupMembers, expenses, friendships, userId, getUser]);

  const addFriendByEmail = useCallback(
    async (email: string): Promise<User | "already-friends" | "self" | null> => {
      const alreadyFriend = (id: string) =>
        friendships.some((f) => (f.userIdA === userId && f.userIdB === id) || (f.userIdB === userId && f.userIdA === id));
      const { data, error } = await supabase.rpc("add_friend_by_email", { p_email: email.trim() });
      if (error) {
        // The RPC raises for "cannot add yourself" — everything else (no
        // match) comes back as data === null, not an error.
        return "self";
      }
      if (!data) return null;
      const user = mapUser(data as Record<string, unknown>);
      if (alreadyFriend(user.id)) {
        await fetchFriendships();
        return "already-friends";
      }
      await fetchFriendships();
      await fetchUsers();
      return user;
    },
    [friendships, userId, fetchFriendships, fetchUsers]
  );

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

  const getFriendBalance = useCallback(
    (friendId: string) => {
      let net = 0;
      for (const e of getFriendExpenses(friendId)) {
        if (e.deletedAt) continue;
        const mine = e.shares.find((s) => s.userId === userId);
        const theirs = e.shares.find((s) => s.userId === friendId);
        if (!mine || !theirs) continue;
        const iPaid = mine.paidCents > 0;
        const theyPaid = theirs.paidCents > 0;
        if (iPaid && !theyPaid) net += theirs.owedCents;
        else if (theyPaid && !iPaid) net -= mine.owedCents;
      }
      for (const p of payments) {
        if (p.status !== "confirmed") continue;
        if (p.fromUserId === userId && p.toUserId === friendId) net += p.amountCents;
        if (p.toUserId === userId && p.fromUserId === friendId) net -= p.amountCents;
      }
      return net;
    },
    [getFriendExpenses, payments, userId]
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
      const { data, error } = await supabase.rpc("create_group", { p_name: name });
      if (error || !data) throw new Error(error?.message ?? "Failed to create group");
      const group = mapGroup(data as Record<string, unknown>);
      if (memberIds.length > 0) {
        await supabase.from("group_members").insert(memberIds.map((id) => ({ group_id: group.id, user_id: id })));
      }
      await Promise.all([fetchGroups(), fetchGroupMembers()]);
      return group;
    },
    [fetchGroups, fetchGroupMembers]
  );

  const updateGroup = useCallback(
    async (id: string, patch: Partial<Pick<Group, "name" | "simplifyDebts">>) => {
      await supabase
        .from("groups")
        .update({ name: patch.name, simplify_debts: patch.simplifyDebts })
        .eq("id", id);
      await fetchGroups();
    },
    [fetchGroups]
  );

  const removeMember = useCallback(
    async (groupId: string, memberId: string) => {
      await supabase
        .from("group_members")
        .update({ left_at: new Date().toISOString() })
        .eq("group_id", groupId)
        .eq("user_id", memberId);
      await fetchGroupMembers();
    },
    [fetchGroupMembers]
  );

  const leaveGroup = useCallback((groupId: string) => (userId ? removeMember(groupId, userId) : Promise.resolve()), [removeMember, userId]);

  const createGroupInvite = useCallback(async (groupId: string) => {
    const { data, error } = await supabase.rpc("create_group_invite", { p_group_id: groupId });
    if (error || !data) throw new Error(error?.message ?? "Failed to create invite");
    return data as string;
  }, []);

  const previewGroupByCode = useCallback(async (code: string) => {
    const { data } = await supabase.rpc("preview_group_by_code", { p_code: code });
    const row = (data as { group_id: string; name: string; cover_photo_url: string | null }[] | null)?.[0];
    if (!row) return null;
    return {
      id: row.group_id,
      name: row.name,
      coverPhotoUrl: row.cover_photo_url ?? undefined,
      defaultCurrency: "INR",
      simplifyDebts: true,
      createdBy: "",
      createdAt: "",
    } satisfies Group;
  }, []);

  const joinGroupByCode = useCallback(
    async (code: string) => {
      const { data, error } = await supabase.rpc("join_group", { p_code: code });
      if (error || !data) return null;
      const group = mapGroup(data as Record<string, unknown>);
      await Promise.all([fetchGroups(), fetchGroupMembers()]);
      return group;
    },
    [fetchGroups, fetchGroupMembers]
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
    async (id: string, patch: Partial<Expense>) => {
      const payload: Record<string, unknown> = {};
      if (patch.description !== undefined) payload.description = patch.description;
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

  const softDeleteExpense = useCallback(
    async (id: string) => {
      await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      await fetchExpenses();
    },
    [fetchExpenses]
  );

  const restoreExpense = useCallback(
    async (id: string) => {
      await supabase.from("expenses").update({ deleted_at: null }).eq("id", id);
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

  const cancelPayment = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("cancel_payment", { p_id: id });
      if (error) throw new Error(error.message);
      await Promise.all([fetchPayments(), fetchActivity()]);
    },
    [fetchPayments, fetchActivity]
  );

  const listComments = useCallback(
    (expenseId: string) => comments.filter((c) => c.expenseId === expenseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [comments]
  );

  const addComment = useCallback(
    async (expenseId: string, body: string) => {
      if (!userId) return;
      await supabase.from("expense_comments").insert({ expense_id: expenseId, user_id: userId, body });
      await Promise.all([fetchComments(), fetchActivity()]);
    },
    [userId, fetchComments, fetchActivity]
  );

  const getActivityFeed = useCallback(
    (groupId?: string) => activity.filter((a) => (groupId ? a.groupId === groupId : true)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activity]
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
      addFriendByEmail,
      getGroupExpenses,
      getExpense,
      getFriendExpenses,
      listMyExpenses,
      getGroupBalances,
      getSimplifiedTransfers,
      getFriendBalance,
      getTotalBalance,
      createGroup,
      updateGroup,
      removeMember,
      leaveGroup,
      createGroupInvite,
      joinGroupByCode,
      previewGroupByCode,
      createExpense,
      updateExpense,
      softDeleteExpense,
      restoreExpense,
      createPayment,
      getPayment,
      getFriendPayments,
      cancelPayment,
      listComments,
      addComment,
      getActivityFeed,
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
    addFriendByEmail,
    getGroupExpenses,
    getExpense,
    getFriendExpenses,
    listMyExpenses,
    getGroupBalances,
    getSimplifiedTransfers,
    getFriendBalance,
    getTotalBalance,
    createGroup,
    updateGroup,
    removeMember,
    leaveGroup,
    createGroupInvite,
    joinGroupByCode,
    previewGroupByCode,
    createExpense,
    updateExpense,
    softDeleteExpense,
    restoreExpense,
    createPayment,
    getPayment,
    getFriendPayments,
    cancelPayment,
    listComments,
    addComment,
    getActivityFeed,
  ]);

  // Screens that call useData() assume currentUser is always defined (true
  // throughout this app's history on the fake layer) — rather than touch
  // every call site to handle "not loaded yet", block rendering children
  // until the first real fetch resolves and the user's own row is in cache.
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
        <ActivityIndicator color="#5b5fef" />
      </View>
    );
  }
  if (!isAuthenticated) return <>{children}</>;
  if (!ready || !value) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#5b5fef" />
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
