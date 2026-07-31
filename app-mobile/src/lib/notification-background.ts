import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, { EventType, type Notification } from "@notifee/react-native";

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

if (Platform.OS !== "web") {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.DELIVERED && type !== EventType.PRESS) return;
    const n = detail.notification;
    if (!n?.id) return;
    try {
      await AsyncStorage.setItem(
        PENDING_ALERT_KEY,
        JSON.stringify({ at: Date.now(), notification: n }),
      );
    } catch {
      /* best-effort */
    }
  });
}

/** Background me rakhi gayi notification lo aur hata do (ek hi baar dikhe). */
export async function takePendingAlert(): Promise<Notification | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ALERT_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_ALERT_KEY);
    const saved = JSON.parse(raw) as { at?: number; notification?: Notification };
    if (!saved?.notification) return null;
    // Ghanton purani notification ka modal kholna user ko chaunka deta hai.
    if (!saved.at || Date.now() - saved.at > PENDING_ALERT_MAX_AGE_MS) return null;
    return saved.notification;
  } catch {
    return null;
  }
}
