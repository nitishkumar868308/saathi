import { Platform } from "react-native";
import notifee, {
  AlarmType,
  AndroidCategory,
  AndroidFlags,
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
  type Notification,
  type TimestampTrigger,
} from "@notifee/react-native";

/**
 * Alarm ka DIL — aur jaan-boojh ke bilkul HALKA.
 *
 * ⚠️ Is file me sirf `react-native` aur `notifee` import hote hain. Koi
 * supabase, koi reminders, koi documents, koi dictionaries. Ye shart todi nahi
 * ja sakti, aur uski wajah bilkul theos hai:
 *
 * Notifee ka background handler ek **headless JS task** me chalta hai — ek chhota
 * sa JS environment jo har notification par naye sire se boot hota hai, apna kaam
 * karta hai, aur Android use turant gira deta hai. Wahan jo bhi import hoga wo
 * har baar poora evaluate hoga. Supabase ka client wahan banana matlab auth,
 * session aur network ka poora stack boot karna — sasta phone us der me alarm ka
 * pehla lamha hi kha jaata hai, aur task khatam hote hi process mar jaata hai.
 *
 * Isliye jo kuch **app band hone par bhi** chalna chahiye, wo yahan rehta hai.
 * `lib/notifications.ts` (jo bhaari hai) isi ko import karta hai, ulta nahi.
 *
 * ── Sabse zaroori: SNOOZE yahan kyun hai ────────────────────────────────
 *
 * "5 min baad" ko app band hone par BHI kaam karna chahiye — user lock screen se
 * hi wo button dabata hai, aur wahi uska sabse aam istemaal hai.
 *
 * Pehle wo raasta poori tarah toota hua tha: background handler sirf ek line
 * AsyncStorage me likh deta tha ("later"), aur asli kaam `flushNotificationActions()`
 * karta tha — jo tabhi chalta hai jab user APP KHOLE. Yaani lock screen se "abhi
 * nahi" dabao, phone jeb me rakho, aur 5 minute to kya, kabhi kuch nahi bajta.
 * Snooze sirf tab lagta jab user khud app kholta — aur agar wo app khol hi raha
 * hai to use reminder ki yaad dilane ki zaroorat hi nahi thi.
 *
 * Ab alarm WAHIN, usi lamhe lag jaata hai (`AlarmManager` par, jo OS ke paas
 * hota hai — app zinda ho ya na ho), aur kataar wali line sirf server ko baad me
 * bataane ke liye rehti hai.
 */

/**
 * Reminder ka channel.
 *
 * ⚠️ Naam me `v2` hai, aur ye jaan-boojh ke hai — ise badalna hi EK MAATR tareeka
 * hai channel ki settings badalne ka. Android me ek baar bana hua channel
 * **kabhi nahi** badalta: `createChannel()` dobara chalao to importance, sound,
 * vibration, bypassDnd — sab chup-chaap anadekha ho jaata hai.
 *
 * ⚠️ Aage kabhi channel ki settings badlo to id bhi badalna (v3, v4…), warna
 * badlaav sirf naye install par dikhega aur purane user ko kabhi nahi milega.
 */
export const CHANNEL_ID = "reminders-alarm-v2";

/**
 * Chup channel — wahi baat, bina awaaz aur bina heads-up ke.
 *
 * Full-screen alert khulne ke baad tray me jo parchi bachti hai wo isi par
 * baithti hai (`quietenNotification`).
 */
export const QUIET_CHANNEL_ID = "reminders-quiet-v1";

/**
 * Alarm kitni der bajta rahe (ms).
 *
 * `loopSound` + `FLAG_INSISTENT` ke saath awaaz apne aap band NAHI hoti — wo tab
 * tak bajti hai jab tak notification hat na jaye. Ye bilkul asli alarm app jaisa
 * hai, par uske saath ek chhat honi hi chahiye: phone ghar par chhod ke nikal
 * gaye to bina chhat ke wo ghanton bajta rehta.
 */
export const ALARM_TIMEOUT_MS = 60_000;

/**
 * "Abhi nahi" dabane par kitni der baad dobara.
 *
 * 5 minute wahi aankda hai jo har alarm app deta hai, aur wo soch samajh ke hai:
 * itna ki haath ka kaam nipat jaye, aur itna nahi ki baat bhool hi jaye.
 */
export const SNOOZE_MS = 5 * 60_000;

/**
 * Snooze wali notification ka apna id.
 *
 * ⚠️ Alag id rakhna ZAROORI hai; wahi purani id dobara istemaal karna nahi
 * chalta. `syncNotifications()` har app-open par `scheduleReminderSeries()`
 * chalata hai, aur wo sabse pehle us reminder ke saare occurrence alarm
 * (`<uuid>`, `<uuid>#1`, `<uuid>#2`…) uda deta hai. Agar snooze usi id par
 * baitha hota to app kholte hi wo chup-chaap mar jaata — aur user ko lagta ki
 * "5 min baad" bhi kuch nahi karta, bilkul pehle ki tarah.
 */
