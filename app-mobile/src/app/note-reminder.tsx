import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

import { makeStyles, useColors } from "@/theme/theme";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { useToast } from "@/components/toast";
import { Loader } from "@/components/loader";
import { PermissionModal } from "@/components/permission-modal";
import { reportError } from "@/lib/report-error";
import { addReminder, ReminderLimitError } from "@/lib/reminders";
import { linkNoteReminder } from "@/lib/notes";
import { ensureNotifPermission, scheduleReminderSeries } from "@/lib/notifications";
import { shouldShowReliabilityPrompt } from "@/lib/reliability";
import { markFirstReminder } from "@/lib/reviews";
import { checkReferralQualification } from "@/lib/plan";
import { emitDataChanged } from "@/lib/data-events";
import { logEvent } from "@/lib/analytics";

/**
 * Note se reminder — sirf "kab?".
 *
 * ── Ye screen kyun bani ────────────────────────────────────────────────────
 *
 * ⚠️ Pehle note ka "Reminder set karo" seedha `/add-reminder` kholta tha aur
 * note ka poora text (title + body, dono jude hue) uske text-box me daal deta
 * tha. Wahan se AI use padh kar title/waqt nikalne ki koshish karta tha — aur
 * wahi galat tha:
 *
 *   • Note ka poora paragraph ek reminder ka title ban jaata tha. Notification
 *     me chaar line ka text aata tha, jo padha hi nahi jaata.
 *   • Note me aksar koi waqt hota hi nahi ("doodh lena hai"). AI ko us text me
 *     kuch mil hi nahi paata tha, isliye wo poochhta rehta — jabki user ne to
 *     sirf itna kaha tha ki "iska reminder laga do".
 *   • Aur us screen par baaki sab kuch (title likho, AI se baat karo, repeat
 *     chuno) ek aise kaam ke liye saamne aa jaata tha jiska jawab ek hi sawaal
 *     me tha.
 *
 * Yahan sirf wahi ek sawaal hai: **kab?** Kaam ka text note se aata hai aur
 * waise ka waisa jaata hai — dobara likhna bhi nahi padta, AI ke andaze par bhi
 * kuch nahi chhodta.
 */

