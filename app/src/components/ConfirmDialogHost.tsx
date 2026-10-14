import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { type ConfirmOptions, registerConfirmListener } from "@/lib/confirm";

/**
 * Single host for every confirmAction() call in the app, mounted once near
 * the root (app/_layout.tsx). See lib/confirm.ts for why this replaces
 * Alert.alert / window.confirm.
 */
export function ConfirmDialogHost() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);

  useEffect(() => {
    registerConfirmListener(setOpts);
    return () => registerConfirmListener(null);
  }, []);

  const close = () => setOpts(null);

  return (
    <Modal visible={!!opts} transparent animationType="fade" onRequestClose={close}>
      <Pressable accessibilityLabel="Close" onPress={close} className="flex-1 items-center justify-center bg-black/40 p-6">
        {/* Absorbs the press so tapping the card itself doesn't also hit
            the backdrop's onPress and dismiss it. */}
        <Pressable onPress={() => {}} className="w-full max-w-sm gap-4 rounded-lg bg-bg p-5 shadow-pop">
          <Text className="font-display text-lg text-text">{opts?.title}</Text>
          <Text className="font-sans text-sm text-muted">{opts?.message}</Text>
          <View className="flex-row justify-end gap-3">
            <Button label="Cancel" variant="secondary" onPress={close} />
            <Button
              label={opts?.confirmLabel ?? "Confirm"}
              variant={opts?.destructive ? "danger" : "primary"}
              onPress={() => {
                opts?.onConfirm();
                close();
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
