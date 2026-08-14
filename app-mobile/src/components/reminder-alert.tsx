import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Easing,
  ScrollView,
  AppState,
  type AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import notifee, { EventType, type Notification } from "@notifee/react-native";

import { makeStyles, useColors } from "@/theme/theme";
import { useToast } from "@/components/toast";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { alertUser, stopAlert } from "@/lib/alert-mode";
import { completeReminder, listReminders } from "@/lib/reminders";
import {
  cancelReminder,
  flushNotificationActions,
  quietenNotification,
  scheduleReminderSeries,
  snoozeReminder,
  takePendingAlert,
} from "@/lib/notifications";
import { baseReminderId, snoozeNotification } from "@/lib/notify-core";
import {
  ACTION_DONE,
  ACTION_LATER,
  alreadySpokenInBackground,
  queueNotificationAction,
} from "@/lib/notification-background";
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
  const toast = useToast();
  const [alert, setAlert] = useState<Alert | null>(null);
  const scale = useRef(new Animated.Value(0.9)).current;
  /**
   * Icon ke peeche dhadakti hui ring — alarm ka "abhi, isi waqt" wala ehsaas.
   *
   * ⚠️ Ye sirf sajawat nahi hai. Ye screen aksar tab khulti hai jab phone jeb se
   * nikala gaya hai aur user ne abhi PIN daala hai — us pal ek jamI hui screen
   * aur ek chalti hui screen me bahut farq hai. Chalti hui cheez aankh kheenchti
   * hai, aur user ko turant pata chalta hai ki KUCH HUA hai.
   */
  const ring = useRef(new Animated.Value(0)).current;
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
      /**
       * ⚠️ Tray ke button — app KHULI ho tab.
       *
       * `notifee.onBackgroundEvent` (jahan ye pehle se handle tha) sirf tab
       * chalta hai jab app saamne na ho. Yaani app khuli rakh ke shade neeche
       * kheencho aur "Ho gaya" dabao — kuch nahi hota tha, button bilkul mara
       * hua. Pehle ye kam dikhta tha kyunki notification modal khulte hi mit
       * jaati thi; ab wo chup parchi bankar tray me bani rehti hai, isliye ye
       * raasta sach me chalna chahiye.
       */
      if (type === EventType.ACTION_PRESS) {
        const pressId = detail.pressAction?.id;
        const notif = detail.notification;
        const nid = notif?.id;
        if ((pressId === ACTION_DONE || pressId === ACTION_LATER) && nid) {
          stopAlert();
          /**
           * ⚠️ Poora silsila ek hi async chain me — teeno kaam ek doosre par
           * tike hain aur inhe saath-saath chhod dena do alag bug banata tha
           * (dono neeche likhe hain).
           */
          void (async () => {
            if (pressId === ACTION_LATER) {
              // Snooze seedha yahin — bilkul waise hi jaise app band hone par
              // headless handler karta hai. Dono ek hi `snoozeNotification()` par
              // jaate hain, isliye "5 min baad" ka matlab dono jagah ek hi hai.
              await snoozeNotification(notif).catch(() => {});
              /**
               * ⚠️ `cancelNotification()` NAHI — sirf DIKH RAHI parchi hatao.
               *
               * Bilkul wahi baat jo `notification-background.ts` par likhi hai:
               * doosri baar "abhi nahi" dabane par saamne wali parchi khud
               * `snooze:<uuid>` hoti hai, aur naya alarm bhi usi id par lagta
               * hai — `cancelNotification()` use turant uda deta tha.
               */
              await notifee.cancelDisplayedNotification(nid).catch(() => {});
            } else {
              /**
               * ⚠️ `await` yahan ZAROORI hai (pehle `void` tha).
               *
               * `queueNotificationAction` kataar par read-then-write karta hai
               * aur `flushNotificationActions` usi key par read-then-CLEAR. Bina
               * await ke dono ek saath chalte the, aur "Ho gaya" aksar ya to
               * flush se pehle likha hi nahi jaata tha, ya likhne ke baad usi
               * clear me mit jaata tha. User ke liye ye "Ho gaya dabaya, phir bhi
               * reminder wahin pada hai" jaisa dikhta tha.
               */
              await queueNotificationAction(nid, "done").catch(() => {});
              // Wahi kataar jo app start par chalti hai — turant chala do, warna
              // "Ho gaya" ka asar agli baar app kholne tak dikhta hi nahi.
              await flushNotificationActions().catch(() => {});
              await notifee.cancelNotification(nid).catch(() => {});
            }
          })();
          // Modal isi reminder ka khula pada ho to use bhi hata do.
          if (handledId.current === nid) dismiss();
        }
        return;
      }
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
    /**
     * Alarm ki AWAAZ band karo — par tray ki parchi zinda rakho.
     *
     * ⚠️ Yahan pehle seedha `cancelNotification()` tha, aur wo aadha sahi tha.
     * Sahi hissa: reminder `loopSound` + `FLAG_INSISTENT` ke saath bajta hai,
     * yaani awaaz modal ke PEECHE bajti rehti aur user ko padhne ka mauka hi
     * nahi milta. Wo rukna hi chahiye.
     *
     * Galat hissa: uske saath notification bhi mar jaati thi. **Notification
     * aur full-screen alert do alag cheezein hain, aur dono chahiye** — modal us
     * LAMHE ke liye hai, aur tray ki parchi uske BAAD ke liye (jeb me pada
     * phone, meeting me chup kiya hua alert, ya modal jo galti se hat gaya).
     * Modal bina kuch kiye hat jaye to reminder poori tarah gayab ho jaata tha.
     *
     * `quietenNotification` dono kaam alag karta hai: chillane wali hatti hai,
     * aur usi id par ek chup parchi (wahi baat + wahi "Ho gaya / Baad me"
     * button) turant wapas baith jaati hai.
     */
    void quietenNotification(alert).catch(() => {});
    setStep("ask");
    setAi(null);
    scale.setValue(0.9);
    Animated.timing(scale, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();

    // Dhadkan — alert khule rehne tak chalti hai, band hote hi ruk jaati hai.
    ring.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    /**
     * Naam le ke bulao, phir reminder/document ka kaam bolo — user ko phone
     * uthake padhna na pade. Ring/vibrate/silent Settings se tay hota hai.
     *
     * ⚠️ Par sirf tab jab background me ye baat pehle se boli na ja chuki ho.
     * Ab notification aate hi (app khule bina) `notification-background.ts`
     * bolta hai; uske turant baad full-screen intent app ko saamne le aata hai
     * aur ye modal khulta hai. Bina is shart ke user ko wahi ek reminder do
     * baar sunayi deta — ek baar tray se, ek baar popup se — aur dono aawazein
     * ek doosre ke upar chadh jaati thi.
     */
    if (!alreadySpokenInBackground()) void alertUser(alert.body);
    return () => loop.stop();
  }, [alert, scale, ring]);

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
  /**
   * "5 min baad" — modal se.
   *
   * ⚠️ Ye button pehle sirf modal band karta tha, aur bas. Wahi shikayat thi ki
   * "DONE / NOT YET ke saath phir se bajane ka option hona chahiye" — asal me
   * haal usse bhi bura tha, kyunki button dikhta tha aur kuch karta hi nahi tha.
   *
   * Snooze wahi function lagata hai jo notification ke button se lagta hai, aur
   * alarm `AlarmManager` par baithta hai — yaani app band ho jaye ya phone band
   * ho jaye, 5 minute baad wo phir bhi bajta hai.
   */
  function snoozeAndClose() {
    if (alert && alert.kind === "reminder") {
      void snoozeReminder(alert.id, alert.body).then((ok) => {
        if (ok) toast.show(n.alertSnoozed, "info");
      });
    }
    dismiss();
  }

  function dismiss() {
    stopAlert();
    setAlert(null);
    setAi(null);
    setStep("ask");
    /**
     * ⚠️ `handledId` yahan saaf karna zaroori hai.
     *
     * Wo guard sirf ek daud ke liye hai: ek hi notification par DELIVERED,
     * PRESS aur pending-alert — teenon milli-second ke andar aa sakte hain, aur
     * bina guard ke modal teen baar khulta.
     *
     * Par modal band karne ke BAAD wo guard ulta nuksan karta hai. Ab tray me
     * chup parchi bachi rehti hai (`quietenNotification`), aur user ka use tap
     * karke wapas "Ho gaya / Baad me" par aana bilkul sahi hai — guard laga
     * rehta to wo tap kabhi kuch nahi karta.
     *
     * Purana pending alert wapas nahi khul sakta: `takePendingAlert()` padhte hi
     * use storage se hata deta hai.
     */
    handledId.current = null;
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
    /**
     * ⚠️ `baseReminderId` — seedha `alert.id` nahi.
     *
     * Do tarah ke suffix/prefix lagte hain aur dono server par bekaar hain:
     * repeat wale reminder ka `<uuid>#3`, aur snooze wala `snooze:<uuid>`.
     * Seedha bhej dena ek chupa hua bug tha — `complete_reminder("<uuid>#3")`
     * kabhi chalta hi nahi (wo valid uuid hai hi nahi), yaani roz wale reminder
     * me "Ho gaya" pehle din ke baad kabhi kaam nahi karta tha.
     */
    const id = alert?.kind === "reminder" ? baseReminderId(alert.id) : null;
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
    /**
     * ── Poori screen, chhota card nahi ──────────────────────────────────
     *
     * ⚠️ Ye badlaav seedha user ki baat se aaya: "full screen jaise Rapido ya
     * AstroTalk pe chalta hai waisa chahiye… abhi PIN daalte hi seedha page
     * khul jaata hai, ye nahi chahiye — alag layout chahiye jisse user ko pata
     * chale ki hua KYA hai, aur click kare tab kuch ho".
     *
     * Baat bilkul theek thi. Pehle ye ek chhota sa card tha jo app ki kisi bhi
     * screen ke UPAR khulta tha. Alarm ke us pal me — phone jeb se nikla hai,
     * PIN daala gaya hai — user ko peeche ki poori app dikhti thi aur beech me
     * ek chhoti parchi. Uska matlab wo ek aam popup samajh ke hata deta tha, ya
     * peeche ki screen padhne lagta tha. Incoming-call jaisi screen wo galti
     * hone hi nahi deti: pehle poora sandesh, phir do bade button, aur tab tak
     * kuch nahi hota jab tak wo khud na dabaye.
     *
     * `transparent={false}` — background sach me poori screen dhakta hai. Bas
     * itna hi kaafi hai; dono platform par yahi default full-screen modal hai.
     *
     * ⚠️ Yahan `presentationStyle="fullScreen"` mat jodna. Wo sirf iOS par asar
     * karta hai aur `transparent` ko poori tarah anadekha kar deta hai — yaani
     * ek aur vyavhaar jo do platform par do tarah se chalta hai. Ye app ki sabse
     * zaroori screen hai (alarm ka wahi ek lamha); yahan jitne kam anjaan
     * hisse, utna behtar.
     */
    <Modal
      statusBarTranslucent
      navigationBarTranslucent
      transparent={false}
      animationType="fade"
      visible
      onRequestClose={dismiss}
    >
      <SafeAreaView style={[styles.screen, isExpiry && styles.screenExpiry]} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          // Lamba reminder (ya Hindi ka lamba wakya) chhoti screen par kat na
          // jaye — us haal me hi user ko sabse zyada padhna hota hai.
          bounces={false}
        >
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.iconStack}>
            {/* Dhadakti hui ring — icon ke peeche se bahar ki taraf. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulse,
                isExpiry && styles.pulseExpiry,
                {
                  opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                  transform: [
                    { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) },
                  ],
                },
              ]}
            />
            <View style={[styles.iconWrap, isExpiry && styles.iconExpiry]}>
              {/*
                ⚠️ Rang icon ke saath badalta hai. Reminder ka gol terracotta ka
                hai (gehra) — uspar safed theek hai. Par expiry wala AMBER ka
                hai, jo dono theme me ujla hai: wahan safed icon 1.9:1 (light)
                aur 1.6:1 (dark) par tha — yaani app ki sabse zaroori screen ka
                sabse bada icon hi sabse dhundhla.
              */}
              <Ionicons
                name={isExpiry ? "document-text" : "alarm"}
                size={44}
                color={isExpiry ? tc.onAccent : tc.white}
              />
            </View>
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
                  onPress={snoozeAndClose}
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
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  /**
   * Poori screen — aur uska apna background.
   *
   * ⚠️ `cream` (page ka aam rang) yahan JAAN-BOOJH KE nahi hai. Ye screen app ki
   * baaki screens jaisi dikhni hi nahi chahiye: user ko ek nazar me pata chalna
   * chahiye ki ye "app" nahi, ek ALERT hai. Halka rangeen parda wahi kaam karta
   * hai jo incoming-call screen ka rang karta hai.
   */
  screen: { flex: 1, backgroundColor: c.creamDeep },
  screenExpiry: { backgroundColor: c.creamDeep },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  card: {
    width: "100%",
    // Tablet/foldable par content beech me hi rehna chahiye — poori chaudai me
    // phaila hua alert padha hi nahi jaata.
    maxWidth: 460,
    alignItems: "center",
  },
  /** Ring + icon ek hi jagah par — ring peeche, icon uske upar. */
  iconStack: { alignItems: "center", justifyContent: "center" },
  pulse: {
    position: "absolute",
    height: 100,
    width: 100,
    borderRadius: 34,
    backgroundColor: c.terracotta,
  },
  pulseExpiry: { backgroundColor: c.amber },
  iconWrap: {
    // 76 → 100: ye screen ki sabse pehli cheez hai jo aankh pakadti hai.
    height: 100,
    width: 100,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  iconExpiry: { backgroundColor: c.amber },
  kicker: {
    marginTop: 26,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: c.terracotta,
  },
  /**
   * ⚠️ 20 → 26px. Poori screen mil gayi hai to uska poora faayda yahi hai:
   * reminder ka matn door se, bina chashme ke, padha ja sake. Yahi ek line hai
   * jiske liye ye screen khuli hai.
   */
  body: {
    marginTop: 12,
    fontSize: 26,
    lineHeight: 36,
    fontWeight: "800",
    color: c.ink,
    textAlign: "center",
  },
  didText: {
    marginTop: 26,
    fontSize: 15,
    fontWeight: "600",
    color: c.inkSoft,
    textAlign: "center",
  },
  btnRow: { flexDirection: "row", gap: 12, alignSelf: "stretch", marginTop: 18 },
  /**
   * Button bade — 52 se 60.
   *
   * ⚠️ Ye screen aksar aadhi neend me, ya chalte-chalte dabai jaati hai. Us haal
   * me chhota button galat dab jaata hai, aur yahan galat dabna mehnga hai:
   * "Ho gaya" wapas nahi aata.
   */
  btn: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    height: 60,
    borderRadius: 20,
    backgroundColor: c.terracotta,
  },
  btnText: { fontSize: 17, fontWeight: "800", color: c.white },
  btnAlt: {
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 22,
  },
  btnAltText: { fontSize: 16, fontWeight: "700", color: c.inkSoft },
  btnAltWide: { alignSelf: "stretch", marginTop: 12 },
  addNewText: {
    marginTop: 16,
    fontSize: 14.5,
    lineHeight: 21,
    color: c.inkSoft,
    textAlign: "center",
  },
}));
