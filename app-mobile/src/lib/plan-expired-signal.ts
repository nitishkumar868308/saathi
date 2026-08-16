/**
 * "Plus khatam" wali notification par tap hua — screen tak khabar pahunchane ka
 * ek chhota sa raasta.
 *
 * ⚠️ Ye alag file isliye hai, aur iske bina ek asli soorat chhoot jaati hai.
 * Tap TEEN alag raaston se aata hai (poori list `lib/push.ts` ke
 * `listenPushOpens()` par likhi hai), aur unme se sirf EK notifee ka hai:
 *
 *   1. App KHULI thi   — notification hum khud notifee se dikhate hain, isliye
 *                        tap notifee ka foreground event ban ke aata hai.
 *   2. App PEECHE thi  — notification OS ne tray me dikhayi thi; tap Firebase ke
 *                        `onNotificationOpenedApp` se aata hai. **Notifee ko wo
 *                        notification dikhti hi nahi.**
 *   3. App BAND thi    — cold start; Firebase ke `getInitialNotification()` se.
 *
 * Yaani screen agar sirf notifee sunti, to (2) aur (3) — jo sabse aam hain —
 * chup-chaap gir jaate: user tap karta, app khulti, aur kuch na hota.
 *
 * `pending` isliye hai ki cold start me tap screen ke mount hone se PEHLE aa
 * jaata hai. Bina uske wo khabar kisi ke sunne se pehle hi guzar jaati.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Tap aa chuka hai par abhi tak kisi ne uthaya nahi (cold start). */
let pending = false;

/** `lib/push.ts` isse bulata hai jab tap ka `kind` "plan_expired" ho. */
export function signalPlanExpired(): void {
  if (listeners.size === 0) {
    pending = true;
    return;
  }
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // Ek listener ka fail baaki ko na roke — ye khabar dene ka raasta hai,
      // koi kaam nahi.
    }
  });
}

/**
 * Khabar suno. Wapas milne wala function sunna band kar deta hai.
 *
 * Mount hote hi ek `pending` tap pada mile to wo bhi turant mil jaata hai (aur
 * saaf ho jaata hai — ek tap ek hi baar chalta hai).
 */
export function onPlanExpiredSignal(l: Listener): () => void {
  listeners.add(l);
  if (pending) {
    pending = false;
    try {
      l();
    } catch {
      /* upar wali hi wajah */
    }
  }
  return () => {
    listeners.delete(l);
  };
}
