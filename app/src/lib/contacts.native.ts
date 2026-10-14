// The stable function-based API (getContactsAsync/requestPermissionsAsync)
// is deprecated in favor of a new class-based Contact API in this Expo SDK,
// but still works and must be imported from "expo-contacts/legacy" — the
// new API's docs don't clearly document a non-deprecated permission-request
// flow, so the legacy import is the more predictable path here.
import { Fields, getContactsAsync, PermissionStatus, requestPermissionsAsync } from "expo-contacts/legacy";

export type DeviceContact = { name: string; email: string };

/**
 * Requests contacts permission and returns every device contact that has at
 * least one email address. Returns "unavailable" if permission was denied —
 * the UI shows the same message as the web stub (contacts.web.ts) in that
 * case, treating "denied" and "not supported on this platform" the same way
 * from the user's perspective.
 */
export async function pickContactsWithEmail(): Promise<DeviceContact[] | "unavailable"> {
  const { status } = await requestPermissionsAsync();
  if (status !== PermissionStatus.GRANTED) return "unavailable";

  const { data } = await getContactsAsync({ fields: [Fields.Emails, Fields.Name] });
  const withEmail: DeviceContact[] = [];
  for (const contact of data) {
    const email = contact.emails?.[0]?.email;
    if (email) withEmail.push({ name: contact.name ?? email, email });
  }
  return withEmail;
}
