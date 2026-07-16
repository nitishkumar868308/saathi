import { useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { colors } from "@/theme/colors";
import {
  listReminders,
  setReminderOn,
  deleteReminder,
  type Reminder,
} from "@/lib/reminders";
import { scheduleReminder, cancelReminder } from "@/lib/notifications";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { useToast } from "@/components/toast";

export default function Reminders() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setItems(await listReminders());
    } catch {
      toast.show("Reminders load nahi hue", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      toast.show("Update nahi hua", "error");
      load();
    }
  }

  function confirmDelete(r: Reminder) {
    Alert.alert("Delete karein?", `"${r.title}" hata denge?`, [
      { text: "Nahi", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReminder(r.id);
            await cancelReminder(r.id);
            setItems((prev) => prev.filter((x) => x.id !== r.id));
            toast.show("Reminder delete ho gaya", "success");
          } catch {
            toast.show("Delete nahi hua", "error");
          }
        },
      },
    ]);
  }

  const today = items.filter((r) => r.bucket === "today");
  const upcoming = items.filter((r) => r.bucket !== "today");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Reminders</Text>
        <Text style={styles.sub}>Saathi sahi time pe yaad dilayega</Text>
      </View>

      <UpgradeBanner compact />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.terracotta} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="alarm-outline" size={28} color={colors.terracotta} />
          </View>
          <Text style={styles.emptyTitle}>Abhi koi reminder nahi</Text>
          <Text style={styles.emptyBody}>
            Neeche + dabake naya reminder banao — bol ke ya type karke.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Section title="Aaj" items={today} onToggle={toggle} onDelete={confirmDelete} />
          <Section title="Aane wale" items={upcoming} onToggle={toggle} onDelete={confirmDelete} />
          <Text style={styles.hint}>Delete karne ke liye card ko dabaye rakho</Text>
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.push("/add-reminder")}
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="add" size={20} color={colors.white} />
        <Text style={styles.addText}>Naya reminder</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Section({
  title,
  items,
  onToggle,
  onDelete,
}: {
  title: string;
  items: Reminder[];
  onToggle: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {items.map((r, i) => (
          <Pressable
            key={r.id}
            onLongPress={() => onDelete(r)}
            delayLongPress={350}
            style={[styles.row, i < items.length - 1 && styles.rowBorder]}
          >
            <View style={[styles.rIcon, { opacity: r.is_on ? 1 : 0.4 }]}>
              <Ionicons name="notifications" size={17} color={colors.terracotta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rTitle, !r.is_on && styles.off]} numberOfLines={2}>
                {r.title}
              </Text>
              {r.time_label ? <Text style={styles.rTime}>{r.time_label}</Text> : null}
            </View>
            <Switch
              value={r.is_on}
              onValueChange={() => onToggle(r)}
              trackColor={{ false: colors.line, true: colors.terracotta }}
              thumbColor={colors.white}
            />
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
