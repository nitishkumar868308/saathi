import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, {
  AlarmType,
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  AuthorizationStatus,
  TriggerType,
  type TimestampTrigger,
} from "@notifee/react-native";

import { listReminders } from "./reminders";
import { listDocuments } from "./documents";
import { reportError } from "./report-error";
import { dictionaries, DEFAULT_LOCALE, tpl, type Locale } from "./i18n/dictionaries";
// Background/headless handler ab `index.js` se sabse pehle lagta hai. Yahan se
// sirf takePendingAlert aage bheja jaata hai (purane import na tootein).
import { takePendingAlert } from "./notification-background";

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

const CHANNEL_ID = "reminders-fs"; // full-screen wala naya channel

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

/** Reminders channel (HIGH importance + sound + public). */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: "Reminders",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
    vibrationPattern: [300, 500],
    visibility: AndroidVisibility.PUBLIC,
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
  kind: "reminder" | "expiry" = "reminder",
): Promise<boolean> {
  if (when.getTime() <= Date.now()) return false;

  const notification = {
    id,
    title,
    body,
    data: { kind, body, title, id },
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.ALARM,
      // Lock screen par alarm-jaisa poora popup:
      fullScreenAction: { id: "default" },
      pressAction: { id: "default" },
      sound: "default",
      autoCancel: true,
    },
    ios: {
      sound: "default",
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
  const n = await notifDict();
  return schedule(id, n.reminderTitle, title, when);
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

  let any = false;
  const when = new Date(first);
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
