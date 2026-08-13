import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, {
  AlarmType,
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  AndroidFlags,
  AuthorizationStatus,
  TriggerType,
  type TimestampTrigger,
} from "@notifee/react-native";

import { completeReminder, listReminders } from "./reminders";
import { ensureDeviceState } from "./device-approval";
import { emitDataChanged } from "./data-events";
import { listDocuments } from "./documents";
import { reportError } from "./report-error";
import { dictionaries, DEFAULT_LOCALE, tpl, type Locale } from "./i18n/dictionaries";
// Background/headless handler ab `index.js` se sabse pehle lagta hai. Yahan se
// sirf takePendingAlert aage bheja jaata hai (purane import na tootein).
import {
  ACTION_DONE,
  ACTION_LATER,
  takeNotificationActions,
  takePendingAlert,
} from "./notification-background";

export { takePendingAlert };

/**
 * Notifications — ab @notifee/react-native se.
 *
 * Kyun notifee: reminder ke waqt LOCK SCREEN par alarm-jaisa FULL-SCREEN popup
 * chahiye tha (item 7). expo-notifications `setFullScreenIntent` support nahi
 * karta; notifee `android.fullScreenAction` se karta hai. Screen band/locked ho
 * tab bhi app khul ke poora alert dikhata hai (MainActivity par showWhenLocked +
 * turnScreenOn flags config-plugin se lagte hain).
 *
 * Text user ki chuni bhasha me (AsyncStorage "saathi-locale").
 *
 * ⚠️ Native module — Expo Go me nahi chalta. Dev/prod build (EAS) chahiye.
 */

/** Notification text user ki chuni bhasha me. */
async function notifDict() {
  let loc: Locale = DEFAULT_LOCALE;
  try {
    const saved = await AsyncStorage.getItem("saathi-locale");
    if (saved === "hi" || saved === "en" || saved === "hinglish") loc = saved;
  } catch {
    /* default */
  }
  return dictionaries[loc].notif;
}

/**
 * Reminder ka channel.
 *
 * ⚠️ Naam me `v2` hai, aur ye jaan-boojh ke hai — ise badalna hi EK MAATR tareeka
 * hai channel ki settings badalne ka. Android me ek baar bana hua channel
 * **kabhi nahi** badalta: `createChannel()` dobara chalao to importance, sound,
 * vibration, bypassDnd — sab chup-chaap anadekha ho jaata hai (user ke haath me
 * chhod diya jaata hai, jo theek bhi hai).
 *
 * Iska seedha matlab ye tha ki purane `reminders-fs` channel wale har phone par
 * neeche ke saare sudhaar (alarm-jaisi awaaz, DND se chhoot, tez vibration)
 * bekaar the — code me maujood, phone par kabhi lagu nahi. Naya id un sabko
 * ek naye channel me le aata hai.
 *
 * ⚠️ Aage kabhi channel ki settings badlo to id bhi badalna (v3, v4…), warna
 * badlaav sirf naye install par dikhega aur purane user ko kabhi nahi milega —
 * aur ye wahi galti hai jo pakadna sabse mushkil hoti hai.
 */
const CHANNEL_ID = "reminders-alarm-v2";

/**
 * Alarm kitni der bajta rahe (ms).
 *
 * ⚠️ Ye zaroori hai kyunki neeche `loopSound` + `FLAG_INSISTENT` lage hue hain —
 * yaani awaaz apne aap band NAHI hoti, wo tab tak bajti hai jab tak notification
 * hat na jaye. Ye bilkul aisa hi hai jaisa asli alarm app karte hain, par uske
 * saath ek chhat honi hi chahiye: user phone ghar par chhod ke nikal gaya to
 * bina chhat ke wo ghanton bajta rehta.
 *
 * 60 second ek asli alarm jitna hi hai — ignore karna mushkil, aur bhaari bhi
 * nahi.
 */
const ALARM_TIMEOUT_MS = 60_000;

