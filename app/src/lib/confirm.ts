export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

type Listener = (opts: ConfirmOptions) => void;
let listener: Listener | null = null;

/** Registered by the single on-screen host (ConfirmDialogHost, mounted once
 * near the app root) that actually renders the dialog. */
export function registerConfirmListener(fn: Listener | null) {
  listener = fn;
}

/**
 * Shows a confirm dialog that matches the rest of the app's design, instead
 * of the OS/browser native one. Alert.alert is a silent no-op on web
 * (react-native-web renders nothing and the callback never fires, so any
 * destructive action gated behind it — delete, leave group, cancel payment —
 * became permanently unreachable there); the window.confirm() fallback that
 * replaced it worked, but looks like a raw browser dialog dropped onto a
 * styled app. ConfirmDialogHost renders the actual UI; this just notifies it.
 */
export function confirmAction(opts: ConfirmOptions) {
  if (!listener) {
    // No host mounted (shouldn't happen in the app) — fail safe rather than
    // silently dropping a destructive action.
    if (typeof window !== "undefined" && window.confirm(`${opts.title}\n\n${opts.message}`)) {
      opts.onConfirm();
    }
    return;
  }
  listener(opts);
}
