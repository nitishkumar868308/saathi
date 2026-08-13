import { useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  Pressable,
  Modal,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useRouter, useFocusEffect } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { SkeletonList } from "@/components/loader";
import { ConfirmModal } from "@/components/confirm-modal";
import { reportError } from "@/lib/report-error";
import { timed } from "@/lib/network";
import { reportIfNetwork } from "@/lib/net-alert";
import {
  setReminderOn,
  deleteReminder,
  completeReminder,
  isRepeating,
  type Reminder,
} from "@/lib/reminders";
import {
  isPendingId,
  listRemindersWithPending,
  removeFromOutbox,
} from "@/lib/reminder-outbox";
import { scheduleReminderSeries, cancelReminder } from "@/lib/notifications";
import { repeatLine } from "@/lib/repeat-label";
import { formatWhen } from "@/utils/parse-time";
import { Pagination, usePaged, PAGE_SIZE } from "@/components/pagination";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { useToast } from "@/components/toast";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { emitDataChanged, useDataChanged } from "@/lib/data-events";

/** Ye reminder aaj hi bajega? (Home tab bhi bilkul yahi hisaab lagata hai.) */
function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Is reminder ka waqt beet chuka hai (aur aaj ka bhi nahi hai)?
 *
 * ⚠️ Ye check pehle KAHIN THA HI NAHI, aur wahi shikayat ki jad thi: "Aug 5 ke
 * reminder 'Aane wale' me dikh rahe hain". Bucket sirf DO the — `isToday` aur
 * "baaki sab" — isliye har beeta hua reminder definition se hi "aane wala" ban
 * jaata tha. App user ko saaf-saaf galat baat dikha rahi thi.
 *
 * `remind_at` khaali ho to `false`: bina waqt wala reminder beeta hua nahi hai,
 * wo bas abhi tay nahi hua. Wo "Aane wale" me hi rehta hai.
 */
function isMissed(iso: string | null): boolean {
  if (!iso || isToday(iso)) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return new Date(iso).getTime() < start.getTime();
}