/**
 * Document expiry ka teen-qadam ladder: 7 din pehle, 1 din pehle, aur us din.
 *
 * ⚠️ Ye web ke cron (`web/app/api/cron/document-expiry/route.ts`) ke saath
 * BILKUL milna chahiye — wahan email + WhatsApp isi ladder par jaate hain.
 * Ek jagah badla aur doosri jagah nahi, to user ko notification aaj aayegi aur
 * email kisi aur din — sabse bura tajurba.
 *
 * Pehle [14, 3, 0] tha. 7/1/0 isliye behtar hai: 14 din pehle wali baat log bhool
 * jaate hain, aur 1 din pehle wali chetavni sach me kaam karati hai.
 */
export const EXPIRY_LEAD_DAYS = [7, 1, 0] as const;
const NOTIFY_HOUR = 9;

/**
 * Reminder ka channel — alarm jaisa, notification jaisa nahi.
 *
 * ⚠️ `bypassDnd` yahan sabse zaroori nayi cheez hai. Bahut se log raat me Do Not
 * Disturb chalu rakhte hain (ya OEM apne aap "bedtime mode" laga deta hai), aur
 * usme aam notification ki awaaz poori tarah dab jaati hai. Reminder ke liye
 * user ne KHUD kaha tha ki "us waqt bata dena" — us par chup reh jaana wahi ek
 * kaam na karna hai jiske liye app hai. Alarm apps isi wajah se DND bypass karte
 * hain, aur reminder alarm hi hai.
 *
 * ⚠️ Channel ki ye settings sirf PEHLI baar lagti hain (upar `CHANNEL_ID` par
 * poori baat likhi hai). Isme kuch bhi badlo to id bhi badalni hogi.
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: "Reminders & alarms",
    description: "Aapke reminder aur document expiry ke alert",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
    // Lamba, alarm-jaisa pattern — chhoti si thap jeb me mehsoos hi nahi hoti.
    vibrationPattern: [300, 600, 300, 600],
    // Lock screen par poora text dikhe — chhupa hua reminder bekaar hai.
    visibility: AndroidVisibility.PUBLIC,
    // Raat/DND me bhi bajna chahiye (upar wajah likhi hai).
    bypassDnd: true,
    lights: true,
  });
}

export async function ensureNotifPermission(): Promise<boolean> {
  await ensureChannel();
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export async function hasNotifPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Ek notification schedule karo (timestamp trigger).
 * Android: fullScreenAction = lock screen par poora alert. Same `id` dobara dene
 * se purani schedule replace ho jaati hai (duplicate nahi).
 */
