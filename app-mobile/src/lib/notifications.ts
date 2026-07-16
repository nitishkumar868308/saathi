import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { listReminders } from "./reminders";
import { listDocuments } from "./documents";
import { dictionaries, DEFAULT_LOCALE, tpl, type Locale } from "./i18n/dictionaries";

/** Notification text user ki chuni bhasha me — AsyncStorage se locale padhke. */
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
 * Android channel id.
 *
 * ⚠️ VERSION SUFFIX zaroori hai. Android channel ki settings (sound, importance)
 * SIRF pehli baar create hone pe lagti hain — baad me code badalne se OS use
 * ignore kar deta hai. Purana "reminders" channel bina sound ke ban chuka tha,
 * isliye background me sirf silent notification aati thi. Naya id ("reminders-v2")
 * OS ko force karta hai ki sound + MAX importance ke saath naya channel bane.
 * Aage kabhi channel settings badlo to ye number bhi badhana.
 */
const CHANNEL_ID = "reminders-v2";

/** Document expiry se kitne din pehle yaad dilana hai. 0 = expiry wale din. */
const EXPIRY_LEAD_DAYS = [14, 3, 0] as const;

/** Expiry notification kis waqt jaaye (local time). */
const NOTIFY_HOUR = 9;

// Foreground mein bhi notification dikhe
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  // Purana bina-sound wala channel hata do (warna app list me do channel dikhte).
  try {
    await Notifications.deleteNotificationChannelAsync("reminders");
  } catch {
    /* pehle se nahi hai — koi baat nahi */
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Reminders",
    // MAX = heads-up banner + sound, screen band ho tab bhi.
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function ensureNotifPermission(): Promise<boolean> {
  // Android 13+ pe permission prompt channel banne ke baad hi theek se aata hai.
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Permission maange bina sirf status batao (background sync ke liye). */
export async function hasNotifPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/**
 * Ek notification schedule karo.
 *
 * ⚠️ Android pe `channelId` TRIGGER me jaata hai, content me nahi. Bina iske
 * expo apne fallback "Miscellaneous" channel me daal deta hai — default
 * importance, na heads-up banner na sound. Isliye humara HIGH-importance
 * channel banta to tha, par use kabhi hota hi nahi tha.
 *
 * Same `identifier` dobara dene se purani schedule replace ho jaati hai, isliye
 * sync baar-baar chalana safe hai — duplicate notifications nahi aayengi.
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
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      // sound iOS pe content se aata hai; Android pe channel se. Dono set.
      // data.kind + data.body se app ka full-screen alert modal bharta hai.
      content: {
        title,
        body,
        sound: "default",
        // Heads-up banner (Android) + screen band hone pe bhi turant (iOS).
        priority: Notifications.AndroidNotificationPriority.MAX,
        interruptionLevel: "timeSensitive",
        vibrate: [0, 250, 250, 250],
        data: { kind, body, title },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: CHANNEL_ID,
      },
    });
    return true;
  } catch {
    return false;
  }
}

async function cancel(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already gone — koi baat nahi
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

/** 'YYYY-MM-DD' → us din subah NOTIFY_HOUR baje ka local Date (minus lead). */
function expiryDate(expiry: string, minusDays: number): Date | null {
  const [y, m, d] = expiry.split("-").map(Number);
  if (!y || !m || !d) return null;
  // Numeric constructor zaroori hai — `new Date("2026-07-08")` UTC midnight deta
  // hai, jo IST me pichhle din 5:30 AM ban jaata.
  const dt = new Date(y, m - 1, d, NOTIFY_HOUR, 0, 0, 0);
  dt.setDate(dt.getDate() - minusDays);
  return dt;
}

/**
 * Document expiry ke liye teen reminder: 14 din pehle, 3 din pehle, aur expiry
 * wale din subah 9 baje. Jo waqt nikal chuka hai wo apne aap skip ho jaata hai.
 *
 * ⚠️ Pehle ye kahin schedule hota hi nahi tha — expiry sirf home screen ke card
 * me dikhti thi, notification kabhi nahi jaati thi.
 */
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
      lead === 0
        ? tpl(n.expiryToday, { name })
        : tpl(n.expiryInDays, { name, n: lead });
    await schedule(docNotifId(docId, lead), n.expiryTitle, body, when, "expiry");
  }
}

export async function cancelDocumentExpiry(docId: string): Promise<void> {
  for (const lead of EXPIRY_LEAD_DAYS) await cancel(docNotifId(docId, lead));
}

/* -------------------------------- sync -------------------------------- */

/**
 * Sab reminders + document expiries dobara schedule karo.
 *
 * Kyu zaroori hai: OS ki scheduled notifications app reinstall ke baad, aur
 * doosre device pe bane data ke liye, exist hi nahi karti. Pehle sirf "add" ke
 * waqt schedule hota tha — matlab naye phone pe login karne wale ko ek bhi
 * notification nahi milti thi.
 *
 * Permission maangta nahi — granted ho tabhi kaam karta hai. Identifier reuse
 * hota hai, isliye duplicate nahi bante.
 */
export async function syncNotifications(): Promise<void> {
  try {
    if (!(await hasNotifPermission())) return;

    const [reminders, documents] = await Promise.all([listReminders(), listDocuments()]);

    for (const r of reminders) {
      // Paused reminder (Plus expire hone pe 5 se aage wale) notification nahi bhejte.
      if (r.is_on && !r.is_paused && r.remind_at)
        await scheduleReminder(r.id, r.title, new Date(r.remind_at));
      else await cancelReminder(r.id);
    }
    for (const d of documents) {
      await scheduleDocumentExpiry(d.id, d.name, d.expiry);
    }
  } catch {
    // best-effort — sync fail hone se app na ruke
  }
}
