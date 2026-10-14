import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { computeBalances, simplifyDebts } from "./balances";
import { expandDueRecurringExpenses } from "./recurring";
import {
  CURRENT_USER_ID,
  seedActivity,
  seedExpenses,
  seedGroupMembers,
  seedGroups,
  seedPayments,
  seedUsers,
} from "./seed";
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

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

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
  // Both directions are real: "I paid them back" and "record that they paid
  // me" (recon.md quotes the original's own help text: "pay someone back or
  // record that you've been paid"). fromUserId defaults to the current user
  // so existing call sites (always "I paid") don't need to change.
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
  getGroup: (id: string) => Group | undefined;
  listMyGroups: () => Group[];
  listGroupMembers: (groupId: string) => User[];
  listFriends: () => User[];

  getGroupExpenses: (groupId: string) => Expense[];
  getExpense: (id: string) => Expense | undefined;
  getFriendExpenses: (friendId: string) => Expense[];
  listMyExpenses: () => Expense[];

  getGroupBalances: (groupId: string) => Balance[];
  getSimplifiedTransfers: (groupId: string) => Transfer[];
  getFriendBalance: (friendId: string) => number;
  getTotalBalance: () => number;

  createGroup: (name: string, memberIds: string[]) => Group;
  updateGroup: (id: string, patch: Partial<Pick<Group, "name" | "simplifyDebts">>) => void;
  removeMember: (groupId: string, userId: string) => void;
  leaveGroup: (groupId: string) => void;
  createGroupInvite: (groupId: string) => string;
  joinGroupByCode: (code: string) => Group | null;
  previewGroupByCode: (code: string) => Group | null;

  createExpense: (input: NewExpenseInput) => Expense;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  softDeleteExpense: (id: string) => void;
  restoreExpense: (id: string) => void;

  createPayment: (input: NewPaymentInput) => Payment;

  listComments: (expenseId: string) => ExpenseComment[];
  addComment: (expenseId: string, body: string) => void;

  getActivityFeed: (groupId?: string) => ActivityItem[];
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [users] = useState<User[]>(seedUsers);
  const [groups, setGroups] = useState<Group[]>(seedGroups);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(seedGroupMembers);
  const [expenses, setExpenses] = useState<Expense[]>(() => [
    ...expandDueRecurringExpenses(seedExpenses),
    ...seedExpenses,
  ]);
  const [payments, setPayments] = useState<Payment[]>(seedPayments);
  const [comments, setComments] = useState<ExpenseComment[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>(seedActivity);
  const [invites, setInvites] = useState<{ code: string; groupId: string }[]>([]);

  const currentUser = users.find((u) => u.id === CURRENT_USER_ID)!;

  const logActivity = useCallback(
    (entry: Omit<ActivityItem, "id" | "createdAt">) => {
      setActivity((prev) => [
        { ...entry, id: makeId("a"), createdAt: new Date().toISOString() },
        ...prev,
      ]);
    },
    []
  );

  const getUser = useCallback((id: string) => users.find((u) => u.id === id), [users]);
  const getGroup = useCallback((id: string) => groups.find((g) => g.id === id), [groups]);

  const listMyGroups = useCallback(
    () =>
      groups.filter(
        (g) =>
          !g.deletedAt &&
          groupMembers.some((m) => m.groupId === g.id && m.userId === CURRENT_USER_ID && !m.leftAt)
      ),
    [groups, groupMembers]
  );

  const listGroupMembers = useCallback(
    (groupId: string) =>
      groupMembers
        .filter((m) => m.groupId === groupId && !m.leftAt)
        .map((m) => getUser(m.userId))
        .filter((u): u is User => !!u),
    [groupMembers, getUser]
  );

  // "Friends" = anyone you share a group with, or share a non-group expense with.
  const listFriends = useCallback(() => {
    const ids = new Set<string>();
    for (const m of groupMembers) {
      if (m.leftAt) continue;
      const myGroupIds = groupMembers
        .filter((x) => x.userId === CURRENT_USER_ID && !x.leftAt)
        .map((x) => x.groupId);
      if (myGroupIds.includes(m.groupId) && m.userId !== CURRENT_USER_ID) ids.add(m.userId);
    }
    for (const e of expenses) {
      if (!e.groupId && !e.deletedAt) {
        for (const s of e.shares) if (s.userId !== CURRENT_USER_ID) ids.add(s.userId);
      }
    }
    return [...ids].map((id) => getUser(id)).filter((u): u is User => !!u);
  }, [groupMembers, expenses, getUser]);

  const getGroupExpenses = useCallback(
    (groupId: string) =>
      expenses
        .filter((e) => e.groupId === groupId)
        .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)),
    [expenses]
  );

  const getExpense = useCallback((id: string) => expenses.find((e) => e.id === id), [expenses]);

  const getFriendExpenses = useCallback(
    (friendId: string) =>
      expenses
        .filter((e) => e.shares.some((s) => s.userId === friendId) && e.shares.some((s) => s.userId === CURRENT_USER_ID))
        .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)),
    [expenses]
  );

  // Every expense the current user is part of, group or non-group — the
  // search index. Same visibility rule as getTotalBalance: in a group they
  // belong to, or a direct party to a non-group expense.
  const listMyExpenses = useCallback(() => {
    const myGroupIds = new Set(listMyGroups().map((g) => g.id));
    return expenses
      .filter(
        (e) =>
          !e.deletedAt &&
          (e.groupId ? myGroupIds.has(e.groupId) : e.shares.some((s) => s.userId === CURRENT_USER_ID))
      )
      .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  }, [expenses, listMyGroups]);

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

  const getSimplifiedTransfers = useCallback(
    (groupId: string) => simplifyDebts(getGroupBalances(groupId)),
    [getGroupBalances]
  );

  const getFriendBalance = useCallback(
    (friendId: string) => {
      let net = 0;
      for (const e of getFriendExpenses(friendId)) {
        if (e.deletedAt) continue;
        const mine = e.shares.find((s) => s.userId === CURRENT_USER_ID);
        const theirs = e.shares.find((s) => s.userId === friendId);
        if (!mine || !theirs) continue;
        const iPaid = mine.paidCents > 0;
        const theyPaid = theirs.paidCents > 0;
        // Every expense here has exactly one payer (our data model doesn't
        // support multi-payer yet). Only count expenses where one of the two
        // of us is that payer — a third person's expense creates debts
        // toward THEM, not between us, so it's excluded from this pair.
        if (iPaid && !theyPaid) net += theirs.owedCents;
        else if (theyPaid && !iPaid) net -= mine.owedCents;
      }
      for (const p of payments) {
        if (p.status !== "confirmed") continue;
        if (p.fromUserId === CURRENT_USER_ID && p.toUserId === friendId) net += p.amountCents;
        if (p.toUserId === CURRENT_USER_ID && p.fromUserId === friendId) net -= p.amountCents;
      }
      return net;
    },
    [getFriendExpenses, payments]
  );

  const getTotalBalance = useCallback(() => {
    const groupTotal = listMyGroups().reduce((sum, g) => {
      const mine = getGroupBalances(g.id).find((b) => b.userId === CURRENT_USER_ID);
      return sum + (mine?.balanceCents ?? 0);
    }, 0);

    // Non-group (friend-only) expenses and payments never belong to any
    // group, so they're invisible to the loop above — without this, a
    // user's one-off expenses with friends silently vanish from their
    // account-wide balance.
    const nonGroupExpenseTotal = expenses.reduce((sum, e) => {
      if (e.groupId || e.deletedAt) return sum;
      const mine = e.shares.find((s) => s.userId === CURRENT_USER_ID);
      return sum + (mine ? mine.paidCents - mine.owedCents : 0);
    }, 0);
    const nonGroupPaymentTotal = payments.reduce((sum, p) => {
      if (p.groupId || p.status !== "confirmed") return sum;
      if (p.fromUserId === CURRENT_USER_ID) return sum + p.amountCents;
      if (p.toUserId === CURRENT_USER_ID) return sum - p.amountCents;
      return sum;
    }, 0);

    return groupTotal + nonGroupExpenseTotal + nonGroupPaymentTotal;
  }, [listMyGroups, getGroupBalances, expenses, payments]);

  const createGroup = useCallback(
    (name: string, memberIds: string[]) => {
      const group: Group = {
        id: makeId("g"),
        name,
        defaultCurrency: currentUser.defaultCurrency,
        simplifyDebts: true,
        createdBy: CURRENT_USER_ID,
        createdAt: new Date().toISOString(),
      };
      setGroups((prev) => [...prev, group]);
      const members: GroupMember[] = [CURRENT_USER_ID, ...memberIds].map((userId) => ({
        groupId: group.id,
        userId,
        joinedAt: new Date().toISOString(),
      }));
      setGroupMembers((prev) => [...prev, ...members]);
      logActivity({ actorUserId: CURRENT_USER_ID, groupId: group.id, type: "group_updated", refId: group.id, metadata: { description: `Created ${name}` } });
      return group;
    },
    [currentUser, logActivity]
  );

  const updateGroup = useCallback((id: string, patch: Partial<Pick<Group, "name" | "simplifyDebts">>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    logActivity({ actorUserId: CURRENT_USER_ID, groupId: id, type: "group_updated", refId: id, metadata: {} });
  }, [logActivity]);

  const removeMember = useCallback(
    (groupId: string, userId: string) => {
      setGroupMembers((prev) =>
        prev.map((m) => (m.groupId === groupId && m.userId === userId ? { ...m, leftAt: new Date().toISOString() } : m))
      );
      logActivity({ actorUserId: CURRENT_USER_ID, groupId, type: "member_left", refId: userId, metadata: {} });
    },
    [logActivity]
  );

  const leaveGroup = useCallback((groupId: string) => removeMember(groupId, CURRENT_USER_ID), [removeMember]);

  const createGroupInvite = useCallback((groupId: string) => {
    const code = makeCode();
    setInvites((prev) => [...prev, { code, groupId }]);
    return code;
  }, []);

  const previewGroupByCode = useCallback(
    (code: string) => {
      const invite = invites.find((i) => i.code === code.toUpperCase());
      return invite ? getGroup(invite.groupId) ?? null : null;
    },
    [invites, getGroup]
  );

  const joinGroupByCode = useCallback(
    (code: string) => {
      const invite = invites.find((i) => i.code === code.toUpperCase());
      if (!invite) return null;
      const group = getGroup(invite.groupId);
      if (!group) return null;
      const already = groupMembers.some((m) => m.groupId === group.id && m.userId === CURRENT_USER_ID && !m.leftAt);
      if (!already) {
        setGroupMembers((prev) => [...prev, { groupId: group.id, userId: CURRENT_USER_ID, joinedAt: new Date().toISOString() }]);
        logActivity({ actorUserId: CURRENT_USER_ID, groupId: group.id, type: "member_joined", refId: CURRENT_USER_ID, metadata: {} });
      }
      return group;
    },
    [invites, groupMembers, getGroup, logActivity]
  );

  const createExpense = useCallback(
    (input: NewExpenseInput) => {
      const expense: Expense = {
        id: makeId("e"),
        groupId: input.groupId,
        description: input.description,
        amountCents: input.amountCents,
        currencyCode: input.currencyCode,
        category: input.category,
        expenseDate: input.expenseDate,
        splitType: input.splitType,
        repeatInterval: input.repeatInterval ?? "none",
        createdBy: CURRENT_USER_ID,
        shares: input.owedBy.map((o) => ({
          userId: o.userId,
          owedCents: o.owedCents,
          paidCents: input.paidBy.find((p) => p.userId === o.userId)?.amountCents ?? 0,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setExpenses((prev) => [expense, ...prev]);
      logActivity({ actorUserId: CURRENT_USER_ID, groupId: input.groupId, type: "expense_added", refId: expense.id, metadata: { description: input.description } });
      return expense;
    },
    [logActivity]
  );

  const updateExpense = useCallback((id: string, patch: Partial<Expense>) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e)));
  }, []);

  const softDeleteExpense = useCallback(
    (id: string) => {
      updateExpense(id, { deletedAt: new Date().toISOString() });
      const e = expenses.find((x) => x.id === id);
      logActivity({ actorUserId: CURRENT_USER_ID, groupId: e?.groupId, type: "expense_deleted", refId: id, metadata: { description: e?.description ?? "" } });
    },
    [updateExpense, expenses, logActivity]
  );

  const restoreExpense = useCallback((id: string) => updateExpense(id, { deletedAt: undefined }), [updateExpense]);

  const createPayment = useCallback(
    (input: NewPaymentInput) => {
      const fromUserId = input.fromUserId ?? CURRENT_USER_ID;
      const payment: Payment = {
        id: makeId("p"),
        groupId: input.groupId,
        fromUserId,
        toUserId: input.toUserId,
        amountCents: input.amountCents,
        currencyCode: input.currencyCode,
        status: "confirmed",
        createdAt: new Date().toISOString(),
      };
      setPayments((prev) => [payment, ...prev]);
      const otherPartyId = fromUserId === CURRENT_USER_ID ? input.toUserId : fromUserId;
      const otherPartyName = getUser(otherPartyId)?.name ?? "";
      logActivity({
        actorUserId: CURRENT_USER_ID,
        groupId: input.groupId,
        type: "payment_recorded",
        refId: payment.id,
        metadata: {
          description: fromUserId === CURRENT_USER_ID ? `Paid ${otherPartyName}` : `${otherPartyName} paid you`,
        },
      });
      return payment;
    },
    [logActivity, getUser]
  );

  const listComments = useCallback(
    (expenseId: string) => comments.filter((c) => c.expenseId === expenseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [comments]
  );

  const addComment = useCallback(
    (expenseId: string, body: string) => {
      const comment: ExpenseComment = { id: makeId("c"), expenseId, userId: CURRENT_USER_ID, body, createdAt: new Date().toISOString() };
      setComments((prev) => [...prev, comment]);
      const e = expenses.find((x) => x.id === expenseId);
      logActivity({ actorUserId: CURRENT_USER_ID, groupId: e?.groupId, type: "comment_added", refId: expenseId, metadata: { description: body.slice(0, 40) } });
    },
    [expenses, logActivity]
  );

  const getActivityFeed = useCallback(
    (groupId?: string) =>
      activity
        .filter((a) => (groupId ? a.groupId === groupId : true))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activity]
  );

  const value = useMemo<DataContextValue>(
    () => ({
      currentUser,
      users,
      groups,
      groupMembers,
      getUser,
      getGroup,
      listMyGroups,
      listGroupMembers,
      listFriends,
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
      listComments,
      addComment,
      getActivityFeed,
    }),
    [
      currentUser,
      users,
      groups,
      groupMembers,
      getUser,
      getGroup,
      listMyGroups,
      listGroupMembers,
      listFriends,
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
      listComments,
      addComment,
      getActivityFeed,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