async function schedule(
  id: string,
  title: string,
  body: string,
  when: Date,
  kind: "reminder" | "expiry" | "test" = "reminder",
): Promise<boolean> {
  if (when.getTime() <= Date.now()) return false;

  const n = await notifDict();

  /**
   * ── Alarm jaisa vyavhaar, app khuli ho ya na ho ─────────────────────────
   *
   * ⚠️ Ye is file ka sabse zaroori hissa hai. Shikayat seedhi thi: "app band ho
   * ya phone locked ho to sound aur task aana chahiye — Rapido/Astrotalk me aata
   * hai, hamare me kyun nahi." Pehle yahan sirf `fullScreenAction` par bharosa
   * tha, aur wo Android 14 (API 34) se ek **special app access** ban chuka hai
   * jo alarm/calling apps ke alawa sab ke liye DEFAULT SE BAND hai. User ne
   * sab kuch allow kar rakha ho, tab bhi bada popup nahi aata — aur uske saath
   * hi poora alert chup ho jaata tha.
   *
   * Isliye ab poora bhaar `fullScreenAction` par nahi hai. Wo abhi bhi lagta hai
   * (jahan permission hai wahan sabse achha anubhav wahi deta hai), par uske
   * bina bhi reminder ab ek ASLI alarm ki tarah bajta hai:
   *
   *   • `loopSound` + `FLAG_INSISTENT` — awaaz ek baar "ting" karke chup nahi
   *     hoti; wo bajti rehti hai jab tak user use hata na de. Yahi wo ek cheez
   *     hai jo aam notification aur alarm ke beech ka poora fark banati hai.
   *   • `ongoing` — swipe se galti se hat na jaye. Hatane ka saaf raasta neeche
   *     ke do button hain.
   *   • `lightUpScreen` — screen jaag jaati hai, isliye jebe me pada phone bhi
   *     dikh jaata hai (full-screen intent na chal paaye tab bhi).
   *   • `timeoutAfter` — aur uski chhat: 60 second baad alarm khud chup ho jaata
   *     hai. Bina iske phone ghar par chhod ke nikal jaane par wo ghanton bajta.
   *
   *   • Do action button ("Ho gaya" / "Baad me") — app kholе bina hi kaam
   *     nipat jaata hai. Pehle nipatane ka EK HI raasta tha: app kholo, modal ka
   *     intezaar karo, phir dabao. Lock screen par khade user ke liye wo teen
   *     kadam bahut hain.
   *
   * `category: ALARM` + HIGH importance dono zaroori hain: inhi se Android is
   * notification ko alarm maanta hai (heads-up, DND bypass, aur full-screen
   * intent ki patrata).
   */
  const isReminder = kind === "reminder";
  /**
   * Test alarm ko asli reminder jaisa hi bajna chahiye — warna wo kuch saabit
   * hi nahi karta. Isliye awaaz, full-screen aur screen jagana sab wahi.
   *
   * Do cheezein jaan-boojh ke ALAG hain:
   *   • `ongoing` nahi — asli reminder ke do button hote hain jinse wo hat-ta
   *     hai; test me wo button nahi hain, to ongoing use hataana namumkin bana
   *     deta.
   *   • action button nahi — "Ho gaya" server par ek aisi id bhejta jo hai hi
   *     nahi.
   */
  const isAlarmLike = kind === "reminder" || kind === "test";

  const notification = {
    id,
    title,
    body,
    data: { kind, body, title, id },
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.ALARM,
      // Lock screen par alarm-jaisa poora popup — jahan permission mili ho.
      fullScreenAction: { id: "default" },
      pressAction: { id: "default" },
      // Screen jaga do. Ye full-screen intent se alag hai aur uske bina bhi
      // chalta hai — jeb me pada phone bhi tab dikh jaata hai.
      lightUpScreen: true,
      /**
       * Awaaz bajti rahe.
       *
       * ⚠️ `loopSound` akele kaafi nahi hai kuch OEM par; `FLAG_INSISTENT`
       * Android ko seedha kehta hai ki awaaz tab tak dohraate raho jab tak
       * notification hat na jaye. Dono saath me har phone par chalte hain.
       */
      loopSound: isAlarmLike,
      flags: isAlarmLike ? [AndroidFlags.FLAG_INSISTENT] : undefined,
      // Swipe se galti se hat na jaye — hatane ka raasta neeche ke button hain.
      ongoing: isReminder,
      autoCancel: !isReminder,
      // Alarm ki chhat — 60 second baad khud chup (upar wajah likhi hai).
      timeoutAfter: isAlarmLike ? ALARM_TIMEOUT_MS : undefined,
      /**
       * App khole bina hi nipat jaye.
       *
       * ⚠️ Ye pehle tha hi nahi, aur uski kami sabse zyada lock screen par
       * chubhti thi: alarm bajta tha aur use band karne ka ek hi raasta tha —
       * phone kholo, app kholo, modal ka intezaar karo, phir dabao.
       */
      actions: isReminder
        ? [
            { title: n.alertDone, pressAction: { id: ACTION_DONE } },
            { title: n.alertLater, pressAction: { id: ACTION_LATER } },
          ]
        : undefined,
    },
    ios: {
      sound: "default",
      // `critical` ke liye Apple ki alag manzoori chahiye; `timeSensitive` wo
      // sabse ooncha darja hai jo har app ko milta hai — Focus/DND ke aar-paar
      // se nikal jaata hai.
      interruptionLevel: "timeSensitive" as const,
    },
  };

  const trigger = (type: AlarmType): TimestampTrigger => ({
    type: TriggerType.TIMESTAMP,
    timestamp: when.getTime(),
    // ⚠️ Pehle yahan sirf `{ allowWhileIdle: true }` tha. Wo notifee ka
    // deprecated flag hai aur alarm ko SET_AND_ALLOW_WHILE_IDLE banata hai —
    // yaani **inexact**. Android aise alarms ko ~10 min ki window me doosre
    // alarms ke saath batch karta hai, isliye 8:36 wala reminder 8:38 pe 8:39
    // wale ke saath ek jhund me aata tha. SET_EXACT_AND_ALLOW_WHILE_IDLE se
    // alarm doze me bhi theek us minute par bajta hai.
    alarmManager: { type },
  });

  try {
    await ensureChannel();
    await notifee.createTriggerNotification(
      notification,
      trigger(AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE),
    );
    return true;
  } catch (exactErr) {
    /**
     * ⚠️ Exact alarm ki permission (SCHEDULE_EXACT_ALARM) na ho to notifee
     * yahan THROW karta hai — aur purana code use chup-chaap nigal ke `false`
     * lauta deta tha. Natija: reminder ka alarm lagta hi nahi tha, kahin koi
     * error bhi nahi dikhta tha, aur user ko lagta tha app hi toot gayi.
     *
     * Der se aana, na aane se behtar hai. Isliye ab inexact alarm par gir
     * jaate hain (~10 min ki window me bajega) aur permission modal user se
     * exact-alarm maang hi raha hai.
     */
    try {
      await notifee.createTriggerNotification(
        notification,
        trigger(AlarmType.SET_AND_ALLOW_WHILE_IDLE),
      );
      reportError(
        exactErr,
        { screen: "notifications", action: "schedule_exact", id, kind, fallback: "inexact" },
        "warn",
      );
      return true;
    } catch (e) {
      reportError(e, { screen: "notifications", action: "schedule", id, kind });
      return false;
    }
  }
}

