import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Document } from "@/lib/documents";
import { expiryStatus, expiryLabel } from "@/utils/expiry";
import { statusStyleFor, neutralStyleFor, iconForType } from "@/theme/status";
import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";

export function DocCard({
  doc,
  onPress,
  onLongPress,
  onDelete,
  selectMode = false,
  selected = false,
}: {
  doc: Document;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Card par saaf-saaf delete icon — long-press ke bina. */
  onDelete?: () => void;
  /** Multi-select mode on hai — checkbox dikhega. */
  selectMode?: boolean;
  selected?: boolean;
}) {
  const tc = useColors();
  const styles = useStyles();
  const { documents: d, common: c } = useT();
  const locked = doc.is_locked;
  const hasExpiry = !!doc.expiry;
  const s = hasExpiry ? statusStyleFor(tc)[expiryStatus(doc.expiry as string)] : neutralStyleFor(tc);
  const label = hasExpiry
    ? expiryLabel(doc.expiry as string, {
        expired: d.expiryExpired,
        today: d.expiryTodayLabel,
        tomorrow: d.expiryTomorrowLabel,
        inDays: d.expiryInDaysLabel,
      })
    : d.expiryNotSet;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.card,
        locked && styles.lockedCard,
        selected && styles.selectedCard,
        pressed && (onPress || onLongPress) && styles.pressed,
      ]}
    >
      {selectMode && (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected && <Ionicons name="checkmark" size={14} color={tc.white} />}
        </View>
      )}
      <View style={[styles.icon, { backgroundColor: locked ? tc.creamDeep : s.bg }]}>
        <Ionicons
          name={(locked ? "lock-closed" : iconForType(doc.type)) as any}
          size={20}
          color={locked ? tc.inkSoft : s.fg}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, locked && styles.lockedText]} numberOfLines={1}>
          {doc.name}
        </Text>
        <Text style={styles.exp}>{locked ? d.lockedSub : label}</Text>
      </View>
      {locked ? (
        <View style={styles.lockBadge}>
          <Ionicons name="star" size={11} color={tc.white} />
          <Text style={styles.lockBadgeText}>{c.plusBadge}</Text>
        </View>
      ) : selectMode ? (
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
        </View>
      ) : (
        <View style={styles.right}>
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={onPress}
              hitSlop={8}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
            >
              <Ionicons name="eye-outline" size={18} color={tc.inkSoft} />
            </Pressable>
            <Pressable
              onPress={onDelete}
              hitSlop={8}
              style={({ pressed }) => [styles.iconBtn, styles.iconDanger, pressed && styles.iconPressed]}
            >
              <Ionicons name="trash-outline" size={17} color={tc.danger} />
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 14,
  },
  lockedCard: { backgroundColor: c.cream, borderStyle: "dashed" },
  selectedCard: { borderColor: c.terracotta, backgroundColor: "rgba(194,90,55,0.06)" },
  check: {
    height: 22,
    width: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: c.terracotta, borderColor: c.terracotta },
  lockedText: { color: c.inkSoft },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: c.terracotta,
  },
  lockBadgeText: { fontSize: 11.5, fontWeight: "800", color: c.white },
  pressed: { opacity: 0.7 },
  icon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  name: { fontSize: 15.5, fontWeight: "600", color: c.ink },
  exp: { marginTop: 2, fontSize: 13, color: c.inkSoft },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  right: { alignItems: "flex-end", gap: 8 },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
  },
  iconDanger: { borderColor: "rgba(178,59,59,0.25)", backgroundColor: "rgba(178,59,59,0.06)" },
  iconPressed: { opacity: 0.6 },
}));
