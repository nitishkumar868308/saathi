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
import { dictionaries, DEFAULT_LOCALE, tpl, type Locale } from "./i18n/dictionaries";

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

// Background event handler — notifee ise chahta hai (warna warning). Full-screen
// alert OS khud dikhata hai; press par app khulta hai aur getInitialNotification /
// foreground event modal dikha deta hai, isliye yahan kuch karne ki zaroorat nahi.
if (Platform.OS !== "web") {
  notifee.onBackgroundEvent(async () => {});
}

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
const EXPIRY_LEAD_DAYS = [14, 3, 0] as const;
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
  try {
    await ensureChannel();
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: when.getTime(),
      // ⚠️ Pehle yahan sirf `{ allowWhileIdle: true }` tha. Wo notifee ka
      // deprecated flag hai aur alarm ko SET_AND_ALLOW_WHILE_IDLE banata hai —
      // yaani **inexact**. Android aise alarms ko ~10 min ki window me doosre
      // alarms ke saath batch karta hai, isliye 8:36 wala reminder 8:38 pe 8:39
      // wale ke saath ek jhund me aata tha. SET_EXACT_AND_ALLOW_WHILE_IDLE se
      // alarm doze me bhi theek us minute par bajta hai.
      alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
    };
    await notifee.createTriggerNotification(
      {
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
          interruptionLevel: "timeSensitive",
        },
      },
      trigger,
    );
    return true;
  } catch {
    return false;
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

export async function scheduleReminder(
  id: string,
  title: string,
  when: Date,
): Promise<boolean> {
  const n = await notifDict();
  return schedule(id, n.reminderTitle, title, when);
}

export async function cancelReminder(id: string): Promise<void> {
  await cancel(id);
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

export async function syncNotifications(): Promise<void> {
  try {
    if (!(await hasNotifPermission())) return;

    const [reminders, documents] = await Promise.all([listReminders(), listDocuments()]);

    for (const r of reminders) {
      if (r.is_on && !r.is_paused && r.remind_at)
        await scheduleReminder(r.id, r.title, new Date(r.remind_at));
      else await cancelReminder(r.id);
    }
    for (const d of documents) {
      await scheduleDocumentExpiry(d.id, d.name, d.expiry);
    }
  } catch {
    /* best-effort */
  }
}
