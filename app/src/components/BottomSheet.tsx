import { useEffect, useState } from "react";
import { Animated, Modal, Pressable, Text, View } from "react-native";

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

/**
 * Sheet variant of the modal primitive (split options, settle-up method).
 * Traps focus by virtue of RN's Modal; the explicit close button gives
 * keyboard/screen-reader users a dismiss path that doesn't rely on a swipe
 * gesture.
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const [translateY] = useState(() => new Animated.Value(300));

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 300,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        className="flex-1 justify-end bg-black/40"
      >
        <Animated.View
          style={{ transform: [{ translateY }] }}
          className="gap-4 rounded-t-lg bg-bg p-5 shadow-pop"
        >
          <View className="flex-row items-center justify-between">
            <Text className="font-display text-lg text-text">{title}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-8 w-8 items-center justify-center rounded-pill bg-surface"
            >
              <Text className="text-muted">✕</Text>
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