export default function Reminders() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { reminders: r0, common: c } = useT();
  const { locale } = useLocale();
  const words = { today: c.today, tomorrow: c.tomorrow };
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  /** Delete confirm — OS ke bhadde Alert ki jagah apna branded modal (item 9). */
  const [toDelete, setToDelete] = useState<Reminder | null>(null);
  /** "Dekho" — poori detail ek saaf sheet me. */
  const [viewing, setViewing] = useState<Reminder | null>(null);

  /**
   * `silent` — list pehle se saamne hai, sirf taaza karni hai. Aise me skeleton
   * dobara dikhana jhatka lagta hai (list gayab hoke wapas aati hai), isliye
   * background refresh chup-chaap hota hai.
   */
  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        // Offline banaya reminder bhi yahan dikhna chahiye — alarm lag chuka
        // hai, bas server par jaana baaki hai. Bina iske wo screen par gayab
        // rehta tha aur user usi ko dobara bana deta tha.
        setItems(await timed(listRemindersWithPending()));
      } catch (e) {
        // Net ki dikkat ho to poore app wala popup + retry; warna hi toast.
        if (!reportIfNetwork(e, "load", load)) {
          reportError(e, { screen: "reminders", action: "load" });
          toast.show(r0.title + " ✕", "error");
        }
      } finally {
        setLoading(false);
      }
    },
    [toast, r0.title],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Reminder ka alert modal is screen ke UPAR khulta hai — focus kabhi nahi
  // jaata, isliye upar wala reload chalta hi nahi tha aur nipta hua reminder
  // yahin pada rehta tha (item 2).
  useDataChanged(() => {
    void load(true);
  });

  async function toggle(r: Reminder) {
    // Kataar me pada reminder — uski server wali row abhi bani hi nahi hai, to
    // on/off kis par lagayein? Local nakal rakhna do alag sach bana deta hai.
    // Alarm pehle se lag chuka hai, isliye rukna sirf kuch der ka hai.
    if (isPendingId(r.id)) return toast.show(r0.pendingBusy, "info");
    const next = !r.is_on;
    setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_on: next } : x)));
    try {
      await setReminderOn(r.id, next);
      if (next && r.remind_at) {
        await scheduleReminderSeries(
          r.id,
          r.title,
          new Date(r.remind_at),
          r.repeat_every_days,
          r.repeat_until,
        );
      } else {
        await cancelReminder(r.id);
      }
      emitDataChanged();
    } catch (e) {
      if (!reportIfNetwork(e, "save")) toast.show(r0.title + " ✕", "error");
      load();
    }
  }

  /**
   * "Ho gaya" — roz wale reminder me sirf AAJ ka.
   *
   * Server tay karta hai ki agla occurrence kab hai (`complete_reminder`), taaki
   * app aur cron kabhi alag din na nikalein. Wahi se phone ke alarm bhi nayi
   * khidki par lag jaate hain.
   *
   * `next` null aaya matlab series khatam (90 din poore) ya ek-baar wala
   * reminder tha — dono soorat me reminder chup ho jaata hai.
   */
  async function markDone(r: Reminder) {
    // "Ho gaya" ka hisaab server (`complete_reminder`) karta hai — aur uske liye
    // row ka hona zaroori hai. Sync hone tak ruk jao.
    if (isPendingId(r.id)) return toast.show(r0.pendingBusy, "info");
    try {
      const next = await completeReminder(r.id);
      if (next) {
        await scheduleReminderSeries(
          r.id,
          r.title,
          new Date(next),
          r.repeat_every_days,
          r.repeat_until,
        );
        toast.show(r0.doneToday, "success");
      } else {
        await cancelReminder(r.id);
        toast.show(r0.doneAll, "success");
      }
      setViewing(null);
      load(true);
      // Home tab ka "Aaj" wala card bhi turant sudhar jaye.
      emitDataChanged();
    } catch (e) {
      if (!reportIfNetwork(e, "save", () => markDone(r))) {
        toast.show(r0.title + " ✕", "error");
      }
    }
  }

  async function doDelete() {
    const r = toDelete;
    setToDelete(null);
    if (!r) return;
    // Kataar wala reminder abhi sirf isi phone par hai — usse hatana poori tarah
    // yahin ho sakta hai (server par jaane ki koi row hai hi nahi).
    if (isPendingId(r.id)) {
      await removeFromOutbox(r.id);
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      toast.show(r0.deleted, "success");
      emitDataChanged();
      return;
    }
    try {
      await deleteReminder(r.id);
      await cancelReminder(r.id);
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      toast.show(r0.deleted, "success");
      emitDataChanged();
    } catch (e) {
      if (!reportIfNetwork(e, "save")) toast.show(c.delete + " ✕", "error");
    }
  }

  // ⚠️ Yahan pehle stored `bucket` column padha jaata tha. Wo reminder banate
  // waqt ek baar likha jaata hai aur uske baad kabhi badalta nahi — isliye:
  //   * kal ke liye banaya reminder kal aa jaane par bhi "Aane wale" me hi
  //     pada rehta tha, "Aaj" me kabhi nahi aata tha;
  //   * aur roz wale reminder me to ye aur bura tha — "gym roz 6 baje" hamesha
  //     ke liye "Aaj" me chipak jaata, chahe agli baar 3 hafte baad ho.
  //
  // Home tab pehle se hi `remind_at` se hisaab lagata hai (`isToday`). Ab dono
  // screen ek hi sach dikhate hain.
  /**
   * Teen khaane, do nahi.
   *
   * ⚠️ Pehle sirf `today` aur `upcoming` the, aur `upcoming` ki poori shart
   * `!isToday(...)` thi — yaani 5 August ka beeta hua reminder bhi "Aane wale"
   * me baith jaata tha (upar `isMissed` par poori wajah likhi hai).
   *
   * "Chhoot gaye" apna alag khaana isliye deta hai, chhupata nahi: wo reminder
   * abhi bhi chalu hai aur user ne use nipatana hai. List se gayab kar dena use
   * dobara kabhi na dikhne dena hota.
   */
  const missed = items.filter((r) => isMissed(r.remind_at));
  const today = items.filter((r) => isToday(r.remind_at));
  const upcoming = items.filter((r) => !isToday(r.remind_at) && !isMissed(r.remind_at));

  // 7 se zyada hote hi pagination — har list me (item 21).
  const mp = usePaged(missed, PAGE_SIZE);
  const tp = usePaged(today, PAGE_SIZE);
  const up = usePaged(upcoming, PAGE_SIZE);

  // Card pe time hamesha current bhasha me — stored label ki jagah remind_at se.
  const timeOf = (r: Reminder): string | null =>
    r.remind_at ? formatWhen(new Date(r.remind_at), words, locale) : r.time_label ?? null;

  // "Roz · 90 din tak" — card aur detail sheet dono ek hi line dikhate hain.
  const repeatOf = (r: Reminder): string | null =>
    repeatLine(r.repeat_every_days, r.repeat_until, r0, locale);

  const rowProps = {
    onToggle: toggle,
    onDelete: setToDelete,
    onView: setViewing,
    pausedTag: r0.pausedTag,
    timeOf,
    repeatOf,
    labels: { view: r0.viewAction, remove: r0.deleteAction },
  };

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
            <Ionicons name="alarm-outline" size={28} color={tc.terracotta} />
          </View>
          <Text style={styles.emptyTitle}>{r0.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{r0.emptyBody}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Chhoot gaye — sabse upar, kyunki yahi wo hain jinpe kuch karna
              baaki hai. Khaali ho to `Section` khud kuch nahi dikhata. */}
          {missed.length > 0 && (
            <>
              <Section title={r0.missed} items={mp.pageItems} {...rowProps} />
              <Text style={styles.missedHint}>{r0.missedHint}</Text>
              <Pagination page={mp.page} pageCount={mp.pageCount} onPage={mp.setPage} />
            </>
          )}
          <Section title={r0.today} items={tp.pageItems} {...rowProps} />
          <Pagination page={tp.page} pageCount={tp.pageCount} onPage={tp.setPage} />
          <Section title={r0.upcoming} items={up.pageItems} {...rowProps} />
          <Pagination page={up.page} pageCount={up.pageCount} onPage={up.setPage} />
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.push("/add-reminder")}
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="add" size={20} color={tc.white} />
        <Text style={styles.addText}>{r0.title}</Text>
      </Pressable>

      <ConfirmModal
        visible={!!toDelete}
        title={r0.deleteConfirmTitle}
        message={toDelete ? tpl(r0.deleteConfirmBody, { title: toDelete.title }) : undefined}
        confirmLabel={c.delete}
        cancelLabel={c.cancel}
        icon="trash"
        destructive
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />

      <DetailSheet
        reminder={viewing}
        onClose={() => setViewing(null)}
        onDone={markDone}
        timeOf={timeOf}
        repeatOf={repeatOf}
        copy={r0}
      />
    </SafeAreaView>
  );
}