async function cancel(id: string): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(id);
    await notifee.cancelNotification(id);
  } catch {
    /* already gone */
  }
}

/* ----------------------------- reminders ----------------------------- */

/**
 * Roz wale reminder ke liye kitne din aage tak alarm laga ke rakhein.
 *
 * Android me "roz 6 baje" wala ek repeating alarm bharosemand nahi hai: OEM ke
 * battery saver aise alarms ko sabse pehle maarte hain, aur notifee ka interval
 * trigger exact bhi nahi hota (~15 min idhar-udhar). Isliye hum har occurrence
 * ka apna EXACT alarm lagate hain.
 *
 * 14 ka aankda soch ke hai: itne alarm har OEM aaram se sambhal leta hai, aur
 * user app 2 hafte me kam se kam ek baar to kholta hi hai — har baar khulne par
 * `syncNotifications()` khidki ko aage sarka deta hai. Isse 90 din wala reminder
 * bhi bina 90 alarm lagaye poora chalta hai.
 */
const REPEAT_WINDOW = 14;

/** Ek occurrence ka notification id. Pehla = reminder id (purane ids na tootein). */
const occId = (id: string, i: number) => (i === 0 ? id : `${id}#${i}`);

export async function scheduleReminder(
  id: string,
  title: string,
  when: Date,
): Promise<boolean> {
  const d = await notifDict();
  return schedule(id, d.reminderTitle, title, when);
}

/**
 * Roz/har-hafte wala reminder — aage ke kai occurrences ek saath schedule karo.
 *
 * `everyDays` na ho (ya 1 se kam) to ye ek hi alarm lagata hai — bilkul purana
 * vyavhaar. `until` (YYYY-MM-DD) ke baad ka koi alarm nahi lagta: 90 din wala
 * reminder 91ve din chup ho jaata hai, apne aap.
 */