export default function NoteReminder() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  // `addReminder` (screen wali dict) se hi limit/fail wale message — wahi baat
  // do jagah do tarah se likhna sabse aasan tarika hai unhe alag hone dena.
  const { noteReminder: t, addReminder: a, common: c } = useT();
  const { locale } = useLocale();
  const bcp = locale === "hi" ? "hi-IN" : "en-IN";

  const { text, noteId } = useLocalSearchParams<{ text?: string; noteId?: string }>();
  const task = (typeof text === "string" ? text : "").trim();

  /**
   * Shuruaati waqt — abhi se ek ghanta aage, minute round.
   *
   * ⚠️ "Abhi" se shuru karna galat hota: user picker kholta, kuch nahi badalta,
   * save dabata — aur reminder ek aisa waqt le leta jo tab tak beet chuka hota.
   */
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  /** Roz wala reminder — 0 = ek hi baar. */
  const [everyDays, setEveryDays] = useState(0);
  const [saving, setSaving] = useState(false);
  const [permModal, setPermModal] = useState(false);

  /**
   * Chuna hua waqt beet chuka hai?
   *
   * ⚠️ Ye state me hai, render me hisaab lagakar nahi. Do wajah:
   *
   *   • `Date.now()` render me impure hai — har render par nateeja badal sakta
   *     hai (React ka `react-hooks/purity` yahi pakadta hai).
   *   • Aur ye asal me behtar bhi hai: user screen par baith ke soch raha ho aur
   *     chuna hua waqt beech me nikal jaye, to chetavni apne aap aa jaati hai.
   *     Warna wo Save dabata aur tab pata chalta.
   */
  const [past, setPast] = useState(false);
  useEffect(() => {
    const check = () => setPast(when.getTime() <= Date.now());
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, [when]);

  const dateLabel = when.toLocaleDateString(bcp, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = when.toLocaleTimeString(bcp, { hour: "numeric", minute: "2-digit" });

  async function save() {
    if (saving) return;
    if (past) {
      toast.show(t.pastTime, "info");
      return;
    }
    setSaving(true);
    try {
      /**
       * Title chhota, note poora.
       *
       * ⚠️ Notification me sirf `title` dikhta hai. Note ka poora paragraph
       * wahan daal dena hi purani screen ki sabse badi galti thi — alert par
       * chaar line ka text aata tha jo koi padhta hi nahi. Poora text `note` me
       * jaata hai (WhatsApp/email me wahi sandarbh deta hai).
       */
      const firstLine = task.split("\n")[0].trim();
      const title = firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine || task;

      const made = await addReminder({
        title,
        note: task,
        time_label: `${dateLabel}, ${timeLabel}`,
        remind_at: when.toISOString(),
        bucket: "upcoming",
        repeat_every_days: everyDays || null,
        repeat_until: null,
      });

      // Note se jod do — best-effort. Fail ho to reminder phir bhi bajega, bas
      // note par uska nishaan nahi lagega.
      if (noteId) void linkNoteReminder(noteId, made.id).catch(() => {});

      const notifOk = await ensureNotifPermission();
      if (notifOk) {
        await scheduleReminderSeries(made.id, title, when, everyDays || null, null);
      }

      logEvent("reminder_added", { from: "note" });
      markFirstReminder().catch(() => {});
      checkReferralQualification().catch(() => {});
      emitDataChanged();
      toast.show(notifOk ? t.saved : a.savedNeedPerm, notifOk ? "success" : "info");

      // Ek bhi permission baaki ho to alarm sach me nahi bajega — pehle wo
      // dikhao, band karne par screen bhi band.
      if (await shouldShowReliabilityPrompt()) {
        setPermModal(true);
        return;
      }
      router.back();
    } catch (e) {
      if (e instanceof ReminderLimitError) {
        toast.show(a.limitReached, "info");
        router.push("/upgrade" as never);
      } else {
        reportError(e, { screen: "note-reminder", action: "save" });
        toast.show(t.saveFailed, "error");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.title}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={tc.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Kaam kya hai — note se, waise ka waisa. Yahan likhne ko kuch nahi. */}
        <View style={styles.taskCard}>
          <Ionicons name="document-text-outline" size={16} color={tc.terracotta} />
          <Text style={styles.taskText} numberOfLines={4}>
            {task}
          </Text>
        </View>

        <Text style={styles.label}>{t.whenLabel}</Text>

        {/*
          ⚠️ Yahan pehle chaar tay-shuda chip the ("1 ghante me", "3 ghante me",
          "Aaj shaam", "Kal subah"). Wo hata diye gaye — waqt user ka hai, app ka
          andaza nahi. Chip se kaam sirf tab nikalta hai jab wahi chaar mauke
          user ke bhi hon; baaki har baar wo ek extra tap ban jaate the (pehle
          galat chip, phir asli picker) aur screen ka sabse zaroori hissa —
          calendar aur ghadi — neeche dab jaata tha.

          Ab dono seedha saamne hain, bade aur alag-alag.
        */}
        <View style={styles.pickCard}>
          <Pressable
            onPress={() => setPicker("date")}
            style={({ pressed }) => [styles.pickRowBig, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.pickIcon}>
              <Ionicons name="calendar" size={19} color={tc.terracotta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickLabel}>{t.dateLabel}</Text>
              <Text style={styles.pickValue}>{dateLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={tc.inkSoft} />
          </Pressable>

          <View style={styles.pickDivider} />

          <Pressable
            onPress={() => setPicker("time")}
            style={({ pressed }) => [styles.pickRowBig, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.pickIcon}>
              <Ionicons name="time" size={19} color={tc.terracotta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickLabel}>{t.timeLabel}</Text>
              <Text style={styles.pickValue}>{timeLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={tc.inkSoft} />
          </Pressable>
        </View>

        {past && (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={16} color={tc.terracottaDark} />
            <Text style={styles.err}>{t.pastTime}</Text>
          </View>
        )}

        <Text style={styles.label}>{t.repeatLabel}</Text>
        <View style={styles.quickRow}>
          {[
            { days: 0, label: t.repeatOnce },
            { days: 1, label: t.repeatDaily },
            { days: 7, label: t.repeatWeekly },
          ].map((o) => (
            <Pressable
              key={o.days}
              onPress={() => setEveryDays(o.days)}
              style={[styles.quick, everyDays === o.days && styles.quickOn]}
            >
              <Text style={[styles.quickText, everyDays === o.days && styles.quickTextOn]}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {picker && (
        <DateTimePicker
          value={when}
          mode={picker}
          // Ghadi ke liye poora clock (Android ka spinner nahi) — bade akshar
          // aur do saaf hisse, ghante aur minute.
          display={Platform.OS === "ios" ? "spinner" : picker === "time" ? "clock" : "calendar"}
          /**
           * Beeta hua DIN chuna hi na ja sake.
           *
           * ⚠️ Ye sirf aadhi rok hai, aur wahi is jagah ka sabse chhupa hua
           * kaanta hai: Android/iOS ke TIME picker par koi minimum hota hi nahi.
           * Yaani user aaj ki taarikh rakh ke subah 6 baje chun sakta hai, jabki
           * abhi 1 baj chuka ho — aur wo reminder kabhi bajta hi nahi. Isliye
           * neeche `onChange` me time ko alag se jaancha jaata hai.
           */
          minimumDate={picker === "date" ? new Date() : undefined}
          onChange={(event, picked) => {
            setPicker(null);
            // Android par "Cancel" bhi `onChange` bhejta hai — us par kuch nahi
            // badalna chahiye, warna cancel bhi ek chunav ban jaata hai.
            if (event.type === "dismissed" || !picked) return;

            /**
             * ⚠️ Sirf wahi hissa lo jo picker ne poochha tha.
             *
             * Android ka date picker time ko bina badle wapas deta hai, par
             * kuch OEM uske saath aaj ka waqt bhi bhej dete hain — poora
             * `picked` le lene par user ka chuna hua time chup-chaap ud jaata
             * hai. Wahi galti sabse mushkil se pakadi jaati hai.
             */
            const next = new Date(when);
            if (picker === "date") {
              next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
            } else {
              next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
            }

            /**
             * Beeta hua waqt kabhi set na ho.
             *
             * Aaj ke din 6 baje chun lena (jab 1 baj chuka ho) bilkul aam galti
             * hai. Use chup-chaap maan lena sabse bura hoga — reminder bana hua
             * dikhta hai aur kabhi bajta nahi. Yahan hum use ROKTE nahi, KAL par
             * sarka dete hain: user ka iraada wahi tha ("6 baje"), sirf din
             * chhoot gaya tha. Saath me ek toast, taaki badlaav chhupa na rahe.
             */
            if (next.getTime() <= Date.now()) {
              if (picker === "time") {
                next.setDate(next.getDate() + 1);
                toast.show(t.movedToTomorrow, "info");
              } else {
                toast.show(t.pastTime, "info");
              }
            }
            setWhen(next);
          }}
        />
      )}

      <Pressable
        onPress={() => void save()}
        disabled={saving || past}
        style={({ pressed }) => [styles.save, (pressed || saving || past) && { opacity: 0.7 }]}
      >
        {saving ? <Loader size={18} /> : <Text style={styles.saveText}>{c.save}</Text>}
      </Pressable>

      <PermissionModal
        visible={permModal}
        onClose={() => {
          setPermModal(false);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    ...CONTENT,
  },
  title: { fontSize: 22, fontWeight: "700", color: c.ink },
  close: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  content: { padding: 20, paddingBottom: 20, ...CONTENT },
  taskCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 14,
  },
  taskText: { flex: 1, fontSize: 15, lineHeight: 22, color: c.ink },
  label: { marginTop: 22, marginBottom: 10, fontSize: 15, fontWeight: "700", color: c.ink },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quick: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  quickOn: { backgroundColor: c.terracotta, borderColor: c.terracotta },
  quickText: { fontSize: 13, fontWeight: "700", color: c.inkSoft },
  quickTextOn: { color: c.white },
  /* Calendar + ghadi — ek hi card me do badi pankti. */
  pickCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  pickRowBig: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  pickDivider: { height: 1, backgroundColor: c.line, marginLeft: 66 },
  pickLabel: { fontSize: 12, fontWeight: "600", color: c.inkSoft },
  // Value bada — yahi wo cheez hai jise user padhne aaya hai.
  pickValue: { marginTop: 2, fontSize: 17, fontWeight: "800", color: c.ink },
  errBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  err: { flex: 1, fontSize: 13, fontWeight: "700", color: c.terracottaDark },
  save: {
    margin: 20,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 18,
    backgroundColor: c.terracotta,
    ...CONTENT,
  },
  saveText: { color: c.white, fontWeight: "700", fontSize: 16 },
}));