/* ------------------------------- section ------------------------------- */

type RowProps = {
  onToggle: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
  onView: (r: Reminder) => void;
  pausedTag: string;
  timeOf: (r: Reminder) => string | null;
  /** "Roz · 90 din tak" — ek baar wale reminder me null. */
  repeatOf: (r: Reminder) => string | null;
  labels: { view: string; remove: string };
};

/**
 * Reminder card.
 *
 * ⚠️ Pehle yahan sirf ek Switch tha aur delete ke liye "press and hold" — koi
 * icon nahi, koi ishaara nahi. Log hold karna jaante hi nahi the (item 9). Ab
 * har card par teen saaf cheezein hain: dekho (aankh), hatao (trash), aur
 * chalu/band ka toggle apne label ke saath.
 */
function Section({
  title,
  items,
  onToggle,
  onDelete,
  onView,
  pausedTag,
  timeOf,
  repeatOf,
  labels,
}: RowProps & { title: string; items: Reminder[] }) {
  const tc = useColors();
  const styles = useStyles();
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 10 }}>
        {items.map((r) => {
          const live = r.is_on && !r.is_paused;
          return (
            <View key={r.id} style={styles.card}>
              <Pressable
                onPress={() =>
                  r.is_paused ? router.push("/upgrade" as never) : onView(r)
                }
                style={styles.cardTop}
              >
                <View style={[styles.rIcon, !live && { opacity: 0.4 }]}>
                  <Ionicons
                    name={r.is_paused ? "lock-closed" : "notifications"}
                    size={18}
                    color={tc.terracotta}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rTitle, !live && styles.off]} numberOfLines={2}>
                    {r.title}
                  </Text>
                  {r.is_paused ? (
                    <Text style={styles.pausedTag}>{pausedTag}</Text>
                  ) : timeOf(r) ? (
                    <Text style={styles.rTime}>🕒 {timeOf(r)}</Text>
                  ) : null}
                  {/* Roz wala reminder ek nazar me alag dikhe — warna user ko
                      lagta hai ye bhi ek baar wala hai aur wo dobara bana deta
                      hai. */}
                  {!r.is_paused && !!repeatOf(r) && (
                    <View style={styles.repeatTag}>
                      <Ionicons name="repeat" size={12} color={tc.terracotta} />
                      <Text style={styles.repeatTagText}>{repeatOf(r)}</Text>
                    </View>
                  )}
                </View>
                {r.is_paused && (
                  <View style={styles.pausedPill}>
                    <Ionicons name="star" size={11} color={tc.white} />
                    <Text style={styles.pausedPillText}>Plus</Text>
                  </View>
                )}
              </Pressable>

              {!r.is_paused && (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => onView(r)}
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
                    hitSlop={4}
                  >
                    <Ionicons name="eye-outline" size={17} color={tc.inkSoft} />
                    <Text style={styles.actionText}>{labels.view}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => onDelete(r)}
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
                    hitSlop={4}
                  >
                    <Ionicons name="trash-outline" size={17} color={tc.danger} />
                    <Text style={[styles.actionText, { color: tc.danger }]}>
                      {labels.remove}
                    </Text>
                  </Pressable>

                  <View style={styles.spacer} />

                  <Switch
                    value={r.is_on}
                    onValueChange={() => onToggle(r)}
                    trackColor={{ false: tc.line, true: tc.terracotta }}
                    thumbColor={tc.white}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ----------------------------- detail sheet ----------------------------- */

/** "Dekho" — reminder ki poori baat, wahi jo user ne bola/likha tha bhi. */
function DetailSheet({
  reminder,
  onClose,
  onDone,
  timeOf,
  repeatOf,
  copy,
}: {
  reminder: Reminder | null;
  onClose: () => void;
  onDone: (r: Reminder) => void;
  timeOf: (r: Reminder) => string | null;
  repeatOf: (r: Reminder) => string | null;
  copy: {
    detailTitle: string;
    detailWhen: string;
    detailNote: string;
    detailStatus: string;
    activeLabel: string;
    inactiveLabel: string;
    repeatLabel: string;
    doneToday: string;
    doneBtn: string;
    doneBtnRepeat: string;
  };
}) {
  const tc = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  if (!reminder) return null;
  const r = reminder;
  return (
    <Modal statusBarTranslucent navigationBarTranslucent transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        {/**
         * ⚠️ Bottom padding insets se, aur oonchai par hadd.
         *
         * Pehle `paddingBottom: 34` tay tha: 3-button navigation bar wale phone
         * par (Samsung ka ||| ○ <) neeche wala "Ho gaya" button us bar ke
         * neeche chala jaata tha aur daba hi nahi paata tha. Aur lambe note
         * wale reminder par sheet upar se bahar nikal jaata tha — title tak
         * dikhta hi nahi tha.
         */}
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: 16 + insets.bottom, maxHeight: height * 0.85 },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHead}>
            <View style={styles.rIcon}>
              <Ionicons name="notifications" size={18} color={tc.terracotta} />
            </View>
            <Text style={styles.sheetLabel}>{copy.detailTitle}</Text>
          </View>

          <Text style={styles.sheetTitle}>{r.title}</Text>

          <View style={styles.sheetRow}>
            <Ionicons name="time-outline" size={17} color={tc.inkSoft} />
            <Text style={styles.sheetRowLabel}>{copy.detailWhen}</Text>
            <Text style={styles.sheetRowValue}>{timeOf(r) ?? "—"}</Text>
          </View>

          <View style={styles.sheetRow}>
            <Ionicons name="pulse-outline" size={17} color={tc.inkSoft} />
            <Text style={styles.sheetRowLabel}>{copy.detailStatus}</Text>
            <Text
              style={[
                styles.sheetRowValue,
                { color: r.is_on ? tc.sage : tc.inkSoft },
              ]}
            >
              {r.is_on ? copy.activeLabel : copy.inactiveLabel}
            </Text>
          </View>

          {!!repeatOf(r) && (
            <View style={styles.sheetRow}>
              <Ionicons name="repeat" size={17} color={tc.inkSoft} />
              <Text style={styles.sheetRowLabel}>{copy.repeatLabel}</Text>
              <Text style={styles.sheetRowValue}>{repeatOf(r)}</Text>
            </View>
          )}

          {!!r.note?.trim() && (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>{copy.detailNote}</Text>
              <Text style={styles.noteText}>{r.note.trim()}</Text>
            </View>
          )}

          {/* "Ho gaya" — roz wale me sirf aaj ka, ek baar wale me poora band.
              Button ka text bhi wahi batata hai, taaki user ko dar na ho ki
              usne poori series delete kar di. */}
          <Pressable
            onPress={() => onDone(r)}
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="checkmark-circle" size={19} color={tc.white} />
            <Text style={styles.doneBtnText}>
              {isRepeating(r) ? copy.doneBtnRepeat : copy.doneBtn}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  headerWrap: { paddingHorizontal: 20, paddingTop: 16, ...CONTENT },
  title: { fontSize: 26, fontWeight: "700", color: c.ink },
  sub: { marginTop: 4, fontSize: 14, color: c.inkSoft },
  /** "Inka waqt beet chuka hai" — heading ke neeche, halka. */
  missedHint: {
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 20,
    fontSize: 12.5,
    color: c.inkSoft,
  },
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
  emptyTitle: { fontSize: 18, fontWeight: "600", color: c.ink },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: c.inkSoft,
    textAlign: "center",
    maxWidth: 280,
  },
  content: { padding: 20, paddingBottom: 100, ...CONTENT },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: c.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  rIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  rTitle: { fontSize: 15.5, fontWeight: "700", color: c.ink },
  off: { textDecorationLine: "line-through", color: c.inkSoft },
  rTime: { marginTop: 3, fontSize: 13, color: c.inkSoft },
  repeatTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: "rgba(194,90,55,0.10)",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  repeatTagText: { fontSize: 11.5, fontWeight: "700", color: c.terracotta },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 22,
    height: 54,
    borderRadius: 18,
    backgroundColor: c.terracotta,
  },
  doneBtnText: { fontSize: 16, fontWeight: "800", color: c.white },
  pausedTag: { marginTop: 2, fontSize: 12, fontWeight: "600", color: c.terracotta },
  pausedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: c.terracotta,
  },
  pausedPillText: { fontSize: 11.5, fontWeight: "800", color: c.white },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.cream,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  actionPressed: { backgroundColor: c.creamDeep },
  actionText: { fontSize: 13, fontWeight: "700", color: c.inkSoft },
  spacer: { flex: 1 },
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
    backgroundColor: c.terracotta,
    shadowColor: c.terracotta,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  addText: { color: c.white, fontWeight: "700", fontSize: 15 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: c.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    // paddingBottom / maxHeight component me insets se lagte hain.
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.line,
    marginBottom: 18,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sheetLabel: {
    fontSize: 12.5,
    fontWeight: "800",
    color: c.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sheetTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "800",
    color: c.ink,
    lineHeight: 29,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingTop: 14,
  },
  sheetRowLabel: { fontSize: 14, color: c.inkSoft, fontWeight: "600" },
  sheetRowValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: c.ink,
  },
  noteBox: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    padding: 14,
  },
  noteLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    color: c.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  noteText: { marginTop: 6, fontSize: 15, lineHeight: 22, color: c.ink },
}));
