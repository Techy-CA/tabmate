import { Pressable, ScrollView, Text, View } from "react-native";

export type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View accessibilityRole="tablist" className="flex-row gap-1 rounded-pill bg-surface p-1">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={`rounded-pill px-3 py-1.5 ${selected ? "bg-accent" : ""}`}
            >
              <Text className={`font-sans-semibold text-sm ${selected ? "text-on-accent" : "text-muted"}`}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
