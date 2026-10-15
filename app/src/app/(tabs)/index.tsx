import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BalanceStack } from "@/components/Balance";
import { EmptyState } from "@/components/EmptyState";
import { formatCents } from "@/lib/data/balances";
import { useData } from "@/lib/data/store";

// S04 — Home (Groups + Friends)
export default function Home() {
  const router = useRouter();
  const {
    listMyGroups,
    listFriends,
    listGroupMembers,
    getGroupBalances,
    getFriendBalance,
    currentUser,
    unreadNotificationCount,
  } = useData();
  const groups = listMyGroups();
  const friends = listFriends();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-4">
        <Text className="font-display text-xl text-text">Hey, {currentUser.name}</Text>
        <View className="flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadNotificationCount > 0 ? `Notifications, ${unreadNotificationCount} unread` : "Notifications"
            }
            onPress={() => router.push("/notifications")}
            className="h-9 w-9 items-center justify-center rounded-pill bg-surface"
          >
            <Feather name="bell" size={18} color="#1f2430" />
            {unreadNotificationCount > 0 ? (
              <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1">
                <Text className="font-sans-semibold text-[10px] text-on-accent">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search expenses"
            onPress={() => router.push("/search")}
            className="h-9 w-9 items-center justify-center rounded-pill bg-surface"
          >
            <Feather name="search" size={18} color="#1f2430" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a friend"
            onPress={() => router.push("/friend/add")}
            className="h-9 w-9 items-center justify-center rounded-pill bg-surface"
          >
            <Feather name="user-plus" size={18} color="#1f2430" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a group"
            onPress={() => router.push("/group/create")}
            className="h-9 w-9 items-center justify-center rounded-pill bg-surface"
          >
            <Feather name="plus" size={18} color="#1f2430" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6 pb-28">
        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Groups</Text>
          {groups.length === 0 ? (
            <EmptyState
              icon="users"
              title="No tabs open yet"
              body="Start one for a trip, a flat, or anything you split often."
            />
          ) : (
            groups.map((g) => {
              const mine = getGroupBalances(g.id).find((b) => b.userId === currentUser.id);
              return (
                <Pressable
                  key={g.id}
                  onPress={() => router.push(`/group/${g.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.name}${mine ? `, ${formatCents(mine.balanceCents, g.defaultCurrency)}` : ", settled up"}`}
                  className="flex-row items-center justify-between rounded-lg border border-border bg-bg p-4"
                >
                  <View className="flex-1 gap-1">
                    <Text className="font-sans-semibold text-base text-text">{g.name}</Text>
                    <Text className="font-sans text-xs text-muted">
                      {listGroupMembers(g.id).length} members
                    </Text>
                  </View>
                  {mine ? (
                    <BalanceStack
                      state={mine.balanceCents > 0 ? "owed-to-you" : "you-owe"}
                      amount={formatCents(Math.abs(mine.balanceCents), g.defaultCurrency)}
                    />
                  ) : (
                    <BalanceStack state="settled" />
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">Friends</Text>
          {friends.length === 0 ? (
            <EmptyState icon="user" title="No friends yet" body="Add a friend by email, or split a non-group expense with someone."
              action={
                <Pressable accessibilityRole="button" onPress={() => router.push("/friend/add")}>
                  <Text className="font-sans-semibold text-sm text-accent">Add a friend</Text>
                </Pressable>
              }
            />
          ) : (
            friends.map((f) => {
              const balance = getFriendBalance(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => router.push(`/friend/${f.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${f.name}${balance !== 0 ? `, ${formatCents(Math.abs(balance), currentUser.defaultCurrency)}` : ", settled up"}`}
                  className="flex-row items-center justify-between rounded-lg border border-border bg-bg p-4"
                >
                  <View className="flex-row items-center gap-3">
                    <Avatar id={f.id} name={f.name} />
                    <Text className="font-sans-semibold text-base text-text">{f.name}</Text>
                  </View>
                  {balance !== 0 ? (
                    <BalanceStack
                      state={balance > 0 ? "owed-to-you" : "you-owe"}
                      amount={formatCents(Math.abs(balance), currentUser.defaultCurrency)}
                      label={balance > 0 ? "owes you" : "you owe"}
                    />
                  ) : (
                    <BalanceStack state="settled" />
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        onPress={() => router.push("/expense/add")}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-pill bg-accent shadow-pop"
      >
        <Feather name="plus" size={26} color="#ffffff" />
      </Pressable>
    </SafeAreaView>
  );
}