export const SNOOZE_PREFIX = "snooze:";

/** Notification ke do button — id dono taraf ek jaisi honi chahiye. */
export const ACTION_DONE = "reminder-done";
export const ACTION_LATER = "reminder-later";

/**
 * Snooze/repeat wale notification id se ASLI reminder id.
 *
 * Server hamesha isi par kaam karta hai: `complete_reminder("<uuid>#3")` kabhi
 * chalta hi nahi (wo valid uuid hai hi nahi), aur `snooze:<uuid>` bhi utna hi
 * bekaar hai.
 */
export function baseReminderId(notifId: string): string {
  return notifId.replace(SNOOZE_PREFIX, "").split("#")[0];
}

export async function ensureChannel(): Promise<void> {
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
    /**
     * ⚠️ Raat/DND me bhi bajna chahiye. Bahut se log raat me Do Not Disturb
     * chalu rakhte hain (ya OEM apne aap "bedtime mode" laga deta hai), aur usme
     * aam notification ki awaaz poori tarah dab jaati hai. Reminder ke liye user
     * ne KHUD kaha tha ki "us waqt bata dena" — us par chup reh jaana wahi ek
     * kaam na karna hai jiske liye app hai.
     */
    bypassDnd: true,
    lights: true,
  });
}

export async function ensureQuietChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await notifee.createChannel({
    id: QUIET_CHANNEL_ID,
    name: "Reminders — chup parchi",
    description: "Alarm band hone ke baad tray me bachi hui reminder ki parchi",
    importance: AndroidImportance.LOW,
    vibration: false,
  });
}

export type AlarmKind = "reminder" | "expiry" | "test";

/** Do button ke labels — bhasha se aate hain, isliye caller deta hai. */
export type ActionLabels = { done: string; later: string };

/**
 * Alarm-jaisi notification ka poora dhaancha — ek hi jagah, sabke liye.
 *
 * ⚠️ Ye ek hi jagah hona ZAROORI hai. Ise `notifications.ts` (naya alarm) aur
 * `notification-background.ts` (snooze, app band hone par) dono banate hain.
 * Do copies rakhne par wo dheere-dheere alag ho jaati — aur snooze wala alarm
 * asli se halka bajta, jise pakadna lagbhag namumkin hota.
 */
