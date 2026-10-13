import { Pressable, Text, View } from "react-native";

export type ToggleProps = {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
};

export function Toggle({ label, description, value, onChange }: ToggleProps) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      className="flex-row items-center justify-between gap-3 py-3"
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-sans-medium text-sm text-text">{label}</Text>
        {description ? <Text className="font-sans text-xs text-muted">{description}</Text> : null}
      </View>
      <View className={`h-6 w-10 justify-center rounded-pill p-0.5 ${value ? "bg-accent" : "bg-border"}`}>
        <View
          className="h-5 w-5 rounded-pill bg-on-accent"
          style={{ transform: [{ translateX: value ? 16 : 0 }] }}
        />
      </View>
    </Pressable>
  );
}
