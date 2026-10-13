import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Text, View } from "react-native";

export type EmptyStateProps = {
  icon: ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-3 rounded-lg border border-dashed border-border p-8">
      <View className="h-12 w-12 items-center justify-center rounded-pill bg-surface">
        <Feather name={icon} size={22} color="#6b7280" />
      </View>
      <Text accessibilityRole="header" className="font-sans-semibold text-base text-text">
        {title}
      </Text>
      <Text className="text-center font-sans text-sm text-muted">{body}</Text>
      {action}
    </View>
  );
}
