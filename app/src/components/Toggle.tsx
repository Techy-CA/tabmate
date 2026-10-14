import { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

export type ToggleProps = {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
};

const KNOB_SIZE = 20;
const KNOB_INSET = 2;
const KNOB_TRAVEL = 16; // track width(40) - knob(20) - inset(2)*2

export function Toggle({ label, description, value, onChange }: ToggleProps) {
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: true, // opacity + transform only, both native-driver safe
    }).start();
  }, [value, progress]);

  const knobTranslate = progress.interpolate({ inputRange: [0, 1], outputRange: [0, KNOB_TRAVEL] });

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
      <View className="relative h-6 w-10 rounded-pill">
        {/* Two stacked layers crossfade via opacity instead of animating
            backgroundColor directly. On web, a NativeWind className mixed
            with an animated inline `style` on the same Animated.View drops
            classes unpredictably (position/size/color — different ones each
            time), so these two layers use plain inline styles exclusively,
            no className, to sidestep that interaction entirely. */}
        <View className="absolute inset-0 rounded-pill bg-border" />
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 999,
            backgroundColor: "#5b5fef",
            opacity: progress,
          }}
        />
        <Animated.View
          style={{
            position: "absolute",
            top: KNOB_INSET,
            left: KNOB_INSET,
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            borderRadius: 999,
            backgroundColor: "#ffffff",
            transform: [{ translateX: knobTranslate }],
          }}
        />
      </View>
    </Pressable>
  );
}
