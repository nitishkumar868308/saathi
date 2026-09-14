/**
 * Reminder kis khaane me jaayega — TEEN khaane, aur ye hi poori list ka bharosa.
 *
 * ── Ye alag file kyun hai ───────────────────────────────────────────────
 *
 * Ye hisaab pehle `app/(tabs)/reminders.tsx` ke andar pada tha, aur wahin do
 * baar galat nikla (beeta hua reminder "Aane wale" me, nipta hua bhi "Aane
 * wale" me). Dono baar galti ek hi kism ki thi: shartein alag-alag jagah likhi
 * thi. Ab wo ek jagah hain, pure hain (na React, na `new Date()` render me), aur
 * `bucketOf()` ek hi jawab deta hai — yaani ek reminder do khaanon me ja hi
 * nahi sakta, aur bina khaane ke bhi nahi reh sakta.
 *
 * ── Teen khaane kyun (pehle chaar the) ─────────────────────────────────
 *
 * ⚠️ Shikayat: "kuch bhi chhoot gaye me nahi jaana chahiye. Aaj wala tabhi tak
 * dikhe jab tak aane wala hai — 1:43 wala 1:43 par apne aap 'ho chuke' me jaana
 * chahiye tha".
 *
 * Pehle "Aaj" ka matlab tha "aaj ki TAARIKH" — dopahar 1:43 wala reminder raat
 * 12 baje tak "Aaj" me hi pada rehta tha, aur kal subah wahi "Chhoot gaye" me
 * chala jaata. Ab hisaab WAQT se hai, taarikh se nahi:
 *
 *   • today    — aaj ka, aur waqt ABHI aana baaki hai
 *   • upcoming — aaj ke baad ka (ya jiska waqt tay hi nahi)
 *   • past     — waqt nikal chuka ("Ho chuke")
 *
 * ⚠️ Roz/har hafte wala reminder "past" me TABHI jaata hai jab poori series
 * khatam ho. Uska ek din ka waqt nikalne par wo agle occurrence ke hisaab se
 * "today"/"upcoming" me rehta hai — warna chalu roz wala reminder "Ho chuke" me
 * dikhta, jo jhooth hai (`effectiveAt` dekho).
 */

export type Bucket =
  /** Aaj bajega — waqt abhi aana baaki hai. */
  | "today"
  /** Aaj ke baad ka (ya jiska waqt abhi tay hi nahi hua). */
  | "upcoming"
  /** Waqt nikal chuka — "ho chuke". */
  | "past";

/** Jitna is hisaab ke liye chahiye, utna hi. */
export type BucketInput = {
  remind_at: string | null;
  is_on: boolean;
  is_paused: boolean;
  /** 1 = roz, 7 = har hafte. null/0 = ek hi baar. */
  repeat_every_days?: number | null;
  /** Aakhri din (YYYY-MM-DD) — us din ki raat tak. */
  repeat_until?: string | null;
};

/** Do date ek hi local din ki hain? */
export function isSameLocalDay(d: Date, now: Date): boolean {
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Ye waqt aaj ki taarikh ka hai? (Home tab bhi yahi hisaab lagata hai.) */
export function isToday(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return isSameLocalDay(d, now);
}

/**
 * `YYYY-MM-DD` ka aakhri pal (local).
 *
 * ⚠️ `notifications.ts` ka `endOfDay` bhi bilkul yahi hai — "90 din tak" ka
 * matlab us din ki raat tak. Dono alag hote to alarm bajta par list me reminder
 * "ho chuke" dikhta (ya ulta).
 */
function endOfDay(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999).getTime();
}

/** `d` me `days` din jodo — calendar ke hisaab se (ghadi ka waqt wahi rahe). */
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Is reminder ka "abhi wala" waqt — list ise dikhati hai aur isi se khaana tay
 * hota hai.
 *
 * Ek baar wale reminder ke liye ye seedha `remind_at` hai.
 *
 * ⚠️ Roz wale ke liye `remind_at` PURANA ho sakta hai: server use tabhi aage
 * sarkaata hai jab cron bheje ya user "Ho gaya" dabaye — aur app band ho ya net
 * na ho to wo pal aata hi nahi. Phone ka alarm to agle din bajta hai (series
 * lagi hai), par list purane `remind_at` ko dekh ke use "ho chuke" me daal
 * deti. Isliye yahan agla aane wala occurrence nikalte hain — wahi jo alarm
 * bajayega.
 *
 * Band/paused reminder ka agla occurrence nahi hota — uska waqt jo hai wahi hai.
 * Series `repeat_until` paar kar gayi ho to aakhri occurrence (beeta hua).
 */
export function effectiveAt(r: BucketInput, now: Date = new Date()): Date | null {
  if (!r.remind_at) return null;
  const first = new Date(r.remind_at);
  if (isNaN(first.getTime())) return null;

  const every = r.repeat_every_days ?? 0;
  if (every < 1 || !r.is_on || r.is_paused || first.getTime() > now.getTime()) return first;

  // Kitne kadam aage — ms se andaza, phir calendar par theek.
  const approx = Math.floor((now.getTime() - first.getTime()) / (every * 86_400_000));
  let k = Math.max(0, approx - 1);
  let next = addDays(first, k * every);
  while (next.getTime() <= now.getTime()) {
    k += 1;
    next = addDays(first, k * every);
  }

  const last = r.repeat_until ? endOfDay(r.repeat_until) : null;
  if (last !== null && next.getTime() > last) {
    // Series khatam — aakhri occurrence jo `until` ke andar tha.
    const prev = addDays(first, (k - 1) * every);
    return prev.getTime() <= last ? prev : first;
  }
  return next;
}

/**
 * Is reminder ka ek hi khaana.
 *
 * ⚠️ Tarteeb: pehle "waqt hai hi nahi" (upcoming), phir "waqt nikal gaya"
 * (past), aur bache hue me aaj vs aage. Band/paused bhi isi niyam se — aage ka
 * band reminder aage hi dikhta hai (user dobara chalu kar sakta hai), beeta hua
 * "ho chuke".
 */
export function bucketOf(r: BucketInput, now: Date = new Date()): Bucket {
  const at = effectiveAt(r, now);
  if (!at) return "upcoming";
  if (at.getTime() <= now.getTime()) return "past";
  return isSameLocalDay(at, now) ? "today" : "upcoming";
}

/**
 * Agla pal jab kisi reminder ka khaana badlega — screen tab tak so sakti hai.
 *
 * Do tarah ke pal: kisi reminder ka waqt (today → past, ya roz wale ka agla
 * din), aur aadhi raat (kal wale "upcoming" aaj ke "today" ban jaate hain).
 */
export function msUntilNextChange(list: BucketInput[], now: Date = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  let best = midnight.getTime() - now.getTime();
  for (const r of list) {
    const at = effectiveAt(r, now);
    if (at && at.getTime() > now.getTime()) {
      best = Math.min(best, at.getTime() - now.getTime());
    }
  }
  return Math.max(0, best);
}
