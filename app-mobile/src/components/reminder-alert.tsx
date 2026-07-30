import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import notifee, { EventType, type Notification } from "@notifee/react-native";

import { colors } from "@/theme/colors";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { alertUser, stopAlert } from "@/lib/alert-mode";
import { completeReminder } from "@/lib/reminders";
import { cancelReminder, scheduleReminderSeries } from "@/lib/notifications";
import { acknowledgeDocument, renewDocument } from "@/lib/doc-ack";
import { documentFollowUp, type DocFollowUp } from "@/lib/ai";
import { listDocuments } from "@/lib/documents";

type Alert = { id: string; title: string; body: string; kind: "reminder" | "expiry" };

function fromNotification(n?: Notification | null): Alert | null {
  if (!n) return null;
  const data = (n.data ?? {}) as { kind?: string; body?: string; id?: string };

  // ⚠️ Admin panel se aayi push ko yahan se guzarna hi nahi chahiye.
  //
  // Wo koi "kaam" nahi hai, sirf ek khabar hai — uska koi reminder id nahi hota
  // aur na hi koi document. Bina is guard ke wo neeche "reminder" maan li jaati
  // aur user ko "Ye kaam ho gaya?" wala full-screen modal dikh jaata; "Ho gaya"
  // dabate hi app ek jhoothe id par `complete_reminder` chala deti.
  // Admin ki notification tray me hi theek hai.
  if (data.kind === "admin") return null;

  return {
    // Reminder me id = reminder id; expiry me "doc:<id>:<lead>".
    id: (data.id as string) ?? n.id ?? "",
    title: n.title ?? "Saathi",
    body: n.body ?? (data.body as string) ?? "",
    kind: data.kind === "expiry" ? "expiry" : "reminder",
  };
}

/** "doc:<uuid>:<lead>" se document id nikaalo (expiry ack ke liye). */
function docIdFrom(identifier: string): string | null {
  const m = identifier.match(/^doc:(.+):\d+$/);
  return m ? m[1] : null;
}

/**
 * Reminder/expiry ka full-screen alert — screen ke beech me ek zaroori message
 * ki tarah (spec #5). Sirf notification tray me chup-chaap nahi rehta:
 *   - App khula ho aur notification aaye        -> turant modal.
 *   - Notification pe tap (app pehle se chalu)   -> modal.
 *   - App poori tarah band tha, tap se khula     -> modal (cold-start).
 * Root me mount hai (_layout), isliye kisi bhi screen pe kaam karta hai.
 */
