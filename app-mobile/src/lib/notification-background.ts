import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, { EventType, type Notification } from "@notifee/react-native";

import { alertUser, stopAlert } from "./alert-mode";
/**
 * ⚠️ Sirf `notify-core` — `notifications.ts` yahan KABHI import mat karna.
 *
 * Ye file ek headless task me chalti hai (upar poori wajah likhi hai), aur
 * `notifications.ts` apne saath supabase, reminders aur documents ka poora stack
 * le aati hai. `notify-core` me sirf notifee hai, isliye wo yahan surakshit hai —
 * aur usi ki wajah se snooze app band hone par bhi lag jaata hai.
 */
import { ACTION_DONE, ACTION_LATER, snoozeNotification } from "./notify-core";

export { ACTION_DONE, ACTION_LATER };

/**
 * Notifee ka background/headless event handler — app ke BAAHAR wala hissa.
 *
 * ⚠️ Ye file jaan-boojh ke alag hai aur `index.js` se SABSE PEHLE import hoti
 * hai. Wajah ek asli bug thi:
 *
 * Notifee ka Android side jab app foreground me nahi hoti to event ko ek
 * **headless JS task** ki tarah chalata hai (NotifeeEventSubscriber.java). Wo
 * task JS bundle boot karke `backgroundEventHandler` dhoondhta hai — jo tabhi
 * mila hoga jab kisi module ne bundle evaluate hote waqt
 * `notifee.onBackgroundEvent()` call kar diya ho.
 *
 * Pehle ye call `lib/notifications.ts` me thi, jise sirf `app/_layout.tsx`
 * import karta hai. Par expo-router route files ko **lazy** load karta hai:
 * headless task me koi component render hi nahi hota, isliye `_layout.tsx`
 * kabhi evaluate nahi hota, aur handler kabhi register nahi hota. Notifee bas
 * "no background event handler has been set" warning chhod deta tha.
 *
 * Natija (aur yahi sabse zyada shikayat wali baat thi): app ko recents se hata
 * do, reminder ka waqt aaye — alarm to bajta tha, screen bhi jaagti thi, par
 * reminder ka BADA full-screen alert kabhi nahi aata tha.
 *
 * Ab handler bundle ke pehle hi lamhe me lag jaata hai — chahe app khuli ho,
 * peeche ho, ya bilkul band.
 *
 * Yahan koi bhaari import mat jodna (supabase, reminders, documents…): headless
 * task me ye poora module chalega, aur har extra import wahan waqt aur memory
 * dono kharch karta hai.
 */

/** App band/background me aayi notification — resume par modal dikhane ke liye. */
const PENDING_ALERT_KEY = "saathi-pending-alert";

/**
 * Notification ke button se kiye gaye kaam — app khulne par server tak jaayenge.
 *
 * ⚠️ Ye kataar isliye zaroori hai ki ye handler ek **headless task** me chalta
 * hai. Wahan Supabase ka client banana matlab poora auth/session/network stack
 * boot karna — sasta phone us der me alarm ka pehla lamha hi kha jaata hai, aur
 * task khatam hote hi Android process gira deta hai (yaani aadhi bheji hui
 * request beech me hi mar jaati hai).
 *
 * Isliye yahan sirf ek chhoti si line likhi jaati hai; asli kaam app khulne par
 * hota hai (`flushNotificationActions`).
 */
const PENDING_ACTIONS_KEY = "saathi-notif-actions";

/** Itni purani notification ka modal ab dikhana bhadda lagta hai. */
const PENDING_ALERT_MAX_AGE_MS = 30 * 60_000;

export type PendingAction = {
  /** Notification id — repeat wale reminder me `<uuid>#3` bhi ho sakta hai. */
  id: string;
  action: "done" | "later";
  at: number;
};

/**
 * Awaaz kis notification par ho — reminder/expiry par, baaki par nahi.
 *
 * Admin ka broadcast ya support ka jawab ek KHABAR hai; wo aate hi bolne lagna
 * chidhchida hai (aur aksar raat me aata hai). Reminder aur document ki expiry
 * hi wo do cheezein hain jinke liye user ne khud kaha tha ki "yaad dilana".
 */
