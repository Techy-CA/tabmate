import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { formatCents } from "@/lib/data/balances";

// Two small chart forms, both single-series (one hue: the accent), so colour
// never has to carry identity — labels and values are always written out in
// text colours. Bars are thin with rounded ends on a recessive track.

export type BarRow = { key: string; label: string; cents: number; sub?: string };

/** Magnitude by category/group: label + value in text, a thin bar under it. */
export function BarList({ rows, currency }: { rows: BarRow[]; currency: string }) {
  const max = Math.max(...rows.map((r) => r.cents), 1);
  const total = rows.reduce((s, r) => s + r.cents, 0) || 1;
  return (
    <View className="gap-3">
      {rows.map((r) => (
        <View
          key={r.key}
          className="gap-1"
          accessible
          accessibilityLabel={`${r.label}: ${formatCents(r.cents, currency)}, ${Math.round((r.cents / total) * 100)} percent`}
        >
          <View className="flex-row items-baseline justify-between gap-3">
            <Text numberOfLines={1} className="flex-1 font-sans text-sm text-text">
              {r.label}
              {r.sub ? <Text className="font-sans text-xs text-muted">  {r.sub}</Text> : null}
            </Text>
            <Text className="font-sans-semibold text-sm text-text">{formatCents(r.cents, currency)}</Text>
            <Text className="w-10 text-right font-sans text-xs text-muted">{Math.round((r.cents / total) * 100)}%</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-sm bg-surface">
            <View className="h-2 rounded-sm bg-accent" style={{ width: `${Math.max((r.cents / max) * 100, r.cents > 0 ? 2 : 0)}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export type MonthBar = { key: string; label: string; cents: number };

/**
 * Change over time: one bar per month, oldest left. Only the selected month
 * (default: the latest) carries a value label; tap any bar to read it.
 */
export function MonthBars({ months, currency, height = 120 }: { months: MonthBar[]; currency: string; height?: number }) {
  const [selected, setSelected] = useState(months.length - 1);
  const max = Math.max(...months.map((m) => m.cents), 1);
  const sel = months[selected];
  return (
    <View className="gap-2">
      <Text className="font-sans text-xs text-muted">
        {sel ? (
          <>
            {sel.label}: <Text className="font-sans-semibold text-text">{formatCents(sel.cents, currency)}</Text>
          </>
        ) : null}
      </Text>
      <View className="flex-row items-end gap-2" style={{ height }}>
        {months.map((m, i) => (
          <Pressable
            key={m.key}
            onPress={() => setSelected(i)}
            accessibilityRole="button"
            accessibilityLabel={`${m.label}: ${formatCents(m.cents, currency)}`}
            accessibilityState={{ selected: i === selected }}
            className="h-full flex-1 justify-end"
          >
            <View
              className={`rounded-t-sm ${i === selected ? "bg-accent" : "bg-accent/40"}`}
              style={{ height: m.cents > 0 ? Math.max((m.cents / max) * height, 3) : 1 }}
            />
          </Pressable>
        ))}
      </View>
      <View className="flex-row gap-2 border-t border-border pt-1">
        {months.map((m, i) => (
          <Text key={m.key} className={`flex-1 text-center font-sans text-xs ${i === selected ? "text-text" : "text-muted"}`}>
            {m.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last `count` months as yyyy-mm keys with short labels, oldest first. */
export function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTHS[d.getMonth()] };
  });
}

export const categoryLabel = (c: string) => c[0].toUpperCase() + c.slice(1);
