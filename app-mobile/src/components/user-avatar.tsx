import { View, Text, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import type { Colors } from "@/theme/colors";

/**
 * User ka avatar.
 *  - Photo hai to wahi (center + cover — cut/blank nahi).
 *  - Nahi hai to naam ke initials ek warm brand-color circle par.
 *  - Naam bhi na ho to ek friendly person icon.
 *
 * Yeh app ka default avatar hai — logo ki jagah user ka apna chehra/initials.
 */

/**
 * Avatar ke rang.
 *
 * Function isliye (const array nahi): do rang theme se aate hain, aur module
 * level par theme abhi pata hi nahi hoti.
 *
 * Baaki chaar rang dono theme me ek jaise hain — ye avatar ka apna palette hai,
 * app ka theme nahi. Ek hi insaan ka avatar theme badalne par rang badal de to
 * wo pehchan hi kho deta hai, aur avatar ka poora kaam hi pehchan hai.
 */
const paletteFor = (tc: Colors): string[] => [
  tc.terracotta,
  tc.sage,
  "#5B7B9A",
  "#8A6BA8",
  tc.amber,
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

function colorFor(seed: string | undefined, tc: Colors): string {
  const s = (seed || "saathi").trim() || "saathi";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = paletteFor(tc);
  return palette[h % palette.length];
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
  const tc = useColors();
  const styles = useStyles();
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
  const bg = colorFor(seed || name, tc);

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
        <Ionicons name="person" size={Math.round(size * 0.5)} color={tc.white} />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  fallback: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  text: { color: c.white, fontWeight: "800", letterSpacing: 0.5 },
}));

export default UserAvatar;
