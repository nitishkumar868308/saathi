import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors } from "@/theme/colors";
import { addReminder } from "@/lib/reminders";
import { ensureNotifPermission, scheduleReminder } from "@/lib/notifications";
import { parseReminderTime } from "@/utils/parse-time";
import { VoiceButton } from "@/components/voice-button";
import { useToast } from "@/components/toast";

type Opt = { key: string; label: string; make: () => Date };

const options: Opt[] = [
  { key: "1h", label: "1 ghante baad", make: () => new Date(Date.now() + 60 * 60 * 1000) },
  { key: "3h", label: "3 ghante baad", make: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
  { key: "tonight", label: "Aaj raat 9 baje", make: () => atTime(0, 21) },
  { key: "tmrw_morning", label: "Kal subah 8 baje", make: () => atTime(1, 8) },
  { key: "tmrw_evening", label: "Kal shaam 6 baje", make: () => atTime(1, 18) },
  { key: "week", label: "1 hafte baad", make: () => atTime(7, 9) },
];

function atTime(addDays: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function AddReminder() {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [chip, setChip] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseReminderTime(title), [title]);
  const usingParsed = chip === null && parsed !== null;

  async function save() {
    if (saving) return;
    const rawTitle = title.trim();
    if (!rawTitle) return toast.show("Kya yaad dilana hai?", "info");

    const chipOpt = chip ? options.find((o) => o.key === chip) : null;
    const when = chipOpt ? chipOpt.make() : parsed?.date ?? null;
    if (!when) return toast.show("Kab yaad dilaun? Bolo ya chuno.", "info");

    const finalTitle = chipOpt ? rawTitle : parsed?.title || rawTitle;
    const finalLabel = chipOpt ? chipOpt.label : parsed?.label ?? null;

    try {
      setSaving(true);
      const bucket = isSameDay(when, new Date()) ? "today" : "upcoming";
      const r = await addReminder({
        title: finalTitle,
        time_label: finalLabel,
        remind_at: when.toISOString(),
        bucket,
      });
      const allowed = await ensureNotifPermission();
      if (allowed) await scheduleReminder(r.id, r.title, when);
      toast.show(
        allowed ? "Reminder set ✓ Time pe yaad dila dunga" : "Saved (notification permission do)",
        "success",
      );
      router.back();
    } catch {
      toast.show("Save nahi hua", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Naya reminder</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Kya yaad dilaun?</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Jaise: 1 minute baad mummy ko call karna"
              placeholderTextColor={colors.inkSoft}
              style={styles.input}
              multiline
            />
            <VoiceButton onText={(t) => setTitle((p) => (p ? p + " " + t : t))} />
          </View>
          <Text style={styles.hint}>🎤 Mic dabake bolo — time bhi bol do, main samajh lunga</Text>

          {/* auto-detected time */}
          {parsed && (
            <Pressable
              onPress={() => setChip(null)}
              style={[styles.detected, usingParsed && styles.detectedActive]}
            >
              <Ionicons
                name="sparkles"
                size={18}
                color={usingParsed ? colors.white : colors.terracotta}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.detLabel, usingParsed && { color: "rgba(255,255,255,0.8)" }]}>
                  Samajh gaya ✨
                </Text>
                <Text style={[styles.detTime, usingParsed && { color: colors.white }]}>
                  {parsed.label}
                </Text>
              </View>
              {usingParsed && <Ionicons name="checkmark-circle" size={20} color={colors.white} />}
            </Pressable>
          )}

          <Text style={styles.label}>{parsed ? "Ya time chuno" : "Kab?"}</Text>
          <View style={styles.optGrid}>
            {options.map((o) => {
              const active = chip === o.key;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => setChip(o.key)}
                  style={[styles.opt, active && styles.optActive]}
                >
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={active ? colors.white : colors.terracotta}
                  />
                  <Text style={[styles.optText, active && { color: colors.white }]}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Pressable
        onPress={save}
        disabled={saving}
        style={({ pressed }) => [styles.save, (pressed || saving) && { opacity: 0.85 }]}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveText}>Reminder set karo</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    ...CONTENT,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  close: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  content: { padding: 20, ...CONTENT },
  label: {
    marginTop: 18,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 15,
  },
  hint: { marginTop: 8, fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  detected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.terracotta,
    backgroundColor: "rgba(194,90,55,0.08)",
    padding: 14,
  },
  detectedActive: { backgroundColor: colors.terracotta },
  detLabel: { fontSize: 12, fontWeight: "600", color: colors.inkSoft },
  detTime: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 1 },
  optGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  optText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  save: {
    margin: 20,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
    ...CONTENT,
  },
  saveText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
