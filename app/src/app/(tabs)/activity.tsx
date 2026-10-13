import { Feather } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { useData } from "@/lib/data/store";
import type { ActivityType } from "@/lib/data/types";

const ICON: Record<ActivityType, React.ComponentProps<typeof Feather>["name"]> = {
  expense_added: "plus-circle",
  expense_updated: "edit-2",
  expense_deleted: "trash-2",
  payment_recorded: "check-circle",
  comment_added: "message-circle",
  member_joined: "user-plus",
  member_left: "user-minus",
  group_updated: "settings",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// S11 — Activity feed
export default function Activity() {
  const { getActivityFeed, getUser } = useData();
  const items = getActivityFeed();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="px-6 pb-2 pt-4">
        <Text className="font-display text-xl text-text">Activity</Text>
      </View>
      <ScrollView contentContainerClassName="gap-1 p-6 pt-2">
        {items.length === 0 ? (
          <EmptyState icon="activity" title="No activity yet" body="Expenses, payments and comments will show up here." />
        ) : (
          items.map((a) => (
            <View key={a.id} className="flex-row items-center gap-3 border-b border-border py-3">
              <View className="h-9 w-9 items-center justify-center rounded-pill bg-surface">
                <Feather name={ICON[a.type]} size={16} color="#6b7280" />
              </View>
              <View className="flex-1">
                <Text className="font-sans text-sm text-text">
                  <Text className="font-sans-semibold">{getUser(a.actorUserId ?? "")?.name ?? "Someone"}</Text>{" "}
                  {a.type === "expense_added" && "added"}
                  {a.type === "expense_updated" && "updated"}
                  {a.type === "expense_deleted" && "deleted"}
                  {a.type === "payment_recorded" && "recorded a payment for"}
                  {a.type === "comment_added" && "commented on"}
                  {a.type === "member_joined" && "joined the group"}
                  {a.type === "member_left" && "left the group"}
                  {a.type === "group_updated" && "updated the group"}
                  {a.metadata.description ? ` "${a.metadata.description}"` : ""}
                </Text>
                <Text className="font-sans text-xs text-muted">{timeAgo(a.createdAt)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
