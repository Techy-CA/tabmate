import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { loadDeviceContacts, type DeviceContact } from "@/lib/contacts";
import { useData, type AddFriendResult, type ContactMatch } from "@/lib/data/store";
import { inviteMessage, sendInvite } from "@/lib/invite";
import { goBack } from "@/lib/nav";

type EntryResult = AddFriendResult | { status: "error"; message: string };

// Rendering thousands of rows at once is slow; search narrows the rest.
const INVITE_LIST_LIMIT = 60;

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
        <Feather name={icon} size={16} className="text-text" />
      </View>
      <View className="flex-1">
        <Text className="font-sans-medium text-sm text-text">{title}</Text>
        <Text className="font-sans text-xs text-muted">{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} className="text-muted" />
    </Pressable>
  );
}

export default function AddFriend() {
  const router = useRouter();
  const { addFriend, matchContacts, currentUser } = useData();

  const [entry, setEntry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EntryResult | null>(null);
  // asked for when the email/number isn't on Tabmate yet
  const [newName, setNewName] = useState("");

  const [contactsState, setContactsState] = useState<"idle" | "loading" | "loaded" | "unavailable" | "error">("idle");
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [matches, setMatches] = useState<Map<string, ContactMatch>>(new Map());
  const [contactStatus, setContactStatus] = useState<Record<string, ContactState>>({});
  const [filter, setFilter] = useState("");

  const submit = async (name?: string) => {
    const value = entry.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      const r = await addFriend(value, name);
      setResult(r);
      if (r.status === "added" || r.status === "already" || r.status === "invited") {
        setEntry("");
        setNewName("");
      }
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
      // Creates them as a pending friend (named as in your contacts) — you can
      // add them to groups and expenses now; they take it over on sign-up.
      const r = await addFriend(target, c.name);
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
          <Feather name="x" size={22} className="text-text" />
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
            onSubmitEditing={() => submit()}
            returnKeyType="send"
            autoFocus
          />
          {result?.status !== "needs_name" ? (
            <Button label="Add friend" size="lg" loading={submitting} disabled={!entry.trim()} onPress={() => submit()} />
          ) : null}

          {result?.status === "needs_name" ? (
            <View className="gap-3 rounded-lg border border-border bg-surface p-4">
              <Text className="font-sans text-sm text-text">
                {result.email ?? result.phone} isn&apos;t on Tabmate yet. Add them anyway — you can put them in groups and
                expenses right away, and it&apos;s all waiting for them when they join.
              </Text>
              <Input
                label="Their name"
                placeholder="e.g. Chinmay"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                onSubmitEditing={() => newName.trim() && submit(newName)}
                returnKeyType="done"
              />
              <Button
                label="Add & send invite"
                size="lg"
                loading={submitting}
                disabled={!newName.trim()}
                onPress={() => submit(newName)}
              />
            </View>
          ) : null}

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
                {result.user.name} is added as a friend (invited). Add them to groups or split expenses with them now —
                when they sign up with {result.email ?? result.phone}, everything&apos;s already there.
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
              <ActivityIndicator className="text-accent" />
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
                          <ActivityIndicator className="text-accent" />
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
                          <ActivityIndicator className="text-accent" />
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
