import { useState, useEffect, useRef } from "react";
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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";

import { colors } from "@/theme/colors";
import { addReminder, ReminderLimitError } from "@/lib/reminders";
import { checkReferralQualification } from "@/lib/plan";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { ensureNotifPermission, scheduleReminder } from "@/lib/notifications";
import { formatWhen, combine } from "@/utils/parse-time";
import { parseReminderAI } from "@/lib/ai";
import {
  openBatteryOptimizationSettings,
  batteryPromptShown,
  markBatteryPromptShown,
} from "@/lib/reliability";
import { VoiceButton } from "@/components/voice-button";
import { useToast } from "@/components/toast";

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Aaj se `offset` din ka midnight Date. */
function midnight(offset = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

export default function AddReminder() {
  const router = useRouter();
  const toast = useToast();
  const { addReminder: a, common: c, reliability: rel } = useT();
  const { locale } = useLocale();
  const bcp = locale === "hi" ? "hi-IN" : "en-IN";

  const [title, setTitle] = useState("");
  // Jab parser subject na samajh paaye, user yahan alag se batata hai.
  const [subject, setSubject] = useState("");
  // Din/time user ne khud chuna ho to ye override karte hain.
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [pickedMinutes, setPickedMinutes] = useState<number | null>(null);
  const [iosDate, setIosDate] = useState(false);
  const [iosTime, setIosTime] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI se samjha hua reminder. Ek reminder = ek AI call — user typing rukne ke
  // 800ms baad ek hi baar hit hota hai (same text dobara hit nahi hota).
  const [ai, setAi] = useState<{
    title: string;
    date: Date | null;
    minutes: number | null;
  } | null>(null);
  const [parsing, setParsing] = useState(false);
  const lastText = useRef("");

  useEffect(() => {
    const t = title.trim();
    if (t.length < 3) return;
    const handle = setTimeout(async () => {
      if (lastText.current === t) return; // same text — dobara AI hit nahi
      lastText.current = t;
      setParsing(true);
      try {
        const r = await parseReminderAI(t, locale);
        if (r) {
          let date: Date | null = null;
          let minutes: number | null = null;
          if (r.remind_at) {
            const d = new Date(r.remind_at);
            if (!isNaN(d.getTime())) {
              date = new Date(d);
              date.setHours(0, 0, 0, 0);
              if (!r.needsTime) minutes = d.getHours() * 60 + d.getMinutes();
            }
          }
          setAi({ title: r.title || t, date, minutes });
        }
      } finally {
        setParsing(false);
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [title, locale]);

  // Effective slots: user ka override > AI ka samjha hua.
  const finalTitle = subject.trim() || ai?.title?.trim() || "";
  const finalDate = pickedDate ?? ai?.date ?? null;
  const finalMinutes = pickedMinutes ?? ai?.minutes ?? null;
  const when =
    finalDate && finalMinutes != null ? combine(finalDate, finalMinutes) : null;
  const isPast = !!when && when.getTime() <= Date.now();

  const missingTitle = !finalTitle;
  const missingDate = !finalDate;
  const missingTime = finalMinutes == null;
  const canSave = !!finalTitle && !!when && !isPast;

  const words = { today: c.today, tomorrow: c.tomorrow };
  const dayLabel = (d: Date) => {
    if (isSameDay(d, midnight(0))) return c.today;
    if (isSameDay(d, midnight(1))) return c.tomorrow;
    if (isSameDay(d, midnight(2))) return a.dayAfter;
    return d.toLocaleDateString(bcp, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };
  const timeLabel = (mins: number) => {
    const d = new Date();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d.toLocaleTimeString(bcp, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  function openDatePicker() {
    const base = finalDate ?? midnight(0);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: base,
        mode: "date",
        minimumDate: midnight(0),
        onChange: (_e, d) => {
          if (d) {
            const m = new Date(d);
            m.setHours(0, 0, 0, 0);
            setPickedDate(m);
          }
        },
      });
    } else {
      setIosDate(true);
    }
  }

  function openTimePicker() {
    const base = new Date();
    if (finalMinutes != null)
      base.setHours(Math.floor(finalMinutes / 60), finalMinutes % 60, 0, 0);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: base,
        mode: "time",
        is24Hour: false,
        onChange: (_e, d) => {
          if (d) setPickedMinutes(d.getHours() * 60 + d.getMinutes());
        },
      });
    } else {
      setIosTime(true);
    }
  }

  async function save() {
    if (saving) return;
    if (!title.trim() && !subject.trim()) return toast.show(a.whatLabel, "info");
    if (!finalTitle) return toast.show(a.askWhat, "info");
    if (!finalDate) return toast.show(a.askDay, "info");
    if (finalMinutes == null) {
      toast.show(a.pickTime, "info");
      openTimePicker();
      return;
    }
    if (!when || when.getTime() <= Date.now()) {
      toast.show(a.pastError, "error");
      openTimePicker();
      return;
    }

    // Label hamesha locale-aware formatter se (parser ka label nahi).
    const finalLabel = formatWhen(when, words, locale);
    try {
      setSaving(true);
      const bucket = isSameDay(when, new Date()) ? "today" : "upcoming";
      const r = await addReminder({
        title: finalTitle,
        time_label: finalLabel,
        remind_at: when.toISOString(),
        bucket,
      });
      // Referral reward: document + reminder dono hone pe unlock (server verify).
      checkReferralQualification().catch(() => {});
      const allowed = await ensureNotifPermission();
      const scheduled = allowed && (await scheduleReminder(r.id, r.title, when));
      toast.show(
        scheduled ? a.setOk : allowed ? a.savedNoNotif : a.savedNeedPerm,
        scheduled ? "success" : "info",
      );
      // Pehli baar reminder set hone pe battery-optimization ka ek-time prompt.
      if (scheduled && Platform.OS === "android" && !(await batteryPromptShown())) {
        await markBatteryPromptShown();
        Alert.alert(rel.promptTitle, rel.promptBody, [
          { text: rel.promptLater, style: "cancel", onPress: () => router.back() },
          {
            text: rel.promptButton,
            onPress: () => {
              openBatteryOptimizationSettings();
              router.back();
            },
          },
        ]);
        return;
      }
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

  const started = title.trim().length > 0 || subject.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{a.title}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ek hi jagah bolo/likho — Saathi samajh lega */}
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

          {parsing && (
            <View style={styles.parsingRow}>
              <ActivityIndicator color={colors.terracotta} size="small" />
              <Text style={styles.parsingText}>{a.understanding}</Text>
            </View>
          )}

          {started && (
            <View style={styles.card}>
              {/* --- Kya (title) --- */}
              <View style={styles.slot}>
                <View style={styles.slotIcon}>
                  <Ionicons name="create-outline" size={17} color={colors.terracotta} />
                </View>
                {finalTitle ? (
                  <Text style={styles.slotValue} numberOfLines={2}>
                    {finalTitle}
                  </Text>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotAsk}>{a.askWhat}</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        value={subject}
                        onChangeText={setSubject}
                        placeholder={a.askWhatPlaceholder}
                        placeholderTextColor={colors.inkSoft}
                        style={styles.subInput}
                        autoFocus
                      />
                      <VoiceButton
                        onText={(txt) => setSubject((p) => (p ? p + " " + txt : txt))}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* --- Kis din (date) --- */}
              <View style={styles.slot}>
                <View style={styles.slotIcon}>
                  <Ionicons name="calendar-outline" size={17} color={colors.terracotta} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={missingDate ? styles.slotAsk : styles.slotValue}>
                    {missingDate ? a.askDay : dayLabel(finalDate!)}
                  </Text>
                  <View style={styles.chips}>
                    {[
                      { label: c.today, d: midnight(0) },
                      { label: c.tomorrow, d: midnight(1) },
                      { label: a.dayAfter, d: midnight(2) },
                    ].map((opt) => {
                      const active = finalDate && isSameDay(finalDate, opt.d);
                      return (
                        <Pressable
                          key={opt.label}
                          onPress={() => setPickedDate(opt.d)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable onPress={openDatePicker} style={styles.chip}>
                      <Ionicons name="calendar" size={13} color={colors.inkSoft} />
                      <Text style={styles.chipText}>{a.pickDate}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* --- Kis time --- */}
              <View style={styles.slot}>
                <View style={styles.slotIcon}>
                  <Ionicons name="alarm-outline" size={17} color={colors.terracotta} />
                </View>
                <View style={{ flex: 1 }}>
                  {!missingTime && (
                    <Text style={styles.slotValue}>{timeLabel(finalMinutes!)}</Text>
                  )}
                  <Pressable onPress={openTimePicker} style={styles.timeBtn}>
                    <Ionicons name="time-outline" size={15} color={colors.terracotta} />
                    <Text style={styles.timeBtnText}>
                      {missingTime ? a.pickTime : a.change}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {isPast && !missingTime && (
                <Text style={styles.err}>{a.pastError}</Text>
              )}

              {/* iOS inline pickers */}
              {iosDate && Platform.OS === "ios" && (
                <View style={styles.iosPicker}>
                  <DateTimePicker
                    value={finalDate ?? midnight(0)}
                    mode="date"
                    display="spinner"
                    minimumDate={midnight(0)}
                    onChange={(_e, d) => {
                      if (d) {
                        const m = new Date(d);
                        m.setHours(0, 0, 0, 0);
                        setPickedDate(m);
                      }
                    }}
                  />
                  <Pressable onPress={() => setIosDate(false)} style={styles.iosDone}>
                    <Text style={styles.iosDoneText}>{c.done}</Text>
                  </Pressable>
                </View>
              )}
              {iosTime && Platform.OS === "ios" && (
                <View style={styles.iosPicker}>
                  <DateTimePicker
                    value={(() => {
                      const d = new Date();
                      if (finalMinutes != null)
                        d.setHours(Math.floor(finalMinutes / 60), finalMinutes % 60, 0, 0);
                      return d;
                    })()}
                    mode="time"
                    display="spinner"
                    onChange={(_e, d) => {
                      if (d) setPickedMinutes(d.getHours() * 60 + d.getMinutes());
                    }}
                  />
                  <Pressable onPress={() => setIosTime(false)} style={styles.iosDone}>
                    <Text style={styles.iosDoneText}>{c.done}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Pressable
        onPress={save}
        disabled={saving || !canSave}
        style={({ pressed }) => [
          styles.save,
          (pressed || saving || !canSave) && { opacity: 0.55 },
        ]}
      >
        {saving ? (
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
    marginTop: 12,
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
  parsingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  parsingText: { fontSize: 13.5, fontWeight: "600", color: colors.terracotta },
  card: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 6,
  },
  slot: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  slotIcon: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(194,90,55,0.10)",
    marginTop: 1,
  },
  slotValue: { flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.ink, paddingTop: 6 },
  slotAsk: { fontSize: 14, fontWeight: "600", color: colors.inkSoft, marginBottom: 8, paddingTop: 4 },
  subInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 15,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  chipTextActive: { color: colors.white },
  timeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.terracotta,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  timeBtnText: { fontSize: 13.5, fontWeight: "700", color: colors.terracotta },
  err: {
    marginHorizontal: 12,
    marginBottom: 8,
    fontSize: 13,
    color: colors.terracotta,
    fontWeight: "600",
  },
  iosPicker: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
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
