import { Feather } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Inbox of everything addressed to the current user — friend adds, group
// adds, expenses involving them, payments, comments. Rows arrive live over
// realtime; the same rows are also delivered as device push.
export default function Notifications() {
  const router = useRouter();
  const { notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead, getUser, refresh } =
    useData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().finally(() => setRefreshing(false));
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between border-b border-border p-4">
        <View className="flex-row items-center gap-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(router, "/")}>
            <Feather name="arrow-left" size={22} className="text-text" />
          </Pressable>
          <Text className="font-display text-lg text-text">Notifications</Text>
        </View>
        {unreadNotificationCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={markAllNotificationsRead}>
            <Text className="font-sans-semibold text-sm text-accent">Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {notifications.length === 0 ? (
          <EmptyState
            icon="bell"
            title="You're all caught up"
            body="When friends add you, split an expense with you, or settle up, it shows up here."
          />
        ) : (
          notifications.map((n) => {
            const actor = n.actorUserId ? getUser(n.actorUserId) : undefined;
            const unread = !n.readAt;
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityLabel={`${unread ? "Unread. " : ""}${n.title}. ${n.body}`}
                onPress={() => {
                  markNotificationRead(n.id);
                  if (n.data.url) router.push(n.data.url as Href);
                }}
                className={`flex-row items-start gap-3 rounded-lg p-3 ${unread ? "bg-accent/5" : ""}`}
              >
                {actor ? (
                  <Avatar id={actor.id} name={actor.name} size="sm" />
                ) : (
                  <View className="h-8 w-8 items-center justify-center rounded-pill bg-surface">
                    <Feather name="bell" size={14} className="text-muted" />
                  </View>
                )}
                <View className="flex-1 gap-0.5">
                  <Text className={`text-sm text-text ${unread ? "font-sans-semibold" : "font-sans"}`}>{n.title}</Text>
                  {n.body ? <Text className="font-sans text-xs text-muted">{n.body}</Text> : null}
                  <Text className="font-sans text-xs text-muted">{timeAgo(n.createdAt)}</Text>
                </View>
                {unread ? <View className="mt-1.5 h-2 w-2 rounded-pill bg-accent" /> : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
