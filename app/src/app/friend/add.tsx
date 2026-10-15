import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { loadDeviceContacts, type DeviceContact } from "@/lib/contacts";
import { useData, type AddFriendResult, type ContactMatch } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

type EntryResult = AddFriendResult | { status: "error"; message: string };

const DOWNLOAD_URL = process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL;
// Rendering thousands of rows at once is slow; search narrows the rest.
const INVITE_LIST_LIMIT = 60;

function inviteMessage(inviterName: string, target: string) {
  return [
    `${inviterName} invited you to Tabmate — the easy way to split bills with friends.`,
    DOWNLOAD_URL ? `Get the app: ${DOWNLOAD_URL}` : null,
    `Sign up with ${target} and you'll be connected automatically.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** SMS when there's a number (Android opens the messages app prefilled), share sheet otherwise. */
async function sendInvite(message: string, phone?: string | null) {
  if (phone && Platform.OS !== "web") {
    const url = `sms:${phone}?body=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // no SMS app — fall back to the share sheet
    }
  }
  try {
    await Share.share({ message });
  } catch {
    // no share sheet (web preview) — the invite is still saved server-side
  }
}

type ContactState = "busy" | "added" | "invited";

function OptionRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center gap-3 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-pill bg-surface">
        <Feather name={icon} size={16} color="#1f2430" />
      </View>
      <View className="flex-1">
        <Text className="font-sans-medium text-sm text-text">{title}</Text>
        <Text className="font-sans text-xs text-muted">{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#6b7280" />
    </Pressable>
  );
}

