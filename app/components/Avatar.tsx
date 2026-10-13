import { Image, Text, View } from "react-native";

type Size = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<Size, number> = { xs: 20, sm: 28, md: 40, lg: 56 };

// Deterministic colour from a user id, so the same person is always the same
// colour without storing a colour field. Values are placeholder-palette tints
// — replica-brand should swap this ramp for the final brand palette.
const INITIAL_BG = ["#5b5fef", "#15803d", "#b45309", "#dc2626", "#0891b2", "#7c3aed"];

function colourForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return INITIAL_BG[hash % INITIAL_BG.length];
}

export type AvatarProps = {
  id: string;
  name: string;
  photoUrl?: string;
  size?: Size;
  showUnreadDot?: boolean;
};

export function Avatar({ id, name, photoUrl, size = "md", showUnreadDot }: AvatarProps) {
  const px = sizeMap[size];
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <View style={{ width: px, height: px }} className="relative">
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          accessibilityLabel={name}
          style={{ width: px, height: px, borderRadius: px }}
          className="border border-border"
        />
      ) : (
        <View
          accessibilityLabel={name}
          style={{ width: px, height: px, borderRadius: px, backgroundColor: colourForId(id) }}
          className="items-center justify-center"
        >
          <Text className="font-sans font-semibold text-on-accent" style={{ fontSize: px * 0.4 }}>
            {initials}
          </Text>
        </View>
      )}
      {showUnreadDot ? (
        <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-pill border-2 border-bg bg-accent" />
      ) : null}
    </View>
  );
}
