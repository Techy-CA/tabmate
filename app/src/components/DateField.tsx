import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** yyyy-mm-dd in the phone's local time (not UTC — avoids "yesterday" after midnight IST). */
export function localISODate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return localISODate(new Date(y, m - 1, d + days));
}

export function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const nowYear = new Date().getFullYear();
  return `${d} ${MONTHS[m - 1]}${y !== nowYear ? ` ${y}` : ""}`;
}

type Props = { label: string; value: string; onChange: (iso: string) => void; allowFuture?: boolean };

/**
 * Today / Yesterday chips plus "Other date" — the native calendar on the
 * phone, a plain yyyy-mm-dd box in the web preview (no native picker there).
 */
export function DateField({ label, value, onChange, allowFuture = false }: Props) {
  const today = localISODate();
  const yesterday = shiftDays(today, -1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isOther = value !== today && value !== yesterday;

  const chip = (text: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={text}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      className={`rounded-pill border px-3 py-1.5 ${active ? "border-accent bg-accent/10" : "border-border"}`}
    >
      <Text className={`font-sans text-sm ${active ? "text-accent" : "text-text"}`}>{text}</Text>
    </Pressable>
  );

  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-sm text-text">{label}</Text>
      <View className="flex-row flex-wrap items-center gap-2">
        {chip("Today", value === today, () => onChange(today))}
        {chip("Yesterday", value === yesterday, () => onChange(yesterday))}
        {chip(isOther ? prettyDate(value) : "Other date", isOther, () => setPickerOpen(true))}
      </View>

      {pickerOpen && Platform.OS === "web" ? (
        <TextInput
          accessibilityLabel={`${label} (yyyy-mm-dd)`}
          defaultValue={value}
          placeholder="yyyy-mm-dd"
          className="h-11 rounded-sm border border-border-input px-3 font-sans text-base text-text"
          onSubmitEditing={(e) => {
            const v = e.nativeEvent.text.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) onChange(v);
            setPickerOpen(false);
          }}
          onBlur={() => setPickerOpen(false)}
          autoFocus
        />
      ) : null}
      {pickerOpen && Platform.OS !== "web" ? (
        <DateTimePicker
          value={(() => {
            const [y, m, d] = value.split("-").map(Number);
            return new Date(y, m - 1, d);
          })()}
          mode="date"
          maximumDate={allowFuture ? undefined : new Date()}
          onChange={(event, date) => {
            setPickerOpen(false);
            if (event.type === "set" && date) onChange(localISODate(date));
          }}
        />
      ) : null}
    </View>
  );
}
