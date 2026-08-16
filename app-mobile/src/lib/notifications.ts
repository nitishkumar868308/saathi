import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, { AndroidImportance, AuthorizationStatus } from "@notifee/react-native";

/**
 * ⚠️ Alarm ka poora dhaancha ab `notify-core.ts` me hai, yahan nahi.
 *
 * Wajah: wahi dhaancha background/headless task ko bhi chahiye (snooze ke liye,
 * jo app band hone par bhi lagna chahiye), aur wo task ye bhaari file import
 * nahi kar sakta — ismein supabase, reminders aur documents ka poora stack aa
 * jaata hai. `notify-core` me sirf notifee hai.
 */
import {
  ACTION_DONE,
  ACTION_LATER,
  CHANNEL_ID,
  QUIET_CHANNEL_ID,
  SNOOZE_MS,
  SNOOZE_PREFIX,
  baseReminderId,
  buildAlarmNotification,
  cancelNotification as cancel,
  ensureChannel,
  ensureQuietChannel,
  scheduleNotificationAt,
  snoozeNotification,
  type AlarmKind,
} from "./notify-core";

import { EXPIRY_LEAD_DAYS, expiryCatchUp, expiryNotifyPlan } from "../utils/expiry";
import { completeReminder, listReminders } from "./reminders";
import { ensureDeviceState } from "./device-approval";
import { emitDataChanged } from "./data-events";
import { listDocuments } from "./documents";
import { reportError } from "./report-error";
import { dictionaries, DEFAULT_LOCALE, tpl, type Locale } from "./i18n/dictionaries";
// Background/headless handler ab `index.js` se sabse pehle lagta hai. Yahan se
// sirf takePendingAlert aage bheja jaata hai (purane import na tootein).
import { takeNotificationActions, takePendingAlert } from "./notification-background";

export { takePendingAlert };
// Snooze/repeat wale id se asli reminder id — modal aur tray, dono isi ko use
// karte hain (wajah `notify-core.ts` me likhi hai).
export { baseReminderId, SNOOZE_MS };

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
 *
 * Poora dhaancha aur exact→inexact wala fallback ab `notify-core.ts` me hai —
 * wahi headless task bhi use karta hai (snooze ke liye). Yahan sirf wo hissa
 * bacha hai jo is file ka apna hai: bhasha ke labels aur error reporting.
 *
 * Same `id` dobara dene se purani schedule replace ho jaati hai (duplicate nahi).
 */
