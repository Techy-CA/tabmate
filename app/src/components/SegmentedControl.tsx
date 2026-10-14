import { Pressable, Text, View } from "react-native";

export type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Wraps onto multiple rows instead of scrolling horizontally — a scrollable
 * strip with no scroll indicator hides options off the edge of the screen
 * with no hint there's more, which is worse than just wrapping.
 */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View accessibilityRole="tablist" className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`rounded-pill border px-3 py-1.5 ${selected ? "border-accent bg-accent" : "border-border"}`}
          >
            <Text className={`font-sans-semibold text-sm ${selected ? "text-on-accent" : "text-muted"}`}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
