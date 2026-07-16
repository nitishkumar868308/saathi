import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Document } from "@/lib/documents";
import { expiryStatus, expiryLabel } from "@/utils/expiry";
import { statusStyle, neutralStyle, iconForType } from "@/theme/status";
import { colors } from "@/theme/colors";

export function DocCard({
  doc,
  onPress,
  onLongPress,
}: {
  doc: Document;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const locked = doc.is_locked;
  const hasExpiry = !!doc.expiry;
  const s = hasExpiry ? statusStyle[expiryStatus(doc.expiry as string)] : neutralStyle;
  const label = hasExpiry ? expiryLabel(doc.expiry as string) : "Expiry set nahi";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.card,
        locked && styles.lockedCard,
        pressed && (onPress || onLongPress) && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: locked ? colors.creamDeep : s.bg }]}>
        <Ionicons
          name={(locked ? "lock-closed" : iconForType(doc.type)) as any}
          size={20}
          color={locked ? colors.inkSoft : s.fg}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, locked && styles.lockedText]} numberOfLines={1}>
          {doc.name}
        </Text>
        <Text style={styles.exp}>{locked ? "Plus lo — dekhne ke liye" : label}</Text>
      </View>
      {locked ? (
        <View style={styles.lockBadge}>
          <Ionicons name="star" size={11} color={colors.white} />
          <Text style={styles.lockBadgeText}>Plus</Text>
        </View>
      ) : (
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
  },
  lockedCard: { backgroundColor: colors.cream, borderStyle: "dashed" },
  lockedText: { color: colors.inkSoft },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.terracotta,
  },
  lockBadgeText: { fontSize: 11.5, fontWeight: "800", color: colors.white },
  pressed: { opacity: 0.7 },
  icon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  name: { fontSize: 15.5, fontWeight: "600", color: colors.ink },
  exp: { marginTop: 2, fontSize: 13, color: colors.inkSoft },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: "700" },
});
