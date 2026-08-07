import AsyncStorage from "@react-native-async-storage/async-storage";

import { addReminder, listReminders, ReminderLimitError, type Reminder } from "./reminders";
import { linkNoteReminder } from "./notes";
import { cancelReminder, scheduleReminderSeries } from "./notifications";
import { isNetworkError } from "./net-alert";
import { reportError } from "./report-error";
import { emitDataChanged } from "./data-events";

/**
 * Offline me banaya gaya reminder — jab tak server tak na pahunche.
 *
 * ⚠️ Pehle offline reminder banta hi nahi tha. `addReminder()` seedha Supabase
 * par insert karta hai, isliye net na hone par wo throw karta tha, net-alert ka
 * popup khulta tha, aur user ki baat kahin bachti hi nahi thi. Ye ulta tha:
 * reminder ka ALARM poori tarah phone ke andar (notifee) lagta hai — usse
 * internet ki zaroorat hai hi nahi. Sirf DB wali row ke liye net chahiye tha,
 * aur usi ek row ki wajah se poora kaam ruk jaata tha.
 *
 * Ab do hisse alag ho gaye:
 *
 *   1. Alarm TURANT lag jaata hai — offline banaya reminder theek waqt par
 *      bajta hai, chahe net kabhi wapas aaye ya na aaye.
 *   2. DB wali row yahan kataar me lag jaati hai, aur net wapas aate hi khud
 *      chali jaati hai.
 *
 * Local id `local:` se shuru hoti hai. Server wali id UUID hoti hai, isliye
 * dono kabhi takra nahi sakti — aur `syncNotifications()` sirf unhi ids ke
 * alarm cancel karta hai jo server se aayi list me hain, isliye kataar me pada
 * reminder kisi sync me chup-chaap mit nahi jaata.
 */

const KEY = "saathi-reminder-outbox";

export type OutboxInput = {
  /**
   * Kis note se bana hai (agar note se bana ho).
   *
   * ⚠️ Ye server par jaane wale reminder ka hissa NAHI hai — `addReminder` ko
   * ye kabhi nahi jaata. Ye sirf yahan bacha ke rakha jaata hai taaki flush ke
   * baad, jab reminder ki ASLI id mil jaye, note se uska rishta jod diya jaye.
   * Bina iske offline banaya reminder note par kabhi nishaan hi na lagata, aur
   * user use dobara laga deta.
   */
  noteId?: string | null;
  title: string;
  note?: string | null;
  time_label: string | null;
  remind_at: string | null;
  bucket: string;
  repeat_every_days?: number | null;
  repeat_until?: string | null;
};

export type OutboxItem = OutboxInput & {
  /** `local:...` — jab tak server ki asli id na mile. */
  id: string;
  queuedAt: number;
};

/** `local:` wali id? (UI isse "abhi bheja jaayega" wala nishaan dikha sakti hai.) */
export function isPendingId(id: string): boolean {
  return id.startsWith("local:");
}

async function read(): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as OutboxItem[];
    return Array.isArray(list) ? list : [];
  } catch {
    // Kharab/adhoora data — usse chipke rehne se behtar hai saaf shuruaat.
    return [];
  }
}

async function write(list: OutboxItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    // Ye chup-chaap fail hua to user ka reminder gum ho jaayega — alarm to bajega
    // par server par kabhi nahi pahunchega, aur doosre phone par kabhi nahi
    // dikhega. Isliye ise dabana nahi hai.
    reportError(e, { screen: "reminder-outbox", action: "write" }, "warn");
  }
}

/** Kataar me pade reminders (list screens inhe apne data ke saath dikhati hain). */
export async function pendingReminders(): Promise<Reminder[]> {
  const list = await read();
  return list.map((r) => ({
    id: r.id,
    title: r.title,
    note: r.note ?? null,
    time_label: r.time_label,
    remind_at: r.remind_at,
    repeat_every_days: r.repeat_every_days ?? null,
    repeat_until: r.repeat_until ?? null,
    last_done_at: null,
    is_on: true,
    is_paused: false,
    bucket: r.bucket,
    user_id: null,
    created_at: new Date(r.queuedAt).toISOString(),
  }));
}

/**
 * Server ke reminders + kataar me pade reminders, ek hi list me.
 *
 * List screens ise `listReminders()` ki jagah use karti hain. Bina iske offline
 * banaya reminder screen par dikhta hi nahi — alarm lag chuka hota hai par user
 * ko lagta hai kuch bana hi nahi, aur wo wahi reminder dobara bana deta hai.
 *
 * Kataar wale upar rakhe hain: wo abhi-abhi bane hain, aur unhi ke baare me
 * user ko sabse pehle yaqeen chahiye ki "haan, bach gaya".
 */
export async function listRemindersWithPending(): Promise<Reminder[]> {
  const [server, pending] = await Promise.all([listReminders(), pendingReminders()]);
  return [...pending, ...server];
}