export function ReminderAlertHost() {
  const { notif: n } = useT();
  const { locale } = useLocale();
  const [alert, setAlert] = useState<Alert | null>(null);
  const scale = useRef(new Animated.Value(0.9)).current;
  const handledId = useRef<string | null>(null);

  /**
   * Document expiry ka follow-up (item 18).
   *
   * `ai` = Saathi ki apni lines us document ke hisaab se ("passport renew ho
   * gaya?" / "insurance phir se kara liya?"). Na aayein to `n.*` wali default
   * lines chalti hain — flow kabhi rukta nahi.
   *
   * `step` batata hai baat kahan tak pahunchi: pehle sawaal, phir jawab.
   */
  const [ai, setAi] = useState<DocFollowUp | null>(null);
  const [step, setStep] = useState<"ask" | "done" | "later">("ask");

  useEffect(() => {
    let alive = true;
    const show = (notif?: Notification | null) => {
      const a = fromNotification(notif);
      if (!a || !alive) return;
      if (handledId.current === a.id) return; // dobara na dikhe
      handledId.current = a.id;
      setAlert(a);
    };

    // Foreground: notification aaye (DELIVERED) ya tap ho (PRESS) -> modal.
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.DELIVERED || type === EventType.PRESS) {
        show(detail.notification);
      }
    });

    // Cold-start: app band tha, notification/full-screen se khula.
    notifee.getInitialNotification().then((initial) => show(initial?.notification));

    return () => {
      alive = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!alert) return;
    setStep("ask");
    setAi(null);
    scale.setValue(0.9);
    Animated.timing(scale, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
    // Naam le ke bulao, phir reminder/document ka kaam bolo — user ko phone
    // uthake padhna na pade. Ring/vibrate/silent Settings se tay hota hai.
    void alertUser(alert.body);
  }, [alert, scale]);

  /**
   * Expiry alert khulte hi Saathi se uske apne shabd maango.
   *
   * Peeche chalta hai — alert turant dikh jaata hai, AI ki lines aate hi upar
   * chadh jaati hain. Net na ho to default lines hi rehti hain, user ko pata
   * bhi nahi chalta ki kuch chhoot gaya.
   */
  useEffect(() => {
    if (alert?.kind !== "expiry") return;
    const docId = docIdFrom(alert.id);
    if (!docId) return;
    let alive = true;
    (async () => {
      const docs = await listDocuments().catch(() => []);
      const doc = docs.find((d) => d.id === docId);
      if (!doc || !alive) return;
      const lines = await documentFollowUp(
        { name: doc.name, type: doc.type, expiry: doc.expiry },
        locale,
      );
      if (alive && lines) setAi(lines);
    })();
    return () => {
      alive = false;
    };
  }, [alert, locale]);

  // Alert band ho ya component unmount ho to bolna rok do.
  function dismiss() {
    stopAlert();
    setAlert(null);
    setAi(null);
    setStep("ask");
  }

  /**
   * Reminder "ho gaya".
   *
   * ⚠️ Pehle ye seedha `setReminderOn(false)` karta tha — yaani reminder HAMESHA
   * ke liye band. Roz wale reminder me ye galat hai: gym karke "ho gaya" dabane
   * par agli subah ka alarm bhi mar jaata tha.
   *
   * Ab server tay karta hai: roz wale me sirf aaj ka nipatta hai aur remind_at
   * agle din pe sarak jaata hai; ek baar wale me reminder band. Jawab me agla
   * time aata hai, usi par nayi alarm-khidki lag jaati hai.
   */
  function onDone() {
    const id = alert?.kind === "reminder" ? alert.id : null;
    const title = alert?.body ?? "";
    dismiss();
    if (!id) return;
    void (async () => {
      try {
        const next = await completeReminder(id);
        if (next) await scheduleReminderSeries(id, title, new Date(next), null, null);
        else await cancelReminder(id);
      } catch {
        // Net na ho to alarm to hata hi do — user ne kaam kar liya hai, usse
        // wahi notification dobara dena sabse chidhchida hoga. Server agli sync
        // par apne aap sahi ho jaayega.
        await cancelReminder(id).catch(() => {});
      }
    })();
  }

  /** Expiry: "haan, ho gaya" — aage ke sab reminder band + naya daalne ko kaho. */
  function onDocDone() {
    stopAlert();
    const docId = alert ? docIdFrom(alert.id) : null;
    if (docId) void renewDocument(docId);
    setStep("done");
  }

  /** Expiry: "abhi nahi" — bas dekh liya maano, reminder chalte rahenge. */
  function onDocLater() {
    stopAlert();
    const docId = alert ? docIdFrom(alert.id) : null;
    if (docId) acknowledgeDocument(docId);
    setStep("later");
  }

  /** Renew kiya hua document ab daal do — nayi expiry Saathi sambhal lega. */
  function onAddNew() {
    dismiss();
    router.push("/add-document");
  }

  useEffect(() => () => stopAlert(), []);

  if (!alert) return null;
  const isExpiry = alert.kind === "expiry";

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={[styles.iconWrap, isExpiry && styles.iconExpiry]}>
            <Ionicons
              name={isExpiry ? "document-text" : "alarm"}
              size={34}
              color={colors.white}
            />
          </View>
          <Text style={styles.kicker}>{isExpiry ? n.alertExpiry : n.alertReminder}</Text>
          <Text style={styles.body}>{alert.body}</Text>

          {isExpiry ? (
            /* Document expiry — do qadam (item 18):
               1. "Ye ho gaya kya?" — sawaal Saathi ke apne shabdon me.
               2. Jawab ke hisaab se: ho gaya -> reminder band + naya daalne ko
                  kaho; abhi nahi -> bharosa do ki phir yaad dila dunga. */
            step === "ask" ? (
              <>
                <Text style={styles.didText}>{ai?.ask ?? n.docAsk}</Text>
                <View style={styles.btnRow}>
                  <Pressable
                    onPress={onDocLater}
                    style={({ pressed }) => [styles.btnAlt, pressed && { opacity: 0.9 }]}
                  >
                    <Text style={styles.btnAltText}>{n.alertLater}</Text>
                  </Pressable>
                  <Pressable
                    onPress={onDocDone}
                    style={({ pressed }) => [
                      styles.btn,
                      { flex: 1, marginTop: 0 },
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Ionicons name="checkmark" size={18} color={colors.white} />
                    <Text style={styles.btnText}>{n.alertDone}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.didText}>
                  {step === "done" ? (ai?.done ?? n.docDone) : (ai?.later ?? n.docLater)}
                </Text>
                {step === "done" && (
                  <>
                    <Text style={styles.addNewText}>{ai?.addNew ?? n.docAddNew}</Text>
                    <Pressable
                      onPress={onAddNew}
                      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
                    >
                      <Ionicons name="camera" size={18} color={colors.white} />
                      <Text style={styles.btnText}>{n.docAddBtn}</Text>
                    </Pressable>
                  </>
                )}
                <Pressable
                  onPress={dismiss}
                  style={({ pressed }) => [
                    styles.btnAlt,
                    styles.btnAltWide,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.btnAltText}>{n.alertOk}</Text>
                </Pressable>
              </>
            )
          ) : (
            <>
              <Text style={styles.didText}>{n.alertDid}</Text>
              <View style={styles.btnRow}>
                <Pressable
                  onPress={dismiss}
                  style={({ pressed }) => [styles.btnAlt, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.btnAltText}>{n.alertLater}</Text>
                </Pressable>
                <Pressable
                  onPress={onDone}
                  style={({ pressed }) => [styles.btn, { flex: 1, marginTop: 0 }, pressed && { opacity: 0.9 }]}
                >
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                  <Text style={styles.btnText}>{n.alertDone}</Text>
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(46,40,35,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    borderRadius: 28,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 30,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  iconWrap: {
    height: 76,
    width: 76,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.terracotta,
  },
  iconExpiry: { backgroundColor: colors.amber },
  kicker: {
    marginTop: 16,
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSoft,
  },
  body: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  didText: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSoft,
    textAlign: "center",
  },
  btnRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 12 },
  btn: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.terracotta,
  },
  btnText: { fontSize: 16, fontWeight: "800", color: colors.white },
  btnAlt: {
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
  },
  btnAltText: { fontSize: 15, fontWeight: "700", color: colors.inkSoft },
  btnAltWide: { alignSelf: "stretch", marginTop: 10 },
  addNewText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
    textAlign: "center",
  },
});
