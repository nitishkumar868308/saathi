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
        pressed && (onPress || onLongPress) && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: s.bg }]}>
        <Ionicons name={iconForType(doc.type) as any} size={20} color={s.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {doc.name}
        </Text>
        <Text style={styles.exp}>{label}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: s.bg }]}>
        <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
      </View>
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