export default function AddFriend() {
  const router = useRouter();
  const { addFriend, matchContacts, currentUser } = useData();

  const [entry, setEntry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EntryResult | null>(null);

  const [contactsState, setContactsState] = useState<"idle" | "loading" | "loaded" | "unavailable" | "error">("idle");
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [matches, setMatches] = useState<Map<string, ContactMatch>>(new Map());
  const [contactStatus, setContactStatus] = useState<Record<string, ContactState>>({});
  const [filter, setFilter] = useState("");

  const submit = async () => {
    const value = entry.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      const r = await addFriend(value);
      setResult(r);
      if (r.status === "added" || r.status === "already" || r.status === "invited") setEntry("");
      if (r.status === "invited") sendInvite(inviteMessage(currentUser.name, r.email ?? r.phone ?? value), r.phone);
    } catch (e) {
      setResult({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  };

  const loadContacts = async () => {
    setContactsState("loading");
    try {
      const list = await loadDeviceContacts();
      if (list === "unavailable") {
        setContactsState("unavailable");
        return;
      }
      setContacts(list);
      setMatches(await matchContacts(list.flatMap((c) => c.phones), list.flatMap((c) => c.emails)));
      setContactsState("loaded");
    } catch {
      setContactsState("error");
    }
  };

  const matchFor = (c: DeviceContact) => {
    for (const key of [...c.phones, ...c.emails]) {
      const m = matches.get(key);
      if (m) return m;
    }
    return undefined;
  };

  const q = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return contacts;
    const qDigits = q.replace(/\D/g, "");
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && c.phones.some((p) => p.replace(/\D/g, "").includes(qDigits))) ||
        c.emails.some((e) => e.toLowerCase().includes(q))
    );
  }, [contacts, q]);
  const onTabmate = visible.filter((c) => matchFor(c) && matchFor(c)!.userId !== currentUser.id);
  const toInvite = visible.filter((c) => !matchFor(c));

  const addContact = async (c: DeviceContact) => {
    // add by whichever of the contact's numbers/emails matched an account
    const key = [...c.phones, ...c.emails].find((k) => matches.has(k));
    if (!key) return;
    setContactStatus((s) => ({ ...s, [c.id]: "busy" }));
    try {
      const r = await addFriend(key);
      if (r.status === "added" || r.status === "already") setContactStatus((s) => ({ ...s, [c.id]: "added" }));
      else setContactStatus(({ [c.id]: _, ...rest }) => rest);
    } catch {
      setContactStatus(({ [c.id]: _, ...rest }) => rest);
    }
  };

  const inviteContact = async (c: DeviceContact) => {
    const target = c.phones[0] ?? c.emails[0];
    setContactStatus((s) => ({ ...s, [c.id]: "busy" }));
    try {
      // Saves the pending invite, so they're connected the moment they sign up.
      const r = await addFriend(target);
      setContactStatus((s) => ({ ...s, [c.id]: "invited" }));
      await sendInvite(inviteMessage(currentUser.name, c.phones[0] ?? c.emails[0]), r.status === "invited" ? r.phone : null);
    } catch {
      setContactStatus(({ [c.id]: _, ...rest }) => rest);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => goBack(router, "/")}>
          <Feather name="x" size={22} color="#1f2430" />
        </Pressable>
        <Text className="font-display text-lg text-text">Add a friend</Text>
      </View>

      <ScrollView contentContainerClassName="gap-6 p-6" keyboardShouldPersistTaps="handled">
        <View className="gap-3">
          <Input
            label="Email or mobile number"
            placeholder="Email or mobile number"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={entry}
            onChangeText={(t) => {
              setEntry(t);
              setResult(null);
            }}
            onSubmitEditing={submit}
            returnKeyType="send"
            autoFocus
          />
          <Button label="Add friend" size="lg" loading={submitting} disabled={!entry.trim()} onPress={submit} />

          {result?.status === "added" ? (
            <Text className="font-sans text-sm text-success">{result.user.name} is now your friend — we&apos;ve let them know.</Text>
          ) : null}
          {result?.status === "already" ? (
            <Text className="font-sans text-sm text-muted">You&apos;re already friends with {result.user.name}.</Text>
          ) : null}
          {result?.status === "self" ? <Text className="font-sans text-sm text-muted">That&apos;s you!</Text> : null}
          {result?.status === "invalid" ? (
            <Text className="font-sans text-sm text-danger">
              Enter an email, or a mobile number (add the country code if it&apos;s not Indian, e.g. +44…).
            </Text>
          ) : null}
          {result?.status === "error" ? <Text className="font-sans text-sm text-danger">{result.message}</Text> : null}
          {result?.status === "invited" ? (
            <View className="gap-2 rounded-lg border border-border bg-surface p-3">
              <Text className="font-sans text-sm text-text">
                {result.email ?? result.phone} isn&apos;t on Tabmate yet. Invite saved — when they sign up you&apos;ll be
                connected automatically.
              </Text>
              <Button
                label={result.phone ? "Send invite SMS" : "Send invite"}
                variant="secondary"
                size="sm"
                onPress={() => sendInvite(inviteMessage(currentUser.name, result.email ?? result.phone ?? ""), result.phone)}
              />
            </View>
          ) : null}

        </View>

        <View className="gap-3">
          {contactsState === "idle" ? (
            <View className="border-y border-border">
              <OptionRow
                icon="book"
                title="Find friends from contacts"
                subtitle="See who's already on Tabmate, invite the rest"
                onPress={loadContacts}
              />
              {!currentUser.phone ? (
                <OptionRow
                  icon="smartphone"
                  title="Add your mobile number"
                  subtitle="So friends can find you too"
                  onPress={() => router.push("/account/phone")}
                />
              ) : null}
              <OptionRow
                icon="hash"
                title="Join a group with a code"
                subtitle="If someone shared an invite code"
                onPress={() => router.push("/group/join")}
              />
            </View>
          ) : (
            <Text className="font-sans-semibold text-sm text-text">From your contacts</Text>
          )}
          {contactsState === "loading" ? (
            <View className="items-center py-4">
              <ActivityIndicator color="#5b5fef" />
            </View>
          ) : null}
          {contactsState === "unavailable" ? (
            <Text className="font-sans text-sm text-muted">
              Contacts aren&apos;t available — allow access in your phone&apos;s settings, or add friends above.
            </Text>
          ) : null}
          {contactsState === "error" ? (
            <Pressable onPress={loadContacts} accessibilityRole="button">
              <Text className="font-sans text-sm text-danger">Couldn&apos;t check your contacts. Tap to try again.</Text>
            </Pressable>
          ) : null}

          {contactsState === "loaded" ? (
            <>
              {contacts.length > 15 ? (
                <Input label="Search contacts" hideLabel placeholder="Search contacts" value={filter} onChangeText={setFilter} />
              ) : null}

              {onTabmate.length > 0 ? (
                <View>
                  <Text className="pb-1 font-sans-medium text-xs uppercase text-muted">On Tabmate</Text>
                  {onTabmate.map((c) => {
                    const m = matchFor(c)!;
                    const state = contactStatus[c.id];
                    return (
                      <View key={c.id} className="flex-row items-center gap-3 py-2">
                        <Avatar id={m.userId} name={m.name} size="sm" />
                        <View className="flex-1">
                          <Text className="font-sans-medium text-sm text-text">{c.name}</Text>
                          <Text className="font-sans text-xs text-muted">{c.phones[0] ?? c.emails[0]}</Text>
                        </View>
                        {m.isFriend || state === "added" ? (
                          <Text className="font-sans text-xs text-success">Friends</Text>
                        ) : state === "busy" ? (
                          <ActivityIndicator color="#5b5fef" />
                        ) : (
                          <Pressable
                            onPress={() => addContact(c)}
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${c.name}`}
                            className="rounded-pill bg-accent px-3 py-1"
                          >
                            <Text className="font-sans-semibold text-xs text-on-accent">Add</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {toInvite.length > 0 ? (
                <View>
                  <Text className="pb-1 font-sans-medium text-xs uppercase text-muted">Invite to Tabmate</Text>
                  {toInvite.slice(0, q ? undefined : INVITE_LIST_LIMIT).map((c) => {
                    const state = contactStatus[c.id];
                    return (
                      <View key={c.id} className="flex-row items-center gap-3 py-2">
                        <Avatar id={c.id} name={c.name} size="sm" />
                        <View className="flex-1">
                          <Text className="font-sans-medium text-sm text-text">{c.name}</Text>
                          <Text className="font-sans text-xs text-muted">{c.phones[0] ?? c.emails[0]}</Text>
                        </View>
                        {state === "invited" ? (
                          <Text className="font-sans text-xs text-muted">Invited</Text>
                        ) : state === "busy" ? (
                          <ActivityIndicator color="#5b5fef" />
                        ) : (
                          <Pressable
                            onPress={() => inviteContact(c)}
                            accessibilityRole="button"
                            accessibilityLabel={`Invite ${c.name}`}
                            className="rounded-pill border border-accent px-3 py-1"
                          >
                            <Text className="font-sans-semibold text-xs text-accent">Invite</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                  {!q && toInvite.length > INVITE_LIST_LIMIT ? (
                    <Text className="pt-2 font-sans text-xs text-muted">
                      Showing {INVITE_LIST_LIMIT} of {toInvite.length} — search to find someone.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {onTabmate.length === 0 && toInvite.length === 0 ? (
                <Text className="font-sans text-sm text-muted">No contacts match.</Text>
              ) : null}
            </>
          ) : null}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
