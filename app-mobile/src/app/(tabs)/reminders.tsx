import { useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useRouter, useFocusEffect } from "expo-router";

import { colors } from "@/theme/colors";
import { SkeletonList } from "@/components/loader";
import { reportError } from "@/lib/report-error";
import { timed } from "@/lib/network";
import {
  listReminders,
  setReminderOn,
  deleteReminder,
  type Reminder,
} from "@/lib/reminders";
import { scheduleReminder, cancelReminder } from "@/lib/notifications";
import { formatWhen } from "@/utils/parse-time";
import { Pagination, usePaged } from "@/components/pagination";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { useToast } from "@/components/toast";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";

export default function Reminders() {
  const router = useRouter();
  const toast = useToast();
  const { reminders: r0, common: c } = useT();
  const { locale } = useLocale();
  const words = { today: c.today, tomorrow: c.tomorrow };
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setItems(await timed(listReminders()));
    } catch (e) {
      reportError(e, { screen: "reminders", action: "load" });
      toast.show(r0.title + " ✕", "error");
    } finally {
      setLoading(false);
    }
  }, [toast, r0.title]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function toggle(r: Reminder) {
    const next = !r.is_on;
    setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_on: next } : x)));
    try {
      await setReminderOn(r.id, next);
      if (next && r.remind_at) {
        await scheduleReminder(r.id, r.title, new Date(r.remind_at));
      } else {
        await cancelReminder(r.id);
      }
    } catch {
      toast.show(r0.title + " ✕", "error");
      load();
    }
  }

  function confirmDelete(r: Reminder) {
    Alert.alert(r0.deleteConfirmTitle, tpl(r0.deleteConfirmBody, { title: r.title }), [
      { text: c.no, style: "cancel" },
      {
        text: c.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReminder(r.id);
            await cancelReminder(r.id);
            setItems((prev) => prev.filter((x) => x.id !== r.id));
            toast.show(c.delete + " ✓", "success");
          } catch {
            toast.show(c.delete + " ✕", "error");
          }
        },
      },
    ]);
  }

  const today = items.filter((r) => r.bucket === "today");
  const upcoming = items.filter((r) => r.bucket !== "today");

  // Upcoming list lambi ho sakti hai — 10 per page. (Today hamesha poora dikhta.)
  const up = usePaged(upcoming, 10);

  // Card pe time hamesha current bhasha me — stored label ki jagah remind_at se.
  const timeOf = (r: Reminder): string | null =>
    r.remind_at ? formatWhen(new Date(r.remind_at), words, locale) : r.time_label ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>{r0.title}</Text>
        <Text style={styles.sub}>{r0.sub}</Text>
      </View>

      <UpgradeBanner compact />

      {loading ? (
        <View style={{ padding: 20 }}>
          <SkeletonList count={4} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="alarm-outline" size={28} color={colors.terracotta} />
          </View>
          <Text style={styles.emptyTitle}>{r0.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{r0.emptyBody}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Section title={r0.today} items={today} onToggle={toggle} onDelete={confirmDelete} pausedTag={r0.pausedTag} timeOf={timeOf} />
          <Section title={r0.upcoming} items={up.pageItems} onToggle={toggle} onDelete={confirmDelete} pausedTag={r0.pausedTag} timeOf={timeOf} />
          <Pagination page={up.page} pageCount={up.pageCount} onPage={up.setPage} />
          <Text style={styles.hint}>{r0.longPressHint}</Text>
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.push("/add-reminder")}
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="add" size={20} color={colors.white} />
        <Text style={styles.addText}>{r0.title}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Section({
  title,
  items,
  onToggle,
  onDelete,
  pausedTag,
  timeOf,
}: {
  title: string;
  items: Reminder[];
  onToggle: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
  pausedTag: string;
  timeOf: (r: Reminder) => string | null;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {items.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={r.is_paused ? () => router.push("/upgrade" as never) : undefined}
            onLongPress={() => onDelete(r)}
            delayLongPress={350}
            style={[styles.row, i < items.length - 1 && styles.rowBorder]}
          >
            <View style={[styles.rIcon, { opacity: r.is_on && !r.is_paused ? 1 : 0.4 }]}>
              <Ionicons
                name={r.is_paused ? "lock-closed" : "notifications"}
                size={17}
                color={colors.terracotta}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.rTitle, (!r.is_on || r.is_paused) && styles.off]}
                numberOfLines={2}
              >
                {r.title}
              </Text>
              {r.is_paused ? (
                <Text style={styles.pausedTag}>{pausedTag}</Text>
              ) : timeOf(r) ? (
                <Text style={styles.rTime}>{timeOf(r)}</Text>
              ) : null}
            </View>
            {r.is_paused ? (
              <View style={styles.pausedPill}>
                <Ionicons name="star" size={11} color={colors.white} />
                <Text style={styles.pausedPillText}>Plus</Text>
              </View>
            ) : (
              <Switch
                value={r.is_on}
                onValueChange={() => onToggle(r)}
                trackColor={{ false: colors.line, true: colors.terracotta }}
                thumbColor={colors.white}
              />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  headerWrap: { paddingHorizontal: 20, paddingTop: 16, ...CONTENT },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink },
  sub: { marginTop: 4, fontSize: 14, color: colors.inkSoft },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyIcon: {
    height: 64,
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(194,90,55,0.10)",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: colors.ink },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 280,
  },
  content: { padding: 20, paddingBottom: 100, ...CONTENT },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  rTitle: { fontSize: 15.5, fontWeight: "600", color: colors.ink },
  off: { textDecorationLine: "line-through", color: colors.inkSoft },
  rTime: { marginTop: 2, fontSize: 13, color: colors.inkSoft },
  pausedTag: { marginTop: 2, fontSize: 12, fontWeight: "600", color: colors.terracotta },
  pausedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.terracotta,
  },
  pausedPillText: { fontSize: 11.5, fontWeight: "800", color: colors.white },
  hint: {
    textAlign: "center",
    fontSize: 12,
    color: colors.inkSoft,
    opacity: 0.7,
  },
  addBtn: {
    position: "absolute",
    right: 20,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
    shadowColor: colors.terracotta,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  addText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