async function schedule(
  id: string,
  title: string,
  body: string,
  when: Date,
  kind: AlarmKind = "reminder",
): Promise<boolean> {
  if (when.getTime() <= Date.now()) return false;

  const n = await notifDict();
  return scheduleNotificationAt(
    buildAlarmNotification({
      id,
      title,
      body,
      kind,
      labels: { done: n.alertDone, later: n.alertLater },
    }),
    when,
    {
      // Exact alarm ki permission nahi mili — alarm laga to hai, par ~10 min ki
      // window me. Ye chup-chaap nahi hona chahiye; permission modal isi wajah
      // se user se exact-alarm maangta hai.
      onFallback: (e) =>
        reportError(
          e,
          { screen: "notifications", action: "schedule_exact", id, kind, fallback: "inexact" },
          "warn",
        ),
      onFail: (e) => reportError(e, { screen: "notifications", action: "schedule", id, kind }),
    },
  );
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
  /**
   * ⚠️ Snooze ka alarm ALAG id par baithta hai (`snooze:<uuid>`), isliye upar
   * wali ginti (`<uuid>`, `<uuid>#1`…) use kabhi chhooti hi nahi thi.
   *
   * Nateeja wahi tha jo sabse bura lagta hai: user ne "abhi nahi" dabaya, phir
   * reminder poora kar diya / delete kar diya / pause kar diya — aur 5 minute
   * baad wo phir bhi baj gaya. Us waqt tak reminder app me hai hi nahi, isliye
   * user ke paas use rokne ka koi raasta bhi nahi bachta.
   */
  await cancel(`${SNOOZE_PREFIX}${id}`);
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
/**
 * Reminder ko 5 minute aage sarka do — "abhi nahi" ka asli matlab.
 *
 * ⚠️ Ye APP KE ANDAR wala raasta hai (full-screen modal ka "5 min baad" button).
 * App band hone par wahi kaam `notification-background.ts` seedha karta hai —
 * dono ek hi `snoozeNotification()` par jaate hain, isliye vyavhaar ek hi rehta
 * hai chahe app khuli ho ya nahi.
 *
 * ⚠️ Ye poora raasta pehle THA HI NAHI. "Abhi nahi" ka button MAUJOOD tha par
 * kuch karta hi nahi tha: notification hat jaati thi, kataar me "later" pada
 * rehta tha, aur `flushNotificationActions` use `if (a.action !== "done")
 * continue;` se chup-chaap gira deta tha. Reminder poori tarah gayab — na tray
 * me, na dobara.
 */
export async function snoozeReminder(notifId: string, title: string): Promise<boolean> {
  const n = await notifDict();
  return snoozeNotification({
    id: notifId,
    title: n.reminderTitle,
    body: title,
    data: { kind: "reminder", id: notifId, title: n.reminderTitle, body: title },
    android: {
      channelId: CHANNEL_ID,
      actions: [
        { title: n.alertDone, pressAction: { id: ACTION_DONE } },
        { title: n.alertLater, pressAction: { id: ACTION_LATER } },
      ],
    },
  });
}

export async function flushNotificationActions(): Promise<void> {
  const list = await takeNotificationActions();
  if (list.length === 0) return;

  let changed = false;
  for (const a of list) {
    // Repeat wale reminder me notification id `<uuid>#3` jaisi hoti hai, aur
    // snooze me `snooze:<uuid>` — server ko hamesha asli id chahiye.
    const id = baseReminderId(a.id);

    /**
     * "Abhi nahi" — 5 minute baad dobara.
     *
     * Title server se nahi, kataar se bhi nahi — `listReminders()` se aata hai,
     * kyunki notification me sirf uska text hota hai aur wo bhasha badalne par
     * purana reh sakta hai. Na mile (net nahi / reminder delete ho chuka) to
     * chup-chaap chhod dete hain: ek khaali title wala alarm bajana bekaar hai.
     */
    if (a.action === "later") {
      try {
        const row = (await listReminders().catch(() => [])).find((x) => x.id === id);
        if (row?.title) await snoozeReminder(a.id, row.title);
      } catch {
        /* best-effort — snooze na lag paaye to reminder waise bhi list me hai */
      }
      continue;
    }

    if (a.action !== "done") continue;
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

/**
 * Document ki expiry ke teen alarm — 7 din pehle, 1 din pehle, aur us din.
 *
 * ⚠️ Kaunsa qadam kab padta hai, ye hisaab ab `expiryNotifyPlan()` karta hai —
 * wahi function jo `add-document` screen user ko dikhati hai ("hum aapko kab-kab
 * yaad dilayenge"). Do jagah do hisaab hone par screen kuch waada karti aur phone
 * kuch aur karta; ab dono ek hi jagah se aate hain.
 *
 * `willFire: false` wale qadam skip ho jaate hain — beeta hua waqt par `schedule()`
 * waise bhi kuch nahi lagata, par yahan chhaan lene se ek bekaar native call bhi
 * bach jaati hai.
 *
 * `addedAt` (document ka `created_at`) neeche wale catch-up ke liye hai — poori
 * wajah `expiryCatchUp()` par likhi hai. Na do to "abhi" maan liya jaata hai.
 */
export async function scheduleDocumentExpiry(
  docId: string,
  name: string,
  expiry: string | null,
  addedAt?: string | null,
): Promise<void> {
  await cancelDocumentExpiry(docId);
  if (!expiry) return;

  const n = await notifDict();
  let anyStep = false;
  for (const step of expiryNotifyPlan(expiry)) {
    if (!step.willFire) continue;
    const body =
      step.lead === 0
        ? tpl(n.expiryToday, { name })
        : tpl(n.expiryInDays, { name, n: step.lead });
    await schedule(docNotifId(docId, step.lead), n.expiryTitle, body, step.at, "expiry");
    anyStep = true;
  }
  if (anyStep) return;

  /**
   * Ladder ka ek bhi qadam nahi bacha, par document AAJ HI expire ho raha hai —
   * thodi der me khud bata do.
   *
   * ⚠️ Iske bina dopahar ko daala gaya "aaj expire" wala document poori tarah
   * chup reh jaata tha: teenon lamhe (subah 9) beet chuke hote hain, aur
   * `schedule()` beete waqt par kuch nahi lagata. User ne document daala hi is
   * liye tha ki use bataya jaye, aur usi din kuch nahi aata tha. Poori soch
   * `expiryCatchUp()` par likhi hai.
   *
   * Id `lead 0` wali hi hai — jaan-boojh ke. Ye raasta tabhi khulta hai jab lead
   * 0 ka apna lamha beet chuka ho, yaani wo id khaali padi hoti hai. Isse
   * `cancelDocumentExpiry()` bina kisi badlaav ke isse bhi hata deta hai
   * (renew/delete par ek bhoola hua alarm reh jaana sabse bura hota).
   */
  const catchUp = expiryCatchUp(expiry, addedAt ?? undefined);
  if (catchUp) {
    await schedule(
      docNotifId(docId, 0),
      n.expiryTitle,
      tpl(n.expiryToday, { name }),
      catchUp,
      "expiry",
    );
  }
}

export async function cancelDocumentExpiry(docId: string): Promise<void> {
  for (const lead of EXPIRY_LEAD_DAYS) {
    await cancel(docNotifId(docId, lead));
    // Wahi baat jo `cancelReminder()` par likhi hai — expiry ka alert bhi
    // "abhi nahi" se snooze hota hai, aur wo alag id par baithta hai. Bina
    // iske renew/delete kiya hua document 5 minute baad phir chetavni deta.
    await cancel(`${SNOOZE_PREFIX}${docNotifId(docId, lead)}`);
  }
}

/* ------------------- alarm chup, par parchi tray me zinda ------------------- */

/**
 * Alarm ki AWAAZ band karo — par notification tray se GAYAB mat karo.
 *
 * ⚠️ Ye poora function ek asli bug ki wajah se hai, aur wo bug seedha "dono
 * cheezein aani chahiye" wali baat par baithta hai. **Tray ki notification aur
 * full-screen alert do alag cheezein hain, aur dono ka apna kaam hai:**
 *
 *   • Full-screen alert us LAMHE ke liye hai — "abhi ye kaam hai".
 *   • Tray ki notification us lamhe ke BAAD ke liye hai — jeb me pada phone,
 *     meeting me chup kiya hua alert, ya wo modal jo galti se hat gaya.
 *
 * Pehle yahan seedha `cancelNotification()` chalta tha (modal khulte hi), aur
 * uska maqsad theek tha: reminder `loopSound` + `FLAG_INSISTENT` ke saath bajta
 * hai, yaani awaaz modal ke PEECHE bajti rehti thi aur user ko padhne ka mauka
 * hi nahi milta tha.
 *
 * Par uski keemat ye thi ki notification bhi uske saath hi mar jaati thi. Modal
 * ko bina kuch kiye hata do — aur reminder poori tarah gayab. Tray me kuch nahi,
 * lauta ke dekhne ko kuch nahi. User ke liye wo "app ne yaad hi nahi dilaya"
 * hai, jabki app ne dilaya tha aur phir khud hi mita diya.
 *
 * Ab do kaam alag-alag hote hain: chillane wali notification hatti hai (awaaz
 * wahin ruk jaati hai), aur usi id par ek CHUP parchi turant wapas baith jaati
 * hai — wahi title, wahi baat, aur wahi "Ho gaya / Baad me" button. Yaani awaaz
 * gayi, khabar rahi.
 *
 * Fail ho jaye to bhi purani notification hat chuki hoti hai — awaaz to band ho
 * hi jaati hai. Isliye yahan throw nahi karte; alarm band karna sabse zaroori
 * hissa hai aur wo pehle ho chuka hota hai.
 */
export async function quietenNotification(a: {
  id: string;
  title: string;
  body: string;
  kind: "reminder" | "expiry";
}): Promise<void> {
  // Pehle awaaz — ye kabhi nahi ruk-na chahiye.
  await cancel(a.id);

  try {
    const n = await notifDict();
    await ensureQuietChannel();
    await notifee.displayNotification({
      id: a.id,
      title: a.title,
      body: a.body,
      // ⚠️ `quiet` zaroori hai: iske bina ye dobara DELIVERED hone par headless
      // handler ise ek NAYA reminder samajh ke phir se bol deta.
      data: { kind: a.kind, body: a.body, title: a.title, id: a.id, quiet: "1" },
      android: {
        channelId: QUIET_CHANNEL_ID,
        importance: AndroidImportance.LOW,
        pressAction: { id: "default" },
        // Ab ye chillati nahi, isliye swipe se hatana bilkul theek hai.
        autoCancel: true,
        showTimestamp: true,
        // Button yahan bhi — app khole bina nipatne ka rasta band nahi hona
        // chahiye sirf isliye ki awaaz chup ho gayi.
        actions:
          a.kind === "reminder"
            ? [
                { title: n.alertDone, pressAction: { id: ACTION_DONE } },
                { title: n.alertLater, pressAction: { id: ACTION_LATER } },
              ]
            : undefined,
      },
    });
  } catch (e) {
    reportError(e, { screen: "notifications", action: "quieten", id: a.id }, "warn");
  }
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
      // `created_at` bhejna zaroori hai: "aaj hi expire" wale document ka
      // catch-up alert usi lamhe se ginta hai, "abhi" se nahi — warna app jitni
      // baar khulti, utni baar ek naya alert lag jaata (wajah `expiryCatchUp()`
      // par likhi hai).
      await scheduleDocumentExpiry(d.id, d.name, d.expiry, d.created_at);
    }
  } catch (e) {
    // Sync toota to har reminder ka alarm miss hota hai — sabse mehnga chup
    // rehne wala fail. Pehle ye poora catch khaali tha.
    reportError(e, { screen: "notifications", action: "sync" }, "warn");
  }
}
