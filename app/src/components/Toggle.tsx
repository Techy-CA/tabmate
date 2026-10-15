import { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";

export type ToggleProps = {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
};

const TRACK_W = 44;
const TRACK_H = 26;
const KNOB = 22;
const INSET = (TRACK_H - KNOB) / 2;
const TRAVEL = TRACK_W - KNOB - INSET * 2;

// The switch itself uses only inline styles with exact sizes and radii.
// Two Android pitfalls broke the old one into a "half moon": borderRadius
// 999 on small views renders unevenly on Android, and NativeWind classes
// mixed with animated inline styles drop properties unpredictably.
export function Toggle({ label, description, value, onChange }: ToggleProps) {
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));
  const { colors, scheme } = useTheme();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: true, // opacity + transform only, both native-driver safe
    }).start();
  }, [value, progress]);

  const knobTranslate = progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });

  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      className="flex-row items-center justify-between gap-4 py-3"
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-sans-medium text-sm text-text">{label}</Text>
        {description ? <Text className="font-sans text-xs text-muted">{description}</Text> : null}
      </View>
      <View style={{ width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: scheme === "dark" ? "#3a404c" : "#d1d5db", overflow: "hidden" }}>
        {/* "on" colour fades in over the grey track */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: TRACK_W,
            height: TRACK_H,
            borderRadius: TRACK_H / 2,
            backgroundColor: colors.accent,
            opacity: progress,
          }}
        />
        <Animated.View
          style={{
            position: "absolute",
            top: INSET,
            left: INSET,
            width: KNOB,
            height: KNOB,
            borderRadius: KNOB / 2,
            backgroundColor: "#ffffff",
            elevation: 2,
            shadowColor: "#000000",
            shadowOpacity: 0.15,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            transform: [{ translateX: knobTranslate }],
          }}
        />
      </View>
    </Pressable>
  );
}
