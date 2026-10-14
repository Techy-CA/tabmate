export type DeviceContact = { name: string; email: string };

/**
 * expo-contacts has no web implementation at all (not just unavailable at
 * call time — it isn't a supported platform per Expo's own docs), so this
 * file never imports the native module. Metro picks this .web.ts over
 * contacts.native.ts automatically for web builds, keeping the native
 * module out of the web bundle entirely.
 */
export async function pickContactsWithEmail(): Promise<DeviceContact[] | "unavailable"> {
  return "unavailable";
}
