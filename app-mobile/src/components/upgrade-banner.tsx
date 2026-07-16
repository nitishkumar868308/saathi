import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { colors } from "@/theme/colors";
import { usePlan } from "@/lib/use-plan";

/**
 * Chhota "Plus lo" banner — har free-user screen pe dikhta hai (spec item 2, 11).
 * Plus user ho to kuch render nahi hota. Loading me bhi nahi, warna flicker.
 */
export function UpgradeBanner({
  compact = false,
  flush = false,
}: {
  compact?: boolean;
  /** Container me pehle se horizontal padding ho to true — side margin hata deta hai. */
  flush?: boolean;
}) {
  const { isPlus, loading } = usePlan();
  if (loading || isPlus) return null;

  return (
    <Pressable
      onPress={() => router.push("/upgrade" as never)}
      style={({ pressed }) => [
        styles.wrap,
        compact && styles.compact,
        flush && styles.flush,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="star" size={16} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Saathi Plus lo</Text>
        {!compact && (
          <Text style={styles.sub}>Unlimited reminders, documents & AI</Text>
        )}
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>Upgrade</Text>
        <Ionicons name="arrow-forward" size={13} color={colors.white} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(194,90,55,0.08)",
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.22)",
  },
  compact: { marginTop: 10, paddingVertical: 10 },
  flush: { marginHorizontal: 0 },
  iconWrap: {
    height: 34,
    width: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.terracotta,
  },
  title: { fontSize: 14.5, fontWeight: "800", color: colors.ink },
  sub: { marginTop: 1, fontSize: 12.5, color: colors.inkSoft },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.terracotta,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ctaText: { fontSize: 12.5, fontWeight: "800", color: colors.white },
});
