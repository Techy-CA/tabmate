export type DeviceContact = { name: string; email: string };

/**
 * Fallback only — Metro always resolves contacts.native.ts or
 * contacts.web.ts over this bare file at bundle time (platform extensions
 * take priority), so this body never actually runs. It exists purely so
 * `tsc` (which doesn't apply Metro's platform-extension resolution) can
 * resolve the bare "@/lib/contacts" import used in friend/add.tsx.
 */
export async function pickContactsWithEmail(): Promise<DeviceContact[] | "unavailable"> {
  return "unavailable";
}
