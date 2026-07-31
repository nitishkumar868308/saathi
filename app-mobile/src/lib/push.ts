import { Platform } from "react-native";
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
} from "@notifee/react-native";

import { supabase } from "./supabase";
import { reportError } from "./report-error";
import { recordPushOpenFrom, routeFromPush } from "./message-track";

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
        //
        // `send_id` aage bhejna zaroori hai: foreground me notification hum khud
        // banate hain, aur agar ye id yahan chhoot jaye to us tap ka admin ki
        // report me koi nishaan hi nahi banega.
        // ⚠️ Server ka `data` jaisa ka taisa aage bhejna zaroori hai. Foreground
        // me notification hum KHUD banate hain, isliye jo yahan nahi likha wo
        // tap ke waqt hota hi nahi: `send_id` ke bina report me tap ka nishaan
        // nahi banta, aur `ticket_id` ke bina support ka jawab tap karne par
        // us baatcheet me khulta nahi.
        data: {
          kind: typeof msg?.data?.kind === "string" ? (msg.data.kind as string) : "admin",
          ...(typeof msg?.data?.send_id === "string"
            ? { send_id: msg.data.send_id as string }
            : {}),
          ...(typeof msg?.data?.ticket_id === "string"
            ? { ticket_id: msg.data.ticket_id as string }
            : {}),
        },
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

/* ------------------------------ tap tracking ------------------------------ */

/**
 * "Notification par tap hua" — admin ki Report ke liye (kisne khola, kisne nahi).
 *
 * Ek hi tap TEEN alag raaston se aata hai, aur teeno zaroori hain — ek bhi
 * chhoot jaye to us haalat wale saare users report me "ignore" dikhne lagenge:
 *
 *   1. App KHULI thi   — notification hum khud notifee se dikhate hain, isliye
 *                        tap notifee ka foreground PRESS ban ke aata hai.
 *   2. App PEECHE thi  — OS ne tray me dikhaya tha; Firebase ka
 *                        `onNotificationOpenedApp` batata hai.
 *   3. App BAND thi    — cold start; `getInitialNotification()` se milta hai.
 *
 * Dedupe `message-track.ts` me hai — cold-start par 2 aur 3 dono chal sakte hain.
 *
 * Login ke baad hi chalana chahiye: server ki RPC bina session ke kuch nahi
 * likhti (`auth.uid()` par tiki hai).
 */
export function listenPushOpens(): () => void {
  const stops: (() => void)[] = [];

  /**
   * Tap ka poora kaam: hisaab likho, aur jahan jaana ho wahan le jao.
   *
   * Router ko der se import karte hain (`require`) — is module ko headless/
   * background me bhi chhua ja sakta hai, aur wahan expo-router ka top-level
   * import bekaar ka bojh hai.
   */
  const handle = (data: unknown) => {
    recordPushOpenFrom(data);
    const to = routeFromPush(data);
    if (!to) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { router } = require("expo-router");
      router.push({ pathname: to.pathname, params: to.params });
    } catch {
      /* navigation abhi taiyaar nahi — notification phir bhi dikh chuki hai */
    }
  };

  // 1. Foreground — humari apni dikhayi hui notification par tap.
  try {
    stops.push(
      notifee.onForegroundEvent(({ type, detail }) => {
        if (type !== EventType.PRESS) return;
        handle(detail.notification?.data);
      }),
    );
  } catch {
    /* notifee na ho to chhod do */
  }

  const messaging = messagingModule();
  if (!messaging) return () => stops.forEach((s) => s());

  // 2. App background me thi.
  try {
    stops.push(
      messaging().onNotificationOpenedApp((msg: any) => handle(msg?.data)),
    );
  } catch {
    /* ignore */
  }

  // 3. App band thi — notification se hi khuli.
  try {
    messaging()
      .getInitialNotification()
      .then((msg: any) => handle(msg?.data))
      .catch(() => {});
  } catch {
    /* ignore */
  }

  return () => stops.forEach((s) => s());
}
