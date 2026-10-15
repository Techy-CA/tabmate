// The stable function-based API (getContactsAsync/requestPermissionsAsync)
// is deprecated in favor of a new class-based Contact API in this Expo SDK,
// but still works and must be imported from "expo-contacts/legacy" — the
// new API's docs don't clearly document a non-deprecated permission-request
// flow, so the legacy import is the more predictable path here.
import { Fields, getContactsAsync, PermissionStatus, requestPermissionsAsync } from "expo-contacts/legacy";

export type DeviceContact = { id: string; name: string; phones: string[]; emails: string[] };

/**
 * Requests contacts permission and returns every device contact with at
 * least one phone number or email, sorted by name. Returns "unavailable" if
 * permission was denied — the UI treats "denied" and "not supported on this
 * platform" the same way from the user's perspective.
 */
export async function loadDeviceContacts(): Promise<DeviceContact[] | "unavailable"> {
  const { status } = await requestPermissionsAsync();
  if (status !== PermissionStatus.GRANTED) return "unavailable";

  const { data } = await getContactsAsync({ fields: [Fields.Emails, Fields.PhoneNumbers, Fields.Name] });
  const result: DeviceContact[] = [];
  for (const c of data) {
    const phones = [...new Set((c.phoneNumbers ?? []).map((p) => p.number?.trim()).filter((n): n is string => !!n))];
    const emails = [...new Set((c.emails ?? []).map((e) => e.email?.trim()).filter((e): e is string => !!e))];
    if (phones.length === 0 && emails.length === 0) continue;
    result.push({ id: c.id ?? `${c.name}-${phones[0] ?? emails[0]}`, name: c.name ?? phones[0] ?? emails[0], phones, emails });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