export async function scheduleReminderSeries(
  id: string,
  title: string,
  first: Date,
  everyDays?: number | null,
  until?: string | null,
): Promise<boolean> {
  // Purani khidki hata do — warna repeat band karne par ya time badalne par
  // pichhle alarm chupchaap bajte rehte hain.
  await cancelReminder(id);

  const n = await notifDict();
  const every = everyDays && everyDays >= 1 ? Math.floor(everyDays) : 0;
  if (!every) return schedule(id, n.reminderTitle, title, first);

  // "90 din tak" — us din ke aakhir tak (us din ka reminder bhi jaata hai).
  const lastMs = until ? endOfDay(until) : null;

  const when = new Date(first);

  /**
   * Beete hue din chhod ke AGLI aane wali baari par pahunch jao.
   *
   * ⚠️ Ye chhoti si baat ek badi khamoshi ki jad thi. `first` wo pehla din hai jo
   * reminder banate waqt tay hua tha, aur phone par wo purana pada reh sakta hai
   * (server `remind_at` ko roz aage sarkaata hai, par app us badlaav ko tabhi
   * padhti hai jab wo khule). Pehle loop seedha `first` se shuru hota tha, aur
   * `schedule()` beete waqt par kuch nahi lagata (`when <= now` par false).
   *
   * Natija: agar user ne app 14 din se zyada na kholi ho, to poori khidki (14
   * occurrences) beet chuki hoti thi — yaani EK BHI alarm nahi lagta tha. "Roz
   * subah 6 baje dawai" wala reminder bilkul chup ho jaata, aur kahin koi error
   * nahi dikhta. Reminder app me isse bura kuch nahi hota.
   *
   * Chhat isliye lagai hai ki `every = 1` aur `first` do saal purana ho to ye
   * loop 700 baar ghoomta — kaam wahi hota, waqt bekaar jaata. 3000 kadam me 8
   * saal (roz wala) nikal jaate hain; usse aage koi asli reminder nahi hota.
   */
  const nowMs = Date.now();
  for (let guard = 0; guard < 3000 && when.getTime() <= nowMs; guard++) {
    when.setDate(when.getDate() + every);
  }

  let any = false;
  for (let i = 0; i < REPEAT_WINDOW; i++) {
    if (lastMs !== null && when.getTime() > lastMs) break;
    if (await schedule(occId(id, i), n.reminderTitle, title, new Date(when), "reminder")) {
      any = true;
    }
    when.setDate(when.getDate() + every);
  }
  return any;
}