export function buildAlarmNotification(opts: {
  id: string;
  title: string;
  body: string;
  kind: AlarmKind;
  labels?: ActionLabels;
}): Notification {
  const { id, title, body, kind, labels } = opts;
  const isReminder = kind === "reminder";
  /**
   * Test alarm ko asli reminder jaisa hi bajna chahiye — warna wo kuch saabit
   * hi nahi karta. Do cheezein jaan-boojh ke ALAG hain: `ongoing` nahi (test me
   * button nahi hain, to ongoing use hataana namumkin bana deta), aur action
   * button nahi ("Ho gaya" server par ek aisi id bhejta jo hai hi nahi).
   */
  const isAlarmLike = kind === "reminder" || kind === "test";

  return {
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
       * ⚠️ `loopSound` akele kaafi nahi hai kuch OEM par; `FLAG_INSISTENT`
       * Android ko seedha kehta hai ki awaaz tab tak dohraate raho jab tak
       * notification hat na jaye. Dono saath me har phone par chalte hain.
       */
      loopSound: isAlarmLike,
      flags: isAlarmLike ? [AndroidFlags.FLAG_INSISTENT] : undefined,
      // Swipe se galti se hat na jaye — hatane ka raasta neeche ke button hain.
      ongoing: isReminder,
      autoCancel: !isReminder,
      timeoutAfter: isAlarmLike ? ALARM_TIMEOUT_MS : undefined,
      /**
       * App khole bina hi nipat jaye.
       *
       * ⚠️ Ye pehle tha hi nahi, aur uski kami sabse zyada lock screen par
       * chubhti thi: alarm bajta tha aur use band karne ka ek hi raasta tha —
       * phone kholo, app kholo, modal ka intezaar karo, phir dabao.
       */
      actions:
        isReminder && labels
          ? [
              { title: labels.done, pressAction: { id: ACTION_DONE } },
              { title: labels.later, pressAction: { id: ACTION_LATER } },
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
}

/**
 * Notification ko ek tay waqt par lagao — exact, aur na ho to inexact.
 *
 * ⚠️ Exact alarm ki permission (SCHEDULE_EXACT_ALARM) na ho to notifee THROW
 * karta hai. Purana code use chup-chaap nigal ke `false` lauta deta tha, aur
 * natija ye hota tha ki reminder ka alarm lagta hi nahi tha — kahin koi error
 * bhi nahi dikhta tha, aur user ko lagta tha app hi toot gayi. Der se aana, na
 * aane se behtar hai.
 *
 * `onFallback` se caller ko pata chal jaata hai ki alarm inexact laga hai (~10
 * min ki window) — permission modal wahi jaankari dikhata hai.
 */
export async function scheduleNotificationAt(
  notification: Notification,
  when: Date,
  hooks?: { onFallback?: (e: unknown) => void; onFail?: (e: unknown) => void },
): Promise<boolean> {
  if (when.getTime() <= Date.now()) return false;

  const trigger = (type: AlarmType): TimestampTrigger => ({
    type: TriggerType.TIMESTAMP,
    timestamp: when.getTime(),
    /**
     * ⚠️ Pehle yahan sirf `{ allowWhileIdle: true }` tha. Wo notifee ka
     * deprecated flag hai aur alarm ko SET_AND_ALLOW_WHILE_IDLE banata hai —
     * yaani **inexact**. Android aise alarms ko ~10 min ki window me doosre
     * alarms ke saath batch karta hai, isliye 8:36 wala reminder 8:38 pe 8:39
     * wale ke saath ek jhund me aata tha. SET_EXACT_AND_ALLOW_WHILE_IDLE se
     * alarm doze me bhi theek us minute par bajta hai.
     */
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
    try {
      await notifee.createTriggerNotification(
        notification,
        trigger(AlarmType.SET_AND_ALLOW_WHILE_IDLE),
      );
      hooks?.onFallback?.(exactErr);
      return true;
    } catch (e) {
      hooks?.onFail?.(e);
      return false;
    }
  }
}

export async function cancelNotification(id: string): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(id);
    await notifee.cancelNotification(id);
  } catch {
    /* already gone */
  }
}

/**
 * Reminder ko 5 minute aage sarka do — **abhi, isi lamhe.**
 *
 * ⚠️ Ye function poori tarah self-contained hai (na network, na DB, na app ka
 * chalna zaroori), aur wahi iska poora point hai. Alarm `AlarmManager` par
 * baithta hai jo OS ke paas hai — uske baad app band ho jaye, phone band ho
 * jaye, ya user recents se app hata de, alarm phir bhi bajta hai.
 *
 * `labels` original notification ke apne button se aate hain, dictionary se
 * nahi. Isse do faayde hain: headless task me poori i18n file load nahi karni
 * padti, aur snooze wale alarm ke button hubahu wahi rehte hain jo pehle the
 * (chahe user ne beech me bhasha badal di ho, us notification ka apna text wahi
 * rehta hai jo user ne abhi dekha tha).
 */
export async function snoozeNotification(
  n: Notification,
  delayMs: number = SNOOZE_MS,
): Promise<boolean> {
  const data = (n.data ?? {}) as { kind?: string; id?: string; body?: string; title?: string };
  const base = baseReminderId(String(data.id ?? n.id ?? ""));
  if (!base) return false;

  /**
   * Labels original se — aur `quiet` copy me bhi wahi hote hain, isliye tray me
   * bachi chup parchi se snooze karna bhi utna hi theek chalta hai.
   */
  const acts = n.android?.actions;
  const labels: ActionLabels | undefined =
    acts && acts.length >= 2 ? { done: acts[0].title, later: acts[1].title } : undefined;

  const id = `${SNOOZE_PREFIX}${base}`;
  // Purani snooze (user ne dobara "abhi nahi" dabaya) hata do — warna ek hi
  // reminder ke do alarm do alag waqt par bajte hain.
  await cancelNotification(id);

  /**
   * ⚠️ Notification DOBARA BANATE hain, purani ko copy nahi karte.
   *
   * Copy karna seedha lagta hai par ek chupa hua bug laata: tray me bachi parchi
   * CHUP channel par hoti hai (`quiet`), bina awaaz aur bina full-screen ke. Use
   * jaisa ka waisa aage sarka dene par snooze ka alarm chup-chaap aata — yaani
   * "5 min baad" dabane wale ko 5 minute baad kuch sunayi hi na deta.
   */
  return scheduleNotificationAt(
    buildAlarmNotification({
      id,
      // Title notification ka apna (bhasha se aaya hua "Reminder"), body me kaam.
      title: n.title ?? String(data.title ?? ""),
      body: n.body ?? String(data.body ?? ""),
      kind: data.kind === "expiry" ? "expiry" : "reminder",
      labels,
    }),
    new Date(Date.now() + delayMs),
  );
}
