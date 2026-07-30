import { Platform } from "react-native";
import notifee, { AndroidImportance, AndroidVisibility } from "@notifee/react-native";

import { supabase } from "./supabase";
import { reportError } from "./report-error";

/**
 * Push notification (FCM) — admin panel se aane wali khabar (item 8).
 *
 * App me pehle se jo notification aati thi wo sab **local** hai: reminder banate
 * waqt phone ke andar hi alarm set ho jaata hai (`notifications.ts`). Usme koi
 * server nahi, isliye wo bina internet ke bhi bajti hai — par isi wajah se admin
 * panel se kuch bheja nahi ja sakta tha.
 *
 * Ye file uska doosra hissa hai: har phone apna FCM token server ko de deta hai,
 * aur admin us token par message bhej sakta hai.
 *
 * ⚠️ Native module — Expo Go me nahi chalta, aur `google-services.json` ke bina
 * build hi fail hoga. Isliye har cheez `try/catch` me hai: Firebase set na ho to
 * app bilkul waise hi chalti rehti hai jaise pehle chalti thi (local reminders
 * par koi asar nahi).
 */

/** Channel wahi jo local reminders ka hai — HIGH importance, awaaz ke saath. */
const CHANNEL_ID = "reminders-fs";

/**
 * `@react-native-firebase/messaging` ko der se load karo.
 *
 * Seedha `import` karne par jis build me Firebase configure nahi hai wo start
 * hote hi crash kar jaata hai. Require yahan, andar, isliye rakha hai — module
 * na mile to bas `null` milta hai aur app chalti rehti hai.
 */
function messagingModule(): any | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-firebase/messaging").default;
  } catch {
    return null;
  }
}

/** Firebase is build me hai ya nahi. */
export function isPushAvailable(): boolean {
  return messagingModule() !== null;
}

/* --------------------------- token register --------------------------- */

// Ek session me ek hi baar server par bhejo — har screen focus par upsert
// bhejna bekaar ka network hai.
let lastSaved: string | null = null;

/**
 * Token server ko do.
 *
 * ⚠️ Yahan do bug the aur dono chup-chaap the:
 *
 * 1. `supabase.rpc()` fail hone par THROW nahi karta — wo `{ data, error }`
 *    lautata hai. Purana code sirf try/catch lagata tha, isliye har server-side
 *    fail (RPC hi na bani ho, RLS, session na ho) bina awaaz ke gum ho jaata.
 * 2. Fail hone ke baad bhi `lastSaved = token` set ho jaata tha — matlab us
 *    session me dobara koshish hoti hi nahi thi.
 *
 * Natija: `device_tokens` khaali reh jaati thi aur admin panel se bheji gayi
 * notification kisi ko nahi milti thi ("kisi ne app install nahi ki" wala
 * message), jabki asli wajah kuch aur hoti thi. Ab fail admin > Logs me dikhta
 * hai aur agli koshish bhi hoti hai.
 */
async function saveToken(token: string): Promise<void> {
  if (!token || token === lastSaved || !supabase) return;
  try {
    const { error } = await supabase.rpc("save_device_token", {
      p_token: token,
      p_platform: Platform.OS,
    });
    if (error) throw error;
    lastSaved = token;
  } catch (e) {
    // `lastSaved` jaan-boojh ke set NAHI karte — agla token refresh ya agla
    // login phir se koshish karega.
    reportError(e, { screen: "push", action: "save_device_token" }, "warn");
  }
}

/**
 * Login ke baad ek baar — is phone ka pata server ko do.
 *
 * Notification permission notifee pehle hi maang chuka hota hai (reliability
 * flow me), isliye yahan dobara nahi maangte — do popup lagatar aana bhadda
 * lagta hai. Permission na mili ho to `getToken()` waise bhi kaam ka nahi.
 *
 * Cleanup function lautata hai — `onTokenRefresh` ka listener band karne ke liye.
 */
export function registerPushToken(): () => void {
  const messaging = messagingModule();
  if (!messaging) return () => {};

  let alive = true;

  (async () => {
    try {
      const token = await messaging().getToken();
      if (alive) await saveToken(token);
    } catch (e) {
      // Firebase configure nahi hai ya permission nahi. Pehle ye bilkul chup
      // tha — isliye "notification kyun nahi aayi" ka jawab kahin nahi milta
      // tha. Ab kam se kam Logs me dikhta hai.
      reportError(e, { screen: "push", action: "get_token" }, "warn");
    }
  })();

  // ⚠️ Ye listener zaroori hai. Google token badalta rehta hai (app data clear,
  // restore, ya bas Google ka apna rotation). Purane token par bheja gaya
  // message chup-chaap gum ho jaata hai — user ko lagta hai notification aati
  // hi nahi.
  let unsub = () => {};
  try {
    unsub = messaging().onTokenRefresh((t: string) => {
      if (alive) void saveToken(t);
    });
  } catch {
    /* ignore */
  }

  return () => {
    alive = false;
    unsub();
  };
}

/* ---------------------------- foreground ---------------------------- */

/**
 * App KHULI ho tab aayi push ko khud dikhao.
 *
 * Android app band/background me ho to FCM ka `notification` payload OS khud
 * tray me daal deta hai. Par app foreground me ho to OS kuch nahi dikhata —
 * message seedha yahan aata hai. Bina iske admin ka message un logon tak
 * pahunchta hi nahi jo us waqt app use kar rahe hote hain.
 *
 * Cleanup function lautata hai.
 */
export function listenForegroundPush(): () => void {
  const messaging = messagingModule();
  if (!messaging) return () => {};

  try {
    return messaging().onMessage(async (msg: any) => {
      const title = msg?.notification?.title ?? msg?.data?.title;
      const body = msg?.notification?.body ?? msg?.data?.body;
      if (!title && !body) return;

      await notifee.createChannel({
        id: CHANNEL_ID,
        name: "Reminders",
        importance: AndroidImportance.HIGH,
        sound: "default",
        vibration: true,
        visibility: AndroidVisibility.PUBLIC,
      });

      await notifee.displayNotification({
        title: title ?? "Apka Saathi",
        body: body ?? "",
        // `kind: admin` — reminder-alert host isse pehchaan ke apna full-screen
        // "kaam ho gaya?" wala modal NAHI kholta. Admin ka message sirf ek
        // khabar hai, koi kaam nahi.
        data: { kind: "admin" },
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          pressAction: { id: "default" },
          sound: "default",
          // smallIcon jaan-boojh ke nahi diya: galat resource naam par notifee
          // notification dikhata hi nahi. Default wahi icon uthta hai jo
          // expo-notifications plugin app.json se generate karta hai — aur wahi
          // local reminders me bhi dikhta hai, isliye dono ek jaise lagte hain.
        },
        ios: { sound: "default" },
      });
    });
  } catch {
    return () => {};
  }
}