function shouldSpeak(n: Notification): boolean {
  const data = n.data as { kind?: string; quiet?: string } | undefined;
  /**
   * ⚠️ Chup parchi par kabhi nahi bolna.
   *
   * Full-screen alert khulte hi `quietenNotification()` chillane wali
   * notification hata ke usi id par ek chup copy baitha deta hai (taaki awaaz to
   * ruke par khabar tray me bani rahe). Wo copy bhi ek DELIVERED event bhejti
   * hai — aur bina is shart ke Saathi wahi reminder DOBARA bol deta, theek modal
   * khulne ke lamhe par.
   */
  if (data?.quiet) return false;
  const kind = data?.kind;
  return kind === "reminder" || kind === "expiry";
}

/**
 * Button ka kaam kataar me daal do — app khulte hi server tak jayega.
 *
 * ⚠️ Ye ab `export` hai, aur uski ek asli wajah hai. `onBackgroundEvent` sirf
 * tab chalta hai jab app SAAMNE NA HO. Yaani app khuli ho aur user notification
 * shade neeche kheench ke "Ho gaya" dabaye, to ye handler chalta hi nahi aur
 * button bilkul bekaar ho jaata hai. Foreground wala listener
 * (`reminder-alert.tsx`) ab isi function se wahi kataar bharta hai, taaki dono
 * raaste ek hi jagah pahunchein.
 */
export async function queueNotificationAction(
  id: string,
  action: "done" | "later",
): Promise<void> {
  return queueAction(id, action);
}

async function queueAction(id: string, action: "done" | "later"): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
    const list = raw ? (JSON.parse(raw) as PendingAction[]) : [];
    const rest = Array.isArray(list) ? list.filter((x) => x.id !== id) : [];
    rest.push({ id, action, at: Date.now() });
    await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(rest));
  } catch {
    /* best-effort */
  }
}

