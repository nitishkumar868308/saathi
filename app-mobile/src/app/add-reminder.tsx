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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";

import { colors } from "@/theme/colors";
import { addReminder, ReminderLimitError } from "@/lib/reminders";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { ensureNotifPermission, scheduleReminder } from "@/lib/notifications";
import { parseReminderTime, reminderNeeds, formatWhen } from "@/utils/parse-time";
import { aiParseReminder } from "@/lib/ai";
import { VoiceButton } from "@/components/voice-button";
import { useToast } from "@/components/toast";

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
  const { addReminder: a, common: c } = useT();
  const { locale } = useLocale();
  const words = { today: c.today, tomorrow: c.tomorrow };
  const fmt = (d: Date) => formatWhen(d, words, locale);
  const [title, setTitle] = useState("");
  // Jab parser subject na samajh paaye, user yahan alag se batata hai.
  const [subject, setSubject] = useState("");
  const [askSubject, setAskSubject] = useState(false);
  const [picked, setPicked] = useState<Date | null>(null);
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [understanding, setUnderstanding] = useState(false);

  const parsed = useMemo(() => parseReminderTime(title), [title]);
  const needs = reminderNeeds(parsed);

  // Effective time: user ne khud chuna ho to wahi, warna text se samjha hua.
  const when = picked ?? parsed?.date ?? null;
  // Effective subject: clarify-box > parser ka nikala hua.
  const finalSubject = subject.trim() || parsed?.title?.trim() || "";
  // Kya-kya abhi bhi missing hai (AI se try karne ke baad screen isse poochti).
  const missingTitle = !finalSubject;
  const missingTime = !when;

  function openPicker() {
    const base =
      when ?? new Date(Date.now() + 60 * 60 * 1000); // default: 1 ghanta baad
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: base,
        mode: "date",
        minimumDate: new Date(),
        onChange: (_e, d) => {
          if (!d) return;
          DateTimePickerAndroid.open({
            value: d,
            mode: "time",
            is24Hour: false,
            onChange: (_e2, t) => {
              if (!t) return;
              const combined = new Date(d);
              combined.setHours(t.getHours(), t.getMinutes(), 0, 0);
              setPicked(combined);
            },
          });
        },
      });
    } else {
      setShowIosPicker(true);
    }
  }

  async function save() {
    if (saving || understanding) return;
    const raw = title.trim();
    if (!raw && !subject.trim()) return toast.show(a.whatLabel, "info");

    // 1. Local parser jo samajh paaya.
    let subj = finalSubject;
    let time = when;

    // 2. Kuch adhoora? Ek baar AI se samajhne ki koshish (best-effort, online+key).
    if ((!subj || !time) && raw) {
      setUnderstanding(true);
      const ai = await aiParseReminder(raw, locale);
      setUnderstanding(false);
      if (ai) {
        if (!subj && ai.title) {
          subj = ai.title;
          setSubject(ai.title);
        }
        if (!time && ai.remind_at) {
          const d = new Date(ai.remind_at);
          if (!isNaN(d.getTime())) {
            time = d;
            setPicked(d);
          }
        }
      }
    }

    // 3. Ab bhi samajh na aaye to user se wapas poochho (title pehle, phir time).
    if (!subj) {
      setAskSubject(true);
      toast.show(a.askWhat, "info");
      return;
    }
    if (!time) {
      toast.show(a.askTime, "info");
      openPicker();
      return;
    }

    // Label hamesha locale-aware formatter se — parser ka Hinglish label display
    // ke liye use nahi karte (bhasha follow karni hai).
    const finalLabel = fmt(time);

    try {
      setSaving(true);
      const bucket = isSameDay(time, new Date()) ? "today" : "upcoming";
      const r = await addReminder({
        title: subj,
        time_label: finalLabel,
        remind_at: time.toISOString(),
        bucket,
      });
      const allowed = await ensureNotifPermission();
      // scheduleReminder guzre hue waqt ya OS error pe false deta hai — pehle
      // toast phir bhi "Reminder set ✓" bolta tha, jo jhooth tha.
      const scheduled = allowed && (await scheduleReminder(r.id, r.title, time));
      toast.show(
        scheduled ? a.setOk : allowed ? a.savedNoNotif : a.savedNeedPerm,
        scheduled ? "success" : "info",
      );
      router.back();
    } catch (e) {
      if (e instanceof ReminderLimitError) {
        toast.show(a.limitReached, "info");
        router.replace("/upgrade" as never);
      } else {
        toast.show(a.title + " ✕", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{a.title}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>{a.whatLabel}</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={a.whatPlaceholder}
              placeholderTextColor={colors.inkSoft}
              style={styles.input}
              multiline
            />
            <VoiceButton onText={(txt) => setTitle((p) => (p ? p + " " + txt : txt))} />
          </View>
          <Text style={styles.hint}>🎤 {a.micHint}</Text>

          {/* Saathi kya samajh raha hai — AI se poochte waqt */}
          {understanding && (
            <View style={styles.thinking}>
              <ActivityIndicator size="small" color={colors.terracotta} />
              <Text style={styles.thinkingText}>{a.understanding}</Text>
            </View>
          )}

          {/* Auto-detected: subject + time (text se) */}
          {parsed?.date && !picked && !understanding && (
            <View style={[styles.detected, styles.detectedActive]}>
              <Ionicons name="sparkles" size={18} color={colors.white} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.detLabel, { color: "rgba(255,255,255,0.8)" }]}>
                  {a.understood} ✨
                </Text>
                {finalSubject ? (
                  <Text style={[styles.detSubject, { color: colors.white }]}>
                    {finalSubject}
                  </Text>
                ) : null}
                <Text style={[styles.detTime, { color: "rgba(255,255,255,0.9)" }]}>
                  {fmt(parsed.date)}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
            </View>
          )}

          {/* Subject samajh nahi aaya — user se poochho (text + voice) */}
          {!understanding && missingTitle && (title.trim().length > 0 || askSubject) && (
            <View style={styles.clarify}>
              <Text style={styles.clarifyQ}>🤔 {a.askWhat}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={subject}
                  onChangeText={setSubject}
                  placeholder={a.askWhatPlaceholder}
                  placeholderTextColor={colors.inkSoft}
                  style={styles.input}
                  autoFocus={askSubject}
                  multiline
                />
                <VoiceButton
                  onText={(txt) => setSubject((p) => (p ? p + " " + txt : txt))}
                />
              </View>
            </View>
          )}

          {/* Kab? — time na mile to yahan se chuno */}
          <Text style={styles.label}>{a.whenLabel}</Text>

          {when ? (
            <View style={styles.whenRow}>
              <View style={styles.whenChip}>
                <Ionicons name="alarm" size={18} color={colors.terracotta} />
                <Text style={styles.whenText}>{fmt(when)}</Text>
              </View>
              <Pressable onPress={openPicker} style={styles.changeBtn}>
                <Ionicons name="create-outline" size={16} color={colors.terracotta} />
                <Text style={styles.changeText}>{a.change}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={openPicker} style={styles.pickBtn}>
              <Ionicons name="calendar-outline" size={18} color={colors.white} />
              <Text style={styles.pickText}>{a.pickDateTime}</Text>
            </Pressable>
          )}

          {!when && <Text style={styles.hint}>{a.noTimeHint}</Text>}

          {/* iOS inline picker */}
          {showIosPicker && Platform.OS === "ios" && (
            <View style={styles.iosPicker}>
              <DateTimePicker
                value={when ?? new Date(Date.now() + 60 * 60 * 1000)}
                mode="datetime"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_e, d) => {
                  if (d) setPicked(d);
                }}
              />
              <Pressable
                onPress={() => setShowIosPicker(false)}
                style={styles.iosDone}
              >
                <Text style={styles.iosDoneText}>{c.done}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Pressable
        onPress={save}
        disabled={saving || understanding}
        style={({ pressed }) => [
          styles.save,
          (pressed || saving || understanding) && { opacity: 0.85 },
        ]}
      >
        {saving || understanding ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveText}>{a.save}</Text>
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
    padding: 14,
  },
  detectedActive: { backgroundColor: colors.terracotta },
  detLabel: { fontSize: 12, fontWeight: "600", color: colors.inkSoft },
  detSubject: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 2 },
  detTime: { fontSize: 14, fontWeight: "600", color: colors.ink, marginTop: 1 },
  thinking: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  thinkingText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  clarify: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: "rgba(224,168,86,0.10)",
    padding: 14,
    gap: 10,
  },
  clarifyQ: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  whenRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  whenChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.sage,
    backgroundColor: "rgba(124,138,107,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  whenText: { fontSize: 16, fontWeight: "700", color: colors.ink },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.terracotta,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  changeText: { fontSize: 14, fontWeight: "700", color: colors.terracotta },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.terracotta,
    paddingVertical: 15,
  },
  pickText: { fontSize: 15, fontWeight: "700", color: colors.white },
  iosPicker: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 8,
  },
  iosDone: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  iosDoneText: { fontSize: 15, fontWeight: "700", color: colors.terracotta },
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