/** "YYYY-MM-DD" ke us din ka aakhri lamha (local). */
function endOfDay(day: string): number | null {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

/** Reminder ke SAARE alarm hatao — poori repeat khidki samet. */
export async function cancelReminder(id: string): Promise<void> {
  for (let i = 0; i < REPEAT_WINDOW; i++) await cancel(occId(id, i));
}

/**
 * Notification ke button se kiye gaye kaam server tak pahunchao.
 *
 * ⚠️ Ye kaam headless task me nahi ho sakta (wahan Supabase ka poora stack boot
 * karna padta hai aur task khatam hote hi Android process gira deta hai —
 * aadhi bheji hui request beech me hi mar jaati). Isliye wahan sirf ek line
 * likhi jaati hai, aur asli kaam yahan hota hai: app jab bhi saamne aati hai.
 *
 * "Baad me" wala button jaan-boojh ke server par kuch nahi bhejta — uska matlab
 * hi "abhi kuch mat karo" hai. Uska poora kaam alarm ki awaaz band karna tha,
 * aur wo notification hatte hi ho chuka.
 */
export async function flushNotificationActions(): Promise<void> {
  const list = await takeNotificationActions();
  if (list.length === 0) return;

  let changed = false;
  for (const a of list) {
    if (a.action !== "done") continue;
    // Repeat wale reminder me notification id `<uuid>#3` jaisi hoti hai —
    // server ko hamesha bina suffix wali asli id chahiye.
    const id = a.id.split("#")[0];
    try {
      const next = await completeReminder(id);
      if (next) {
        // Server ne agla waqt de diya — nayi alarm-khidki laga do, poore repeat
        // ke saath (warna 14 alarm ki jagah sirf ek bachta hai).
        const row = (await listReminders().catch(() => [])).find((x) => x.id === id);
        await scheduleReminderSeries(
          id,
          row?.title ?? "",
          new Date(next),
          row?.repeat_every_days ?? null,
          row?.repeat_until ?? null,
        );
      } else await cancelReminder(id);
      changed = true;
    } catch {
      /**
       * Net nahi tha — alarm to hata hi do.
       *
       * User ne kaam kar liya hai; use wahi notification dobara dena sabse
       * chidhchida hoga. Server agli sync par apne aap sahi ho jaayega.
       */
      await cancelReminder(id).catch(() => {});
    }
  }
  // Home/Reminders khule ho sakte hain — unhe turant sach dikhna chahiye.
  if (changed) emitDataChanged();
}

/* ----------------------------- test alarm ----------------------------- */

const TEST_ID = "saathi-test-alarm";

/** Test alarm kitni der baad — itna ki user phone lock kar sake. */
export const TEST_ALARM_SECONDS = 60;

/**
 * Ek asli alarm, abhi se {@link TEST_ALARM_SECONDS} baad.
 *
 * ⚠️ Ye debug ka jugaad nahi hai — ye is poore feature ka ek zaroori hissa hai.
 * "Reminder nahi aaya" wali shikayat ka jawab dena bina iske lagbhag namumkin
 * hai: Android par alarm bajne ke liye PAANCH cheezein chahiye (dekho
 * `reliability.ts`), un paanch me se do ka status OS kisi API se batata hi nahi,
 * aur asli reminder ka intezaar ghanton ka hota hai. User ke paas "sab allow kar
 * diya, ab pata kaise chale?" ka koi raasta hi nahi tha.
 *
 * Ye wahi `schedule()` chalata hai jo asli reminder chalata hai — wahi channel,
 * wahi `CATEGORY_ALARM`, wahi `fullScreenAction`, wahi `loopSound` +
 * `FLAG_INSISTENT`, wahi exact alarm. Isliye ye sach me wahi cheez jaanchta hai;
 * ek alag "test wala" raasta banane par wo kuch bhi saabit na karta.
 *
 * ⚠️ Yahan device-approval wala gate JAAN-BOOJH KE nahi lagta. Ye Android ki
 * taraf jaanchta hai (permission, channel, exact alarm, full-screen), aur user
 * ne khud dabaya hai. Us waqt "aapka phone active nahi hai" keh ke chup ho jaana
 * theek us sawaal ka jawab na dena hoga jo poochha gaya tha.
 */
export async function scheduleTestAlarm(): Promise<boolean> {
  const n = await notifDict();
  // Purana test pada ho to hata do — do test alarm ek saath bhaddey lagte hain.
  await cancel(TEST_ID);
  const when = new Date(Date.now() + TEST_ALARM_SECONDS * 1000);
  return schedule(TEST_ID, n.testTitle, n.testBody, when, "test");
}

/* -------------------------- document expiry -------------------------- */

const docNotifId = (docId: string, lead: number) => `doc:${docId}:${lead}`;

function expiryDate(expiry: string, minusDays: number): Date | null {
  const [y, m, d] = expiry.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, NOTIFY_HOUR, 0, 0, 0);
  dt.setDate(dt.getDate() - minusDays);
  return dt;
}

export async function scheduleDocumentExpiry(
  docId: string,
  name: string,
  expiry: string | null,
): Promise<void> {
  await cancelDocumentExpiry(docId);
  if (!expiry) return;

  const n = await notifDict();
  for (const lead of EXPIRY_LEAD_DAYS) {
    const when = expiryDate(expiry, lead);
    if (!when) continue;
    const body =
      lead === 0 ? tpl(n.expiryToday, { name }) : tpl(n.expiryInDays, { name, n: lead });
    await schedule(docNotifId(docId, lead), n.expiryTitle, body, when, "expiry");
  }
}

export async function cancelDocumentExpiry(docId: string): Promise<void> {
  for (const lead of EXPIRY_LEAD_DAYS) await cancel(docNotifId(docId, lead));
}

/* -------------------------------- sync -------------------------------- */