/** Kataar khaali karke lauta do — app start par ek hi baar chalta hai. */
export async function takeNotificationActions(): Promise<PendingAction[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(PENDING_ACTIONS_KEY);
    const list = JSON.parse(raw) as PendingAction[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

if (Platform.OS !== "web") {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const n = detail.notification;

    /**
     * ── Notification ke button (app khole bina) ──────────────────────────
     *
     * ⚠️ Yahan `cancelNotification` sirf saaf-safai nahi hai — wo AWAAZ BAND
     * karta hai. Reminder ab `loopSound` + `FLAG_INSISTENT` ke saath bajta hai,
     * yaani awaaz tab tak chalti rehti hai jab tak notification hat na jaye.
     * Bina is line ke button dabane par alarm bajta hi rehta.
     */
    if (type === EventType.ACTION_PRESS) {
      const pressId = detail.pressAction?.id;
      if (pressId === ACTION_DONE || pressId === ACTION_LATER) {
        stopAlert();
        if (n?.id) {
          /**
           * ⚠️ "5 min baad" ka alarm YAHIN, ISI LAMHE lag jaata hai — kataar ke
           * bharose nahi.
           *
           * Ye us bug ka asli hissa hai jo sabse aam soorat me dikhta tha. Pehle
           * yahan sirf `queueAction(id, "later")` chalta tha, aur asli snooze
           * `flushNotificationActions()` lagata tha — jo TABHI chalta hai jab
           * user APP KHOLE. Yaani lock screen se "abhi nahi" dabao, phone jeb me
           * rakho, aur 5 minute to kya, kabhi kuch nahi bajta. Snooze sirf tab
           * lagta jab user khud app kholta — aur tab tak use yaad dilane ki
           * zaroorat hi nahi bachti.
           *
           * `snoozeNotification` poori tarah self-contained hai (na network, na
           * DB) aur alarm `AlarmManager` par baithta hai, jo OS ke paas hai.
           * Iske baad app band ho jaye, phone band ho jaye, ya user recents se
           * app hata de — alarm phir bhi bajta hai.
           *
           * Kataar phir bhi bharte hain, par ab uska kaam sirf itna hai ki
           * SERVER ko baad me pata chale (Plus wale ka email/WhatsApp usi par
           * chalta hai). Alarm uska intezaar nahi karta.
           */
          if (pressId === ACTION_LATER) {
            await snoozeNotification(n).catch(() => {});
            // ⚠️ Kataar me kuch NAHI daalte. "Later" ka server par koi matlab hai
            // hi nahi (wahan sirf "done" kaam karta hai), aur daal dene par app
            // khulne par `flushNotificationActions` DOBARA snooze laga deta —
            // yaani alarm 5 minute aur aage sarak jaata, har baar app kholne par.
            //
            /**
             * ⚠️ Yahan `cancelNotification()` NAHI — sirf DIKH RAHI parchi hatao.
             *
             * `cancelNotification()` do kaam karta hai: dikh rahi parchi hatata
             * hai AUR us id par laga trigger bhi uda deta hai. Doosra kaam yahan
             * seedha nuksan karta tha, kyunki `snoozeNotification()` naya alarm
             * `snooze:<uuid>` id par lagata hai — aur DOOSRI baar "abhi nahi"
             * dabane par jo parchi saamne hoti hai wo KHUD `snooze:<uuid>` hi
             * hoti hai. Dono id hubahu ek, isliye abhi-abhi laga hua alarm usi
             * lamhe mit jaata tha.
             *
             * Nateeja bilkul chup tha: pehli baar "abhi nahi" theek chalta,
             * doosri baar reminder hamesha ke liye khatam — na koi error, na
             * koi nishaan.
             *
             * Awaaz phir bhi rukti hai: `loopSound`/`FLAG_INSISTENT` wali awaaz
             * DIKH RAHI notification se bandhi hai, aur wahi hata rahe hain.
             */
            await notifee.cancelDisplayedNotification(n.id).catch(() => {});
          } else {
            await queueAction(n.id, "done");
            await notifee.cancelNotification(n.id).catch(() => {});
          }
        }
      }
      return;
    }

    // Notification par tap — awaaz rok do, app ab khul rahi hai.
    if (type === EventType.PRESS || type === EventType.DISMISSED) stopAlert();

    if (type !== EventType.DELIVERED && type !== EventType.PRESS) return;
    if (!n?.id) return;

    /**
     * ── Awaaz APP KHOLE BINA ────────────────────────────────────────────
     *
     * ⚠️ Ye pehle sirf app ke ANDAR hota tha (`reminder-alert.tsx` modal khulne
     * par `alertUser()` bulata hai). Uska matlab ye tha ki Saathi tabhi bolta
     * tha jab full-screen intent app ko poori tarah kholne me kaamyab ho jaye —
     * aur wo har baar nahi hota: screen band/locked ho, ya OEM ka battery saver
     * full-screen intent ko aam notification bana de, to popup aata hi nahi aur
     * uske saath awaaz bhi nahi aati. User ke liye reminder ek chup patti bankar
     * tray me pada rehta tha.
     *
     * Ab bolna notification AANE par hota hai, popup khulne par nahi. Ye
     * headless task hai — app band ho tab bhi chalta hai.
     *
     * `spokenAt` isliye likhte hain: agar iske baad app sach me khul jaye to
     * modal wahi baat DOBARA na bole. Do baar sunna ek hi baar se bhi bura hai.
     */
    let spokenAt: number | null = null;
    if (type === EventType.DELIVERED && shouldSpeak(n)) {
      try {
        // Intezaar jaan-boojh ke: headless task jaldi khatam ho jaye to Android
        // process gira deta hai aur awaaz beech me kat jaati hai.
        await alertUser(n.body ?? "");
        spokenAt = Date.now();
      } catch {
        /* TTS na chale to notification ki apni awaaz to bajti hi hai */
      }
    }

    try {
      await AsyncStorage.setItem(
        PENDING_ALERT_KEY,
        JSON.stringify({
          at: Date.now(),
          spokenAt,
          notification: n,
        }),
      );
    } catch {
      /* best-effort */
    }
  });
}

/**
 * Is notification ki awaaz background me aa chuki hai?
 *
 * App khulne par modal isse poochh ke chup rehta hai. Waqt ki shart isliye ki
 * user notification ko ghanton baad bhi tap kar sakta hai — tab tak wo purani
 * awaaz bhool chuka hota hai aur dobara sunna theek hai.
 */
const SPOKEN_FRESH_MS = 60_000;
let lastSpokenAt = 0;

export function alreadySpokenInBackground(): boolean {
  return lastSpokenAt > 0 && Date.now() - lastSpokenAt < SPOKEN_FRESH_MS;
}

/** Background me rakhi gayi notification lo aur hata do (ek hi baar dikhe). */
export async function takePendingAlert(): Promise<Notification | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ALERT_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_ALERT_KEY);
    const saved = JSON.parse(raw) as {
      at?: number;
      spokenAt?: number | null;
      notification?: Notification;
    };
    if (!saved?.notification) return null;
    // Ghanton purani notification ka modal kholna user ko chaunka deta hai.
    if (!saved.at || Date.now() - saved.at > PENDING_ALERT_MAX_AGE_MS) return null;
    // Background me bol chuke the? To modal chup rahega (upar wajah likhi hai).
    if (saved.spokenAt) lastSpokenAt = saved.spokenAt;
    return saved.notification;
  } catch {
    return null;
  }
}
