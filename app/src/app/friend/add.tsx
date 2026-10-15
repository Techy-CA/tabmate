import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { pickContactsWithEmail, type DeviceContact } from "@/lib/contacts";
import { useData, type AddFriendResult } from "@/lib/data/store";
import { goBack } from "@/lib/nav";

type EmailResult = AddFriendResult | { status: "error"; message: string };

const DOWNLOAD_URL = process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL;

function inviteMessage(inviterName: string, email: string) {
  return [
    `${inviterName} invited you to Tabmate — the easy way to split bills with friends.`,
    DOWNLOAD_URL ? `Get the app: ${DOWNLOAD_URL}` : null,
    `Sign up with ${email} and you'll be connected automatically.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function AddFriend() {
  const router = useRouter();
  const { addFriendByEmail, currentUser } = useData();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null);

  const [contactsState, setContactsState] = useState<"idle" | "loading" | "unavailable">("idle");
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [contactStatus, setContactStatus] = useState<Record<string, "added" | "invited" | "busy">>({});

  const shareInvite = async (to: string) => {
    try {
      await Share.share({ message: inviteMessage(currentUser.name, to) });
    } catch {
      // No share sheet (web preview) — the invite is still saved server-side.
    }
  };

  const submitEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const result = await addFriendByEmail(trimmed);
      setEmailResult(result);
      if (result.status === "added" || result.status === "already" || result.status === "invited") setEmail("");
      if (result.status === "invited") shareInvite(result.email);
    } catch (e) {
      setEmailResult({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
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
    setContactStatus((prev) => ({ ...prev, [contact.email]: "busy" }));
    try {
      const result = await addFriendByEmail(contact.email);
      if (result.status === "invited") {
        setContactStatus((prev) => ({ ...prev, [contact.email]: "invited" }));
        shareInvite(result.email);
      } else if (result.status === "added" || result.status === "already") {
        setContactStatus((prev) => ({ ...prev, [contact.email]: "added" }));
      } else {
        setContactStatus(({ [contact.email]: _, ...rest }) => rest);
      }
    } catch {
      setContactStatus(({ [contact.email]: _, ...rest }) => rest);
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
        <View className="gap-2">
          <Text className="font-sans-semibold text-sm text-text">By email</Text>
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <Input
                label="Email"
                hideLabel
                placeholder="friend@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setEmailResult(null);
                }}
                onSubmitEditing={submitEmail}
                returnKeyType="send"
              />
            </View>
            <Button label="Add" loading={submitting} disabled={!email.trim()} onPress={submitEmail} />
          </View>

          {emailResult?.status === "added" ? (
            <Text className="font-sans text-sm text-success">
              {emailResult.user.name} is now your friend — we&apos;ve let them know.
            </Text>
          ) : null}
          {emailResult?.status === "already" ? (
            <Text className="font-sans text-sm text-muted">You&apos;re already friends with {emailResult.user.name}.</Text>
          ) : null}
          {emailResult?.status === "self" ? (
            <Text className="font-sans text-sm text-muted">That&apos;s your own email.</Text>
          ) : null}
          {emailResult?.status === "invalid" ? (
            <Text className="font-sans text-sm text-danger">That doesn&apos;t look like an email address.</Text>
          ) : null}
          {emailResult?.status === "error" ? (
            <Text className="font-sans text-sm text-danger">{emailResult.message}</Text>
          ) : null}
          {emailResult?.status === "invited" ? (
            <View className="gap-2 rounded-lg border border-border bg-surface p-3">
              <Text className="font-sans text-sm text-text">
                {emailResult.email} isn&apos;t on Tabmate yet. We saved your invite — when they sign up with this
                email you&apos;ll be connected automatically and get a notification.
              </Text>
              <Button label="Send invite message" variant="secondary" size="sm" onPress={() => shareInvite(emailResult.email)} />
            </View>
          ) : null}
        </View>

        <View className="gap-2 border-t border-border pt-6">
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
              Contacts access isn&apos;t available — allow it in your phone&apos;s settings, or add friends by email above.
            </Text>
          ) : null}

          {contacts.length > 0 ? (
            <View className="gap-1">
              {contacts.map((c) => {
                const state = contactStatus[c.email];
                return (
                  <View key={c.email} className="flex-row items-center justify-between py-2">
                    <View className="flex-1 flex-row items-center gap-3">
                      <Avatar id={c.email} name={c.name} size="sm" />
                      <View className="flex-1">
                        <Text className="font-sans-medium text-sm text-text">{c.name}</Text>
                        <Text className="font-sans text-xs text-muted">{c.email}</Text>
                      </View>
                    </View>
                    {state === "added" ? (
                      <Feather name="check" size={18} color="#15803d" />
                    ) : state === "invited" ? (
                      <Text className="font-sans text-xs text-muted">Invited</Text>
                    ) : state === "busy" ? (
                      <ActivityIndicator color="#5b5fef" />
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

        <Pressable onPress={() => router.push("/group/join")} accessibilityRole="button" className="items-center py-2">
          <Text className="font-sans text-sm text-accent">Have an invite code instead? Join a group</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