/**
 * Aakhri poora sync kab hua, aur agar abhi chal raha hai to wahi promise.
 *
 * ⚠️ Ye do guard isliye hain kyunki `syncNotifications()` HAR BAAR app ke
 * saamne aane par chalta hai (`_layout.tsx` ka AppState listener), aur ye
 * function sasta bilkul nahi hai:
 *
 *   - do network call (reminders + documents), aur
 *   - har repeat wale reminder par 28 native call — 14 purane cancel + 14 naye
 *     schedule (`scheduleReminderSeries` pehle `cancelReminder` chalata hai).
 *
 * 30 reminder wale user ke liye wo ~800 native call ban jaate hain. Notification
 * ke liye doosri app me jaakar wapas aana bilkul aam baat hai, aur us har chhoti
 * si aawajaahi par poora hisaab dobara chalta tha — sasta phone wahin atak jaata
 * tha, jabki 10 second me kuch badla hi nahi hota.
 *
 * Login/permission jaisi jagah par `force: true` chahiye — wahan sach me kuch
 * badla hota hai.
 */
let lastSyncAt = 0;
let syncInFlight: Promise<void> | null = null;
const SYNC_MIN_GAP_MS = 60_000;

export function syncNotifications(opts: { force?: boolean } = {}): Promise<void> {
  // Ek hi sync do baar saath me chale to dono ek doosre ke alarm cancel karte
  // hain — beech me kuch der ke liye reminder bina alarm ke reh jaata hai.
  if (syncInFlight) return syncInFlight;
  if (!opts.force && Date.now() - lastSyncAt < SYNC_MIN_GAP_MS) return Promise.resolve();

  syncInFlight = runSync().finally(() => {
    lastSyncAt = Date.now();
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSync(): Promise<void> {
  try {
    if (!(await hasNotifPermission())) return;

    /**
     * ⚠️ Ye phone abhi "active" nahi hai — alarm mat lagao, aur PURANE HATA DO.
     *
     * Ek waqt me ek hi phone active rehta hai
     * (`supabase/device-approval.sql`). Alarm notifee se phone ke ANDAR lagte
     * hain, isliye server se unhe rokna namumkin hai — rok yahin lag sakti hai.
     *
     * Bina is gate ke poora feature aadha reh jaata: token to na jaata (push
     * ruk jaata), par har local alarm phir bhi bajta rehta. User ke liye wo
     * sabse uljhan wali soorat hoti — "notification band hai phir bhi alarm
     * kyun baj raha hai".
     *
     * ⚠️ `ensureDeviceState()` — `deviceState()` nahi. Cache ka default
     * `active: true` hai, aur ye function app khulte hi chalta hai. Sirf cache
     * padhne par pehla sync INACTIVE phone par bhi saare alarm laga deta, aur
     * uske baad ye gate unhe kabhi hata nahi paata.
     *
     * ⚠️ Purane alarm CANCEL karna zaroori hai, sirf "naye mat lagao" kaafi
     * nahi. Ek phone offline rehte hue inactive ho sakta hai (doosre phone par
     * verify hua), aur uske pehle se lage hue alarm bajte rahenge — theek wahi
     * "ek reminder do phone par" wali dikkat jiske liye ye poora feature hai.
     *
     * Kuch khota nahi: alarm server ke data se BANTE hain. Verify hote hi
     * `syncNotifications({ force: true })` sabko wapas laga deta hai.
     */
    if (!(await ensureDeviceState()).active) {
      await notifee.cancelTriggerNotifications().catch(() => {});
      return;
    }

    const [reminders, documents] = await Promise.all([listReminders(), listDocuments()]);

    for (const r of reminders) {
      // Har sync par repeat ki khidki aage sarak jaati hai — isi wajah se 90 din
      // wala reminder sirf 14 alarm rakh ke bhi poore 90 din chalta hai.
      if (r.is_on && !r.is_paused && r.remind_at) {
        await scheduleReminderSeries(
          r.id,
          r.title,
          new Date(r.remind_at),
          r.repeat_every_days,
          r.repeat_until,
        );
      } else await cancelReminder(r.id);
    }
    for (const d of documents) {
      await scheduleDocumentExpiry(d.id, d.name, d.expiry);
    }
  } catch (e) {
    // Sync toota to har reminder ka alarm miss hota hai — sabse mehnga chup
    // rehne wala fail. Pehle ye poora catch khaali tha.
    reportError(e, { screen: "notifications", action: "sync" }, "warn");
  }
}
