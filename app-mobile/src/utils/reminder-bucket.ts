/**
 * Reminder kis khaane me jaayega — CHAAR khaane, aur ye hi poori list ka bharosa.
 *
 * ── Ye alag file kyun hai ───────────────────────────────────────────────
 *
 * Ye hisaab pehle `app/(tabs)/reminders.tsx` ke andar pada tha, aur wahin do
 * baar galat nikla:
 *
 *   1. Pehle sirf DO khaane the (`aaj` aur "baaki sab"), isliye 5 August ka
 *      beeta hua reminder bhi "Aane wale" me baith jaata tha.
 *   2. Uske fix ke baad bhi aadha bug bacha raha — user ne wahi pakda: "jo HO
 *      GAYA h wo aane wale me aata h". Band/nipta hua reminder `missed` se bahar
 *      tha (theek), par `upcoming` ki shart sirf "aaj ka nahi + chhoota hua
 *      nahi" thi, isliye wo wahin gir jaata tha.
 *
 * Dono baar galti ek hi kism ki thi: chaar shartein alag-alag jagah likhi thi
 * aur unhe SAATH me padh ke ye jaanchna mushkil tha ki wo poori list ko theek se
 * baant rahi hain ya nahi. Ab wo ek jagah hain, pure hain (na React, na
 * `new Date()` render me), aur `bucketOf()` ek hi jawab deta hai — yaani ek
 * reminder do khaanon me ja hi nahi sakta, aur bina khaane ke bhi nahi reh
 * sakta. Wahi is screen ka sabse zaroori bharosa hai: list se gayab ho jaana is
 * app ka sabse mehnga bug hai.
 */

export type Bucket =
  /** Waqt nikal gaya, par reminder ABHI BHI chalu — inpar kuch karna baaki hai. */
  | "missed"
  /** Aaj bajega. */
  | "today"
  /** Aage ka (ya jiska waqt abhi tay hi nahi hua). */
  | "upcoming"
  /** Waqt bhi nikal gaya AUR switch bhi band — "ho chuke". */
  | "past";

/** Jitna is hisaab ke liye chahiye, utna hi. */
export type BucketInput = {
  remind_at: string | null;
  is_on: boolean;
  is_paused: boolean;
};

/** Ye reminder aaj hi bajega? (Home tab bhi bilkul yahi hisaab lagata hai.) */
export function isToday(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Waqt aaj ke shuru hone se PEHLE ka hai?
 *
 * `remind_at` khaali ho to `false`: bina waqt wala reminder beeta hua nahi hai,
 * wo bas abhi tay nahi hua. Kharaab date par bhi `false` — ek na-padhi ja sakne
 * wali date ko "beet chuka" maan lena use galat khaane me daal deta.
 */
export function isBeforeToday(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  if (isToday(iso, now)) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return d.getTime() < start.getTime();
}

/**
 * Is reminder ka ek hi khaana.
 *
 * ⚠️ Tarteeb maayne rakhti hai:
 *
 *   1. **Aaj** sabse pehle — aaj ka reminder aaj ka hi hai, chahe wo band ho ya
 *      paused. Use "ho chuke" me daalna aaj ke kaam ko chhupa dena hoga.
 *   2. Uske baad hi ye poochha jaata hai ki waqt beet chuka hai ya nahi.
 *   3. Beeta hua + chalu = **chhoot gaya** (kuch karna baaki hai).
 *      Beeta hua + band/paused = **ho chuka** (kuch karna baaki nahi).
 *
 * ⚠️ Band/paused reminder ko "chhoot gaya" me daalna galat hai: band karne ka
 * matlab hi ye tha ki ab uski yaad nahi chahiye. Use "inka waqt nikal chuka hai"
 * wale khaane me sabse upar dikhana us faisle ko ulta deta hai.
 */
export function bucketOf(r: BucketInput, now: Date = new Date()): Bucket {
  if (isToday(r.remind_at, now)) return "today";
  if (!isBeforeToday(r.remind_at, now)) return "upcoming";
  return r.is_on && !r.is_paused ? "missed" : "past";
}
