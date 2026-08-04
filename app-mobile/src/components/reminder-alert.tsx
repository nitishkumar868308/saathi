import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Easing,
  AppState,
  type AppStateStatus,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import notifee, { EventType, type Notification } from "@notifee/react-native";

import { makeStyles, useColors } from "@/theme/theme";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { alertUser, stopAlert } from "@/lib/alert-mode";
import { completeReminder, listReminders } from "@/lib/reminders";
import { cancelReminder, scheduleReminderSeries, takePendingAlert } from "@/lib/notifications";
import { acknowledgeDocument, renewDocument } from "@/lib/doc-ack";
import { emitDataChanged } from "@/lib/data-events";
import { documentFollowUp, type DocFollowUp } from "@/lib/ai";
import { listDocuments } from "@/lib/documents";

type Alert = { id: string; title: string; body: string; kind: "reminder" | "expiry" };

function fromNotification(n?: Notification | null): Alert | null {
  if (!n) return null;
  const data = (n.data ?? {}) as { kind?: string; body?: string; id?: string };

  // ⚠️ Sirf reminder aur expiry ka hi full-screen alert khulna chahiye.
  //
  // Baaki har notification (admin ka broadcast, support ka jawab) ek khabar hai,
  // koi "kaam" nahi — uska na koi reminder id hota hai na document. Bina is
  // guard ke wo neeche reminder maan li jaati aur user ko "Ye kaam ho gaya?"
  // wala modal dikh jaata; "Ho gaya" dabate hi app ek jhoothe id par
  // `complete_reminder` chala deti.
  //
  // Pehle yahan sirf `kind === "admin"` roka jaata tha. Wo ek allow-list nahi
  // block-list thi, aur usi wajah se support wali nayi notification (kind:
  // "support") is guard se nikal jaati — har jawab par ek jhootha reminder
  // alert. Ab ulta: jo pehchaane hue nahi hain, sab bahar.
  if (data.kind !== "reminder" && data.kind !== "expiry") return null;

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
 * Notification id se ASLI reminder id.
 *
 * ⚠️ Roz/har-hafte wale reminder ke har occurrence ka apna notification id hota
 * hai — pehla `<uuid>`, uske baad `<uuid>#1`, `<uuid>#2`… (`notifications.ts`
 * ka `occId`). Ye suffix seedha server par bhej dena ek chupa hua bug tha:
 * `complete_reminder("<uuid>#3")` kabhi chalta hi nahi (wo valid uuid hai hi
 * nahi), aur `cancelReminder("<uuid>#3")` galat alarm dhoondhta tha.
 *
 * Yaani roz wale reminder me pehle din "Ho gaya" kaam karta tha, aur uske baad
 * kisi bhi din nahi — server par kuch nahi jaata tha aur agle din wahi reminder
 * phir aa jaata tha. Suffix yahan hata dete hain.
 */
function reminderIdFrom(identifier: string): string {
  return identifier.split("#")[0];
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
  const tc = useColors();
  const styles = useStyles();
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

    // Background me aayi notification — full-screen intent app ko saamne le
    // aata hai par uska koi foreground event nahi aata. `onBackgroundEvent`
    // usko rakh deta hai, hum yahan uthate hain.
    const showPending = () => {
      void takePendingAlert().then(show);
    };
    showPending();

    /**
     * ⚠️ App BAND thi wali soorat me ek daud lagti hai.
     *
     * Notifee ka headless task (jo pending alert LIKHTA hai) aur app ka
     * cold-start (jo use PADHTA hai) ek saath chalte hain. Upar wali ek hi
     * koshish aksar likhne se pehle ho jaati thi — storage khaali milta tha,
     * aur reminder ka bada alert kabhi dikhta hi nahi tha. AppState bhi kaam
     * nahi aata: app pehle se "active" hai, isliye koi change event nahi aata.
     *
     * Isliye pehle kuch second thodi-thodi der me dobara dekhte hain. Alert
     * mil gaya to loop wahin ruk jaata hai — koi bekaar ka kaam nahi.
     */
    const retries: ReturnType<typeof setTimeout>[] = [];
    [400, 1000, 2000, 3500].forEach((ms) => {
      retries.push(
        setTimeout(() => {
          if (alive && handledId.current === null) showPending();
        }, ms),
      );
    });

    const appSub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") showPending();
    });

    return () => {
      alive = false;
      unsub();
      appSub.remove();
      retries.forEach(clearTimeout);
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
    // Roz wale reminder me notification id `<uuid>#3` jaisi hoti hai — server
    // ko hamesha bina suffix wali asli id chahiye.
    const id = alert?.kind === "reminder" ? reminderIdFrom(alert.id) : null;
    const title = alert?.body ?? "";
    dismiss();
    if (!id) return;
    void (async () => {
      try {
        const next = await completeReminder(id);
        if (next) {
          /**
           * ⚠️ Yahan pehle `scheduleReminderSeries(id, title, next, null, null)`
           * tha — yaani repeat ki jaankari GIRA di jaati thi aur sirf EK alarm
           * lagta tha.
           *
           * Roz wale reminder me iska matlab ye tha: pehle 14 alarm lage hote
           * the (REPEAT_WINDOW), aur "Ho gaya" dabate hi `scheduleReminderSeries`
           * pehle purane saare cancel karta aur uske badle sirf ek naya lagata.
           * Yaani full-screen alarm par "Ho gaya" dabana — jo sabse aam jagah hai
           * — har baar khidki 14 se ghata ke 1 kar deta tha. Us ek ke baad user
           * ke app kholne tak koi alarm bachta hi nahi tha.
           *
           * Reminders tab ka "Ho gaya" ye galti kabhi nahi karta tha, wo apne
           * row ke repeat fields bhejta hai. Alert ke paas wo fields hote hi
           * nahi (notification me sirf id aur text aata hai), isliye reminder
           * padh ke wahi fields yahan bhi laga dete hain.
           */
          const row = (await listReminders().catch(() => [])).find((x) => x.id === id);
          await scheduleReminderSeries(
            id,
            row?.title || title,
            new Date(next),
            row?.repeat_every_days ?? null,
            row?.repeat_until ?? null,
          );
        } else await cancelReminder(id);
      } catch {
        // Net na ho to alarm to hata hi do — user ne kaam kar liya hai, usse
        // wahi notification dobara dena sabse chidhchida hoga. Server agli sync
        // par apne aap sahi ho jaayega.
        await cancelReminder(id).catch(() => {});
      } finally {
        // ⚠️ Modal poore app ke UPAR khulta hai — peeche wali screen ka focus
        // kabhi jaata hi nahi, isliye `useFocusEffect` wala reload chalta hi
        // nahi tha. Home par wahi nipta hua reminder tab tak dikhta rehta tha
        // jab tak user kisi doosre tab pe ho aake na aa jaye (item 2).
        emitDataChanged();
      }
    })();
  }

  /** Expiry: "haan, ho gaya" — aage ke sab reminder band + naya daalne ko kaho. */
  function onDocDone() {
    stopAlert();
    const docId = alert ? docIdFrom(alert.id) : null;
    if (docId) void renewDocument(docId).finally(emitDataChanged);
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
              color={tc.white}
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
                    <Ionicons name="checkmark" size={18} color={tc.white} />
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
                      <Ionicons name="camera" size={18} color={tc.white} />
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
                  <Ionicons name="checkmark" size={18} color={tc.white} />
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

const useStyles = makeStyles((c) => ({
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
    backgroundColor: c.surface,
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
    backgroundColor: c.terracotta,
  },
  iconExpiry: { backgroundColor: c.amber },
  kicker: {
    marginTop: 16,
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: c.inkSoft,
  },
  body: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    color: c.ink,
    textAlign: "center",
  },
  didText: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: "600",
    color: c.inkSoft,
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
    backgroundColor: c.terracotta,
  },
  btnText: { fontSize: 16, fontWeight: "800", color: c.white },
  btnAlt: {
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 18,
  },
  btnAltText: { fontSize: 15, fontWeight: "700", color: c.inkSoft },
  btnAltWide: { alignSelf: "stretch", marginTop: 10 },
  addNewText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: c.inkSoft,
    textAlign: "center",
  },
}));
