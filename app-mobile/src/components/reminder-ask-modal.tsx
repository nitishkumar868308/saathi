import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Easing,
  TextInput,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";

import { makeStyles, useColors } from "@/theme/theme";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { VoiceButton } from "@/components/voice-button";
import { useKeyboardPad } from "@/components/keyboard-view";

/**
 * "Jo Saathi na samajh paaya, wo khud poochh le."
 *
 * ⚠️ Pehle aisa kuch tha hi nahi, aur yahi sabse badi shikayat thi: user text
 * likhta tha, AI usme se jitna samajh paata utna bhar deta tha, aur jo nahi
 * samajh paaya wo bas KHAALI KHAANA ban ke pada reh jaata tha. Screen par ek
 * halka sa "Kis din yaad dilau?" likha rehta tha — na wo sawaal jaisa lagta
 * tha, na uska koi jawab dene ki jagah saaf dikhti thi. User Save dabata tha,
 * ek toast aata tha, aur bas. Uske liye iska matlab seedha ye tha: "AI kuch
 * karta hi nahi, sab mujhe khud bharna padta hai."
 *
 * Ab jo baat chhoot gayi, Saathi wahi EK-EK karke poochta hai — poore popup
 * me, saaf sawaal ke saath, aur jawab dene ke sabse aasaan tareeke saath
 * (chips pehle, picker baad me). Jo usne samajh liya wo upar dikhta rehta hai,
 * taaki user ko bharosa rahe ki uski poori baat gayi nahi hai.
 *
 * Ek waqt me ek hi sawaal — kyunki teen khaali khaane ek saath dikhana wahi
 * purani soorat hai jisse bachna hai.
 */

/** Kaunsi baat chhoot gayi. Isi tarteeb me poochhi jaati hai. */
export type AskSlot = "what" | "day" | "time";

export type AskAnswers = {
  title?: string;
  date?: Date;
  minutes?: number;
};

