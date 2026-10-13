import "./global.css";

import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { Avatar } from "./components/Avatar";
import { BalanceChip } from "./components/BalanceChip";
import { BottomSheet } from "./components/BottomSheet";
import { Button } from "./components/Button";
import { Input } from "./components/Input";

/**
 * /design — the primitives rendered in isolation, per replica-design's
 * step 4 ("build the primitives before any screen"). Not a real app screen;
 * replica-build replaces this with Expo Router and the actual app shell.
 */
export default function App() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-8 p-6 pt-16">
      <StatusBar style="auto" />

      <View className="gap-1">
        <Text className="font-display text-display font-bold text-text">Design primitives</Text>
        <Text className="font-sans text-sm text-muted">
          Button, Input, Avatar, BalanceChip, BottomSheet — tokens.json via NativeWind.
        </Text>
      </View>

      <Section title="Button">
        <Row>
          <Button label="Primary" variant="primary" />
          <Button label="Primary strong" variant="primary-strong" />
          <Button label="Secondary" variant="secondary" />
          <Button label="Ghost" variant="ghost" />
          <Button label="Danger" variant="danger" />
        </Row>
        <Row>
          <Button label="Small" size="sm" />
          <Button label="Medium" size="md" />
          <Button label="Large" size="lg" />
          <Button label="Disabled" disabled />
          <Button label="Loading" loading />
        </Row>
      </Section>

      <Section title="Input">
        <Row>
          <View className="w-56">
            <Input label="Group name" placeholder="Goa Trip 2026" />
          </View>
          <View className="w-56">
            <Input label="Amount" prefix="₹" keyboardType="decimal-pad" placeholder="0.00" />
          </View>
          <View className="w-56">
            <Input label="Amount" prefix="₹" error="Splits don't add up to ₹1,200" />
          </View>
        </Row>
      </Section>

      <Section title="Avatar">
        <Row>
          <Avatar id="u1" name="Rhea Kapoor" size="xs" />
          <Avatar id="u2" name="Dev Malhotra" size="sm" />
          <Avatar id="u3" name="Ayaan Sheikh" size="md" showUnreadDot />
          <Avatar id="u4" name="Nisha Rao" size="lg" />
        </Row>
      </Section>

      <Section title="Balance chip">
        <Row>
          <BalanceChip state="owed-to-you" amount="₹1,240" />
          <BalanceChip state="you-owe" amount="₹480" />
          <BalanceChip state="settled" />
          <BalanceChip state="owed-to-you" amount="₹60" size="sm" />
        </Row>
      </Section>

      <Section title="Bottom sheet">
        <Button label="Open split options" variant="secondary" onPress={() => setSheetOpen(true)} />
        <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Split options">
          <Row>
            <Button label="Equally" size="sm" variant="primary" />
            <Button label="Exact" size="sm" variant="secondary" />
            <Button label="Shares" size="sm" variant="secondary" />
          </Row>
          <Text className="font-sans text-sm text-muted">
            Remainder: ₹0.00 — splits add up.
          </Text>
        </BottomSheet>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 rounded-lg border border-border bg-surface p-4">
      <Text className="font-sans text-sm font-semibold text-text">{title}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap items-center gap-3">{children}</View>;
}
