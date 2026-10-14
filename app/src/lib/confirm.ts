import { Alert, Platform } from "react-native";

/**
 * Alert.alert() is a silent no-op on web — react-native-web renders nothing
 * and the callback never fires, so any destructive action gated behind it
 * (delete, leave group) becomes permanently unreachable there. Native iOS
 * and Android are unaffected; this only swaps the web path.
 */
export function confirmAction(opts: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  if (Platform.OS === "web") {
    if (window.confirm(`${opts.title}\n\n${opts.message}`)) opts.onConfirm();
    return;
  }
  Alert.alert(opts.title, opts.message, [
    { text: "Cancel", style: "cancel" },
    { text: opts.confirmLabel, style: opts.destructive ? "destructive" : "default", onPress: opts.onConfirm },
  ]);
}