/** Reminder kataar me daalo aur uski local id lauta do. */
async function queue(input: OutboxInput): Promise<string> {
  const id = `local:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const list = await read();
  list.push({ ...input, id, queuedAt: Date.now() });
  await write(list);
  return id;
}

/**
 * Kataar me pada reminder hata do (+ uske alarm).
 *
 * Delete hi ek aisa kaam hai jo `local:` wale reminder par poori tarah ho sakta
 * hai — kyunki poora reminder abhi sirf isi phone par hai. Toggle aur "ho gaya"
 * server ki row par chalte hain (`complete_reminder` RPC), jo abhi banī hi nahi
 * hai; unhe yahan nakal karna do alag sach paida karta — isliye UI wo dono
 * sirf sync hone ke baad karne deta hai.
 */
export async function removeFromOutbox(id: string): Promise<boolean> {
  const list = await read();
  const left = list.filter((r) => r.id !== id);
  if (left.length === list.length) return false;
  await write(left);
  await cancelReminder(id);
  return true;
}

export type SaveResult = {
  /** Reminder ki id — server wali ya `local:` wali. */
  id: string;
  /** true = abhi sirf phone par hai, server par jaana baaki hai. */
  pending: boolean;
};

/**
 * Reminder banao — net ho to server par, na ho to kataar me.
 *
 * Sirf NETWORK wali galti kataar me jaati hai. Limit cross hone (`ReminderLimit`)
 * ya RLS jaisi baaki galtiyan waise hi aage jaati hain: unhe "baad me bhej denge"
 * keh dena jhooth hoga — wo baad me bhi fail hi hongi.
 */
export async function saveReminder(input: OutboxInput): Promise<SaveResult> {
  try {
    // `noteId` sirf hamare apne hisaab ke liye hai — DB ki `reminders` table me
    // aisa koi column nahi, aur bhej dene par insert hi fail ho jaata.
    const { noteId, ...row } = input;
    const r = await addReminder(row);
    if (noteId) await linkNoteReminder(noteId, r.id).catch(() => {});
    return { id: r.id, pending: false };
  } catch (e) {
    if (e instanceof ReminderLimitError || !isNetworkError(e)) throw e;
    return { id: await queue(input), pending: true };
  }
}

/**
 * Kataar khaali karo — net wapas aane par.
 *
 * Har item par: server par insert karo, phir uske local alarm hata ke ASLI id
 * par dobara lagao. Ye dobara-lagana chhoda nahi ja sakta — `syncNotifications()`
 * server wali id se alarm lagata hai, aur purane `local:` wale alarm uske saath
 * chalte rehte to ek hi reminder do baar bajta.
 *
 * Net abhi bhi na ho to item kataar me hi rehta hai (koi nuksan nahi, agli baar
 * phir koshish hogi). Limit cross ho gayi ho to item hata dete hain aur uske
 * alarm bhi — warna wo alarm hamesha bajta rehta aur uske peeche koi reminder
 * hota hi nahi.
 */
let flushing: Promise<{ sent: number; dropped: number }> | null = null;

export function flushOutbox(): Promise<{ sent: number; dropped: number }> {
  // ⚠️ Ek waqt me sirf EK flush.
  //
  // Ise do jagah se bulaya jaata hai (`_layout.tsx`): login hone par, aur app ke
  // wapas saamne aane par. Ye dono aksar ek hi pal me hote hain — login ke baad
  // permission ka dialog band hote hi AppState "active" ho jaata hai.
  //
  // Bina is rok ke dono `read()` se WAHI list uthate the aur dono usi reminder
  // ko server par insert kar dete the. Natija: ek hi reminder do baar, dono ke
  // apne alarm, aur user ko do baar bajta hua reminder — jiski wajah kahin
  // dikhti bhi nahi. `write(left)` bhi aakhir me chalta hai, isliye ek flush
  // doosre ka kaam mita bhi sakta tha.
  //
  // Chalu flush ka wahi promise wapas de dete hain: dono callers ko sahi ginti
  // milti hai aur `.finally(syncNotifications)` bhi theek waqt par chalta hai.
  if (flushing) return flushing;
  flushing = runFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function runFlush(): Promise<{ sent: number; dropped: number }> {
  const list = await read();
  if (list.length === 0) return { sent: 0, dropped: 0 };

  const left: OutboxItem[] = [];
  let sent = 0;
  let dropped = 0;

  for (const item of list) {
    try {
      const r = await addReminder({
        title: item.title,
        note: item.note ?? null,
        time_label: item.time_label,
        remind_at: item.remind_at,
        bucket: item.bucket,
        repeat_every_days: item.repeat_every_days ?? null,
        repeat_until: item.repeat_until ?? null,
      });
      // Ab asli id hai — note se jod do. Fail ho jaye to reminder phir bhi ban
      // chuka hai aur bajega; sirf note par nishaan nahi lagega, isliye ye poore
      // flush ko rokta nahi.
      if (item.noteId) {
        await linkNoteReminder(item.noteId, r.id).catch(() => {});
      }
      await cancelReminder(item.id);
      if (r.remind_at) {
        await scheduleReminderSeries(
          r.id,
          r.title,
          new Date(r.remind_at),
          r.repeat_every_days,
          r.repeat_until,
        );
      }
      sent++;
    } catch (e) {
      if (isNetworkError(e)) {
        // Net abhi bhi nahi — kataar me hi rehne do.
        left.push(item);
        continue;
      }
      // Limit / permission / koi aur pakki galti — ye baad me bhi nahi jaayega.
      await cancelReminder(item.id);
      dropped++;
      reportError(e, { screen: "reminder-outbox", action: "flush", title: item.title }, "warn");
    }
  }

  await write(left);
  // Ek bhi reminder server par gaya to uski id badal chuki hai — khuli hui
  // list screens ko dobara padhna hoga, warna wahan purani `local:` wali row
  // padi rehti hai.
  if (sent > 0 || dropped > 0) emitDataChanged();
  return { sent, dropped };
}
