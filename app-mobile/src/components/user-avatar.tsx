import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";

/**
 * User ka avatar.
 *  - Photo hai to wahi (center + cover — cut/blank nahi).
 *  - Nahi hai to naam ke initials ek warm brand-color circle par.
 *  - Naam bhi na ho to ek friendly person icon.
 *
 * Yeh app ka default avatar hai — logo ki jagah user ka apna chehra/initials.
 */

const PALETTE = [
  colors.terracotta,
  colors.sage,
  "#5B7B9A",
  "#8A6BA8",
  colors.amber,
  "#4C8577",
];

function initialsOf(name?: string): string {
  const n = (name || "").trim();
  if (!n) return "";
  const parts = n.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function colorFor(seed?: string): string {
  const s = (seed || "saathi").trim() || "saathi";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function UserAvatar({
  uri,
  name,
  seed,
  size = 46,
  radius,
}: {
  uri?: string | null;
  name?: string;
  /** Rang chunne ke liye stable seed (jaise user id). Na do to naam se banega. */
  seed?: string;
  size?: number;
  radius?: number;
}) {
  const r = radius ?? Math.round(size * 0.34);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: r }}
        resizeMode="cover"
      />
    );
  }

  const label = initialsOf(name);
  const bg = colorFor(seed || name);

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: r, backgroundColor: bg },
      ]}
    >
      {label ? (
        <Text style={[styles.text, { fontSize: Math.round(size * 0.4) }]}>{label}</Text>
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.5)} color={colors.white} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  text: { color: colors.white, fontWeight: "800", letterSpacing: 0.5 },
});

export default UserAvatar;
