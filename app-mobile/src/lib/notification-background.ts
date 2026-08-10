import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, { EventType, type Notification } from "@notifee/react-native";

import { alertUser } from "./alert-mode";

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

/** Itni purani notification ka modal ab dikhana bhadda lagta hai. */
const PENDING_ALERT_MAX_AGE_MS = 30 * 60_000;

/**
 * Awaaz kis notification par ho — reminder/expiry par, baaki par nahi.
 *
 * Admin ka broadcast ya support ka jawab ek KHABAR hai; wo aate hi bolne lagna
 * chidhchida hai (aur aksar raat me aata hai). Reminder aur document ki expiry
 * hi wo do cheezein hain jinke liye user ne khud kaha tha ki "yaad dilana".
 */
function shouldSpeak(n: Notification): boolean {
  const kind = (n.data as { kind?: string } | undefined)?.kind;
  return kind === "reminder" || kind === "expiry";
}

if (Platform.OS !== "web") {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.DELIVERED && type !== EventType.PRESS) return;
    const n = detail.notification;
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