/** Aaj se `offset` din ka midnight. */
function midnight(offset = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function ReminderAskModal({
  visible,
  slots,
  knownTitle,
  knownDate,
  knownMinutes,
  onDone,
  onCancel,
}: {
  visible: boolean;
  /** Kya-kya poochna hai. Khaali ho to popup khulta hi nahi. */
  slots: AskSlot[];
  /** Saathi ne jo pehle hi samajh liya — upar dikhta hai. */
  knownTitle?: string | null;
  knownDate?: Date | null;
  knownMinutes?: number | null;
  /** Sab sawaal ho gaye — sirf wahi cheezein aati hain jo poochhi gayi thi. */
  onDone: (answers: AskAnswers) => void;
  /** "Rehne do" — user khud form bharega. */
  onCancel: () => void;
}) {
  const tc = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { addReminder: a, common: c } = useT();
  const { locale } = useLocale();
  const bcp = locale === "hi" ? "hi-IN" : "en-IN";

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [iosPicker, setIosPicker] = useState<"date" | "time" | null>(null);

  /**
   * Keyboard ke liye jagah.
   *
   * ⚠️ "Kya yaad dilau?" wala pehla sawaal `autoFocus` par khulta hai, yaani
   * keyboard is popup ke saath hi upar aa jaata hai. Card screen ke theek beech
   * me hai, isliye uske neeche ka poora hissa — "Aage" ka button aur "Rehne
   * do" — keyboard ke PEECHE chala jaata tha. Us haalat me jawab likh ke aage
   * badhne ka koi raasta hi nahi bachta.
   *
   * Wahi ek tareeka jo `otp-modal` par pehle se hai: keyboard ki oonchai naap
   * ke backdrop me neeche se jagah chhod dete hain, taaki centered card usi
   * hisaab se upar khisak jaye. `KeyboardAvoidingView` yahan chalta hi nahi —
   * poori wajah `lib/use-keyboard.ts` par likhi hai.
   */
  const kbPad = useKeyboardPad(12);

  const scale = useRef(new Animated.Value(0.92)).current;

  // Har baar naye sire se khulta hai — purane jawab chipke na reh jaayein.
  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setTitle(knownTitle?.trim() ?? "");
    setDate(knownDate ?? null);
    setMinutes(knownMinutes ?? null);
    setIosPicker(null);
    scale.setValue(0.92);
    Animated.timing(scale, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
    // `known*` ko dep me nahi rakha: wo har render par naya `Date` object ho
    // sakta hai, aur tab ye effect har render par chalta — user ka abhi-abhi
    // diya jawab har baar mit jaata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scale]);

  const slot = slots[step];
  const isLast = step >= slots.length - 1;

  /** Abhi wale sawaal ka jawab aa chuka hai? Bina jawab ke aage nahi badhte. */
  const answered = useMemo(() => {
    if (slot === "what") return title.trim().length > 0;
    if (slot === "day") return date != null;
    if (slot === "time") return minutes != null;
    return false;
  }, [slot, title, date, minutes]);

  function next() {
    if (!answered) return;
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    // Sirf wahi lautao jo poochha gaya tha — warna ye un khaano ko bhi
    // overwrite kar dega jo user ne screen par khud bhare the.
    const out: AskAnswers = {};
    if (slots.includes("what")) out.title = title.trim();
    if (slots.includes("day") && date) out.date = date;
    if (slots.includes("time") && minutes != null) out.minutes = minutes;
    onDone(out);
  }

  function openDate() {
    const base = date ?? midnight(0);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: base,
        mode: "date",
        minimumDate: midnight(0),
        onChange: (_e, d) => {
          if (d) {
            const m = new Date(d);
            m.setHours(0, 0, 0, 0);
            setDate(m);
          }
        },
      });
    } else {
      setIosPicker("date");
    }
  }

  function openTime() {
    const base = new Date();
    if (minutes != null) base.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: base,
        mode: "time",
        is24Hour: false,
        onChange: (_e, d) => {
          if (d) setMinutes(d.getHours() * 60 + d.getMinutes());
        },
      });
    } else {
      setIosPicker("time");
    }
  }

  const dayLabel = (d: Date) => {
    if (sameDay(d, midnight(0))) return c.today;
    if (sameDay(d, midnight(1))) return c.tomorrow;
    if (sameDay(d, midnight(2))) return a.dayAfter;
    return d.toLocaleDateString(bcp, { weekday: "short", day: "numeric", month: "short" });
  };

  const timeLabel = (mins: number) => {
    const d = new Date();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d.toLocaleTimeString(bcp, { hour: "numeric", minute: "2-digit", hour12: true });
  };

  /** Saathi ne jo pehle hi samajh liya — ek chhoti si line, bharose ke liye. */
  const gotLine = useMemo(() => {
    const bits: string[] = [];
    const t = knownTitle?.trim();
    if (t && !slots.includes("what")) bits.push(t);
    if (knownDate && !slots.includes("day")) bits.push(dayLabel(knownDate));
    if (knownMinutes != null && !slots.includes("time")) bits.push(timeLabel(knownMinutes));
    return bits.join(" · ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownTitle, knownDate, knownMinutes, slots, locale]);

  if (!visible || slots.length === 0) return null;

  const heading =
    slots.length === 1
      ? a.askTitleOne
      : a.askTitleMany.replace("{n}", String(slots.length));

  const question = slot === "what" ? a.askWhat : slot === "day" ? a.askDay : a.pickTime;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.backdrop, { paddingBottom: 20 + kbPad }]}>
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
          <View style={[styles.card, { paddingBottom: 20 + Math.min(insets.bottom, 20) }]}>
            <View style={styles.head}>
              <View style={styles.iconWrap}>
                <Ionicons name="sparkles" size={20} color={tc.terracotta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heading}>{heading}</Text>
                {!!gotLine && (
                  <Text style={styles.gotLine} numberOfLines={2}>
                    {a.askGotIt}: {gotLine}
                  </Text>
                )}
              </View>
            </View>

            {/* Kitne sawaal — chhoti si patti. Ek se zyada ho tabhi. */}
            {slots.length > 1 && (
              <View style={styles.dots}>
                {slots.map((s, i) => (
                  <View key={s} style={[styles.dot, i <= step && styles.dotOn]} />
                ))}
              </View>
            )}

            <Text style={styles.question}>{question}</Text>

            <ScrollView
              style={{ maxHeight: 260 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {slot === "what" && (
                <View style={styles.inputRow}>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={a.askWhatPlaceholder}
                    placeholderTextColor={tc.inkSoft}
                    style={styles.input}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={next}
                  />
                  <VoiceButton
                    onText={(txt) => setTitle((p) => (p ? p + " " + txt : txt))}
                  />
                </View>
              )}

              {slot === "day" && (
                <View style={styles.chips}>
                  {[
                    { label: c.today, d: midnight(0) },
                    { label: c.tomorrow, d: midnight(1) },
                    { label: a.dayAfter, d: midnight(2) },
                  ].map((opt) => {
                    const on = date != null && sameDay(date, opt.d);
                    return (
                      <Pressable
                        key={opt.label}
                        onPress={() => setDate(opt.d)}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={openDate} style={styles.chip}>
                    <Ionicons name="calendar" size={13} color={tc.inkSoft} />
                    <Text style={styles.chipText}>{a.pickDate}</Text>
                  </Pressable>
                </View>
              )}

              {slot === "time" && (
                <View style={styles.chips}>
                  {[
                    { label: a.timeMorning, m: 8 * 60 },
                    { label: a.timeNoon, m: 13 * 60 },
                    { label: a.timeEvening, m: 18 * 60 },
                    { label: a.timeNight, m: 21 * 60 },
                  ].map((opt) => {
                    const on = minutes === opt.m;
                    return (
                      <Pressable
                        key={opt.label}
                        onPress={() => setMinutes(opt.m)}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={openTime} style={styles.chip}>
                    <Ionicons name="time-outline" size={13} color={tc.inkSoft} />
                    <Text style={styles.chipText}>{a.otherTime}</Text>
                  </Pressable>
                </View>
              )}

              {/* Jawab de diya — wo saaf dikhe, taaki "Aage" andhere me na dabana pade. */}
              {slot === "day" && date != null && (
                <Text style={styles.picked}>{dayLabel(date)}</Text>
              )}
              {slot === "time" && minutes != null && (
                <Text style={styles.picked}>{timeLabel(minutes)}</Text>
              )}

              {/* iOS ke inline pickers — Android par native dialog khulta hai. */}
              {iosPicker === "date" && Platform.OS === "ios" && (
                <DateTimePicker
                  value={date ?? midnight(0)}
                  mode="date"
                  display="spinner"
                  minimumDate={midnight(0)}
                  onChange={(_e, d) => {
                    if (d) {
                      const m = new Date(d);
                      m.setHours(0, 0, 0, 0);
                      setDate(m);
                    }
                  }}
                />
              )}
              {iosPicker === "time" && Platform.OS === "ios" && (
                <DateTimePicker
                  value={(() => {
                    const d = new Date();
                    if (minutes != null) d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  display="spinner"
                  onChange={(_e, d) => {
                    if (d) setMinutes(d.getHours() * 60 + d.getMinutes());
                  }}
                />
              )}
            </ScrollView>

            <View style={styles.btnRow}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [styles.btnAlt, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.btnAltText}>{a.askManual}</Text>
              </Pressable>
              <Pressable
                onPress={next}
                disabled={!answered}
                style={({ pressed }) => [
                  styles.btn,
                  (!answered || pressed) && { opacity: 0.55 },
                ]}
              >
                <Text style={styles.btnText}>{isLast ? a.askFinish : a.askNext}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    // Theme-aware parda — light par 45% garam-kaala, dark par 72%.
    backgroundColor: c.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  cardWrap: { width: "100%", maxWidth: 400 },
  card: {
    borderRadius: 26,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: {
    height: 40,
    width: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  heading: { fontSize: 17.5, fontWeight: "800", color: c.ink },
  gotLine: { marginTop: 3, fontSize: 12.5, color: c.inkSoft, lineHeight: 17 },
  dots: { flexDirection: "row", gap: 6, marginTop: 14 },
  dot: { height: 4, flex: 1, borderRadius: 2, backgroundColor: c.line },
  dotOn: { backgroundColor: c.terracotta },
  question: { marginTop: 16, marginBottom: 12, fontSize: 15.5, fontWeight: "700", color: c.ink },
  inputRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: c.ink,
    fontSize: 15,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipOn: { backgroundColor: c.terracotta, borderColor: c.terracotta },
  chipText: { fontSize: 13.5, fontWeight: "600", color: c.inkSoft },
  chipTextOn: { color: c.white },
  picked: { marginTop: 12, fontSize: 15, fontWeight: "800", color: c.ink },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 15,
    backgroundColor: c.terracotta,
  },
  btnText: { fontSize: 15.5, fontWeight: "800", color: c.white },
  btnAlt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  btnAltText: { fontSize: 13.5, fontWeight: "700", color: c.inkSoft, textAlign: "center" },
}));

export default ReminderAskModal;
