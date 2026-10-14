import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { pickContactsWithEmail, type DeviceContact } from "@/lib/contacts";
import { useData } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

type EmailResult = { kind: "added"; name: string } | { kind: "already-friends" } | { kind: "self" } | { kind: "not-found"; email: string };

export default function AddFriend() {
  const router = useRouter();
  const { addFriendByEmail } = useData();

  const [email, setEmail] = useState("");
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null);

  const [contactsState, setContactsState] = useState<"idle" | "loading" | "unavailable">("idle");
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [addedEmails, setAddedEmails] = useState<Set<string>>(new Set());

  const submitEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    const result = await addFriendByEmail(trimmed);
    if (result === null) setEmailResult({ kind: "not-found", email: trimmed });
    else if (result === "self") setEmailResult({ kind: "self" });
    else if (result === "already-friends") setEmailResult({ kind: "already-friends" });
    else setEmailResult({ kind: "added", name: result.name });
    setEmail("");
  };

  const loadContacts = async () => {
    setContactsState("loading");
    const result = await pickContactsWithEmail();
    if (result === "unavailable") {
      setContactsState("unavailable");
      return;
    }
    setContacts(result);
    setContactsState("idle");
  };

  const addFromContact = async (contact: DeviceContact) => {
    const result = await addFriendByEmail(contact.email);
    if (result && result !== "self") {
      setAddedEmails((prev) => new Set(prev).add(contact.email));
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

      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">From your contacts</Text>
          {contactsState === "idle" && contacts.length === 0 ? (
            <Pressable
              onPress={loadContacts}
              accessibilityRole="button"
              className="flex-row items-center justify-center gap-2 rounded-md border border-border py-3"
            >
              <Feather name="users" size={16} color="#1f2430" />
              <Text className="font-sans-semibold text-sm text-text">Find friends from contacts</Text>
            </Pressable>
          ) : null}

          {contactsState === "loading" ? (
            <View className="items-center py-4">
              <ActivityIndicator color="#5b5fef" />
            </View>
          ) : null}

          {contactsState === "unavailable" ? (
            <Text className="font-sans text-sm text-muted">
              Contacts access isn&apos;t available here — this works once Tabmate is installed on your phone.
            </Text>
          ) : null}

          {contacts.length > 0 ? (
            <View className="gap-1">
              {contacts.map((c) => {
                const added = addedEmails.has(c.email);
                return (
                  <View key={c.email} className="flex-row items-center justify-between py-2">
                    <View className="flex-row items-center gap-3">
                      <Avatar id={c.email} name={c.name} size="sm" />
                      <View>
                        <Text className="font-sans-medium text-sm text-text">{c.name}</Text>
                        <Text className="font-sans text-xs text-muted">{c.email}</Text>
                      </View>
                    </View>
                    {added ? (
                      <Feather name="check" size={18} color="#15803d" />
                    ) : (
                      <Pressable
                        onPress={() => addFromContact(c)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${c.name}`}
                        className="rounded-pill border border-accent px-3 py-1"
                      >
                        <Text className="font-sans-semibold text-xs text-accent">Add</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <View className="gap-2 border-t border-border pt-6">
          <Text className="font-sans-semibold text-sm text-text">By email</Text>
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <Input
                label="Email"
                hideLabel
                placeholder="friend@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setEmailResult(null);
                }}
              />
            </View>
            <Button label="Add" disabled={!email.trim()} onPress={submitEmail} />
          </View>

          {emailResult?.kind === "added" ? (
            <Text className="font-sans text-sm text-success">{emailResult.name} added as a friend.</Text>
          ) : null}
          {emailResult?.kind === "already-friends" ? (
            <Text className="font-sans text-sm text-muted">You&apos;re already friends.</Text>
          ) : null}
          {emailResult?.kind === "self" ? (
            <Text className="font-sans text-sm text-muted">That&apos;s your own email.</Text>
          ) : null}
          {emailResult?.kind === "not-found" ? (
            <Text className="font-sans text-sm text-muted">
              No Tabmate account found for {emailResult.email} yet — invite emails aren&apos;t wired up until
              Tabmate has a real backend.
            </Text>
          ) : null}
        </View>

        <Pressable onPress={() => router.push("/group/join")} accessibilityRole="button" className="items-center py-2">
          <Text className="font-sans text-sm text-accent">Have an invite code instead? Join a group</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
