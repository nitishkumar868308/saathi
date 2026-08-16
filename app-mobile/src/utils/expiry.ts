export type ExpiryStatus = "safe" | "soon" | "expired";

/**
 * Expiry tak kitne DIN bache — calendar ke hisaab se, ghanton ke nahi.
 *
 * ⚠️ Pehle yahan seedha `new Date("2026-08-15")` chalta tha. JavaScript us
 * shakl ko **UTC aadhi raat** maanta hai, jabki `now` device ka LOCAL time
 * hota hai. India me (UTC+5:30) iska matlab tha ki har expiry apne din ki
 * subah 5:30 par baithi hoti thi, aur raat 12 se 5:30 ke beech ginti ek din
 * zyada nikalti thi: jo document KAL expire ho raha hai uske liye app "2 din
 * me" likhti thi.
 *
 * Wo khidki bilkul us waqt par padti hai jab ye app sabse zyada dekhi jaati
 * hai — subah-subah, aur reminder to 6 baje se hi bajne lagte hain.
 *
 * `notifications.ts` ka `expiryDate()` ye date pehle se LOCAL maan ke padhta
 * hai. Yaani ek hi date do jagah do matlab rakhti thi: notification sahi din
 * aati thi aur card uske alag din dikhata tha. Ab dono ek hi hisaab par hain.
 *
 * `Math.round` isliye (floor/ceil nahi): DST ya kisi bhi 23/25-ghante wale din
 * par bhi ginti poore din par tikki rahe.
 */
function daysUntil(expiryDate: string, now: Date): number {
  const [y, m, d] = expiryDate.split("-").map(Number);
  // Aadhi-adhoori shakl (jaise poora ISO timestamp) — tab purane raaste par.
  const target = y && m && d ? new Date(y, m - 1, d) : new Date(expiryDate);
  target.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Returns expiry bucket. `soon` = within 14 days (inclusive). */
export function expiryStatus(
  expiryDate: string,
  now: Date = new Date(),
): ExpiryStatus {
  const days = daysUntil(expiryDate, now);
  if (days < 0) return "expired";
  if (days <= 14) return "soon";
  return "safe";
}

/** Aaj se N mahine baad ki date, 'YYYY-MM-DD' format mein. */
export function dateAfterMonths(months: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 'YYYY-MM-DD' — shakl bhi sahi ho AUR wo din sach me maujood bhi ho.
 *
 * ⚠️ Yahan pehle sirf `new Date(s)` ka `isNaN` check tha, aur wo ek asli bug
 * tha jise user ne theek pakda: `2027-02-29` par "Couldn't save" aata tha, bina
 * koi wajah bataye.
 *
 * Wajah ye hai ki JavaScript din ke OVERFLOW ko chup-chaap aage sarka deta hai:
 *
 *     new Date("2027-02-29")  →  Mon Mar 01 2027   (Invalid Date NAHI)
 *     new Date("2027-04-31")  →  Sat May 01 2027
 *     new Date("2027-13-01")  →  Invalid Date      (mahina galat ho tabhi pakda)
 *
 * Yaani 29 Feb 2027 poora client paar kar jaata tha, aur Postgres ka `date`
 * column use reject karta tha — jahan hamare paas sirf ek generic "save nahi
 * hua" bacha tha. User ke liye wo bilkul bebuniyad error tha: usne to sahi
 * format me hi likha tha.
 *
 * Aur ye sirf ek screen ki baat nahi thi. Yahi function AI ke padhe hue documents
 * ki expiry bhi chhaanta hai — yaani AI kabhi 29 Feb padh leta to wo chup-chaap
 * 1 March ban ke DB me baith jaata, aur reminder galat din bajta. Aisi galti
 * pakadna lagbhag namumkin hota hai.
 *
 * Round-trip check hi ek bharosemand tareeka hai: date banao, aur phir poochho
 * ki usme wahi teen ank bache hain kya. Sarak gaya ho to nahi bachenge.
 */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  // Local midnight — poori file isi hisaab par chalti hai (upar `daysUntil`).
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Shakl to theek hai, par wo din us mahine me hai hi nahi (jaise `2027-02-29`).
 *
 * ⚠️ Ye `isValidDate` se ALAG isliye hai kyunki dono galtiyan user ke liye
 * bilkul alag hain, aur dono ko ek hi "Date format: YYYY-MM-DD" dikhana ulta
 * galat raasta dikhata hai — format to bilkul sahi tha. Isse screen ye keh
 * paati hai ki "Feb 2027 me sirf 28 din hain", jo aadmi seedha samajh leta hai.
 */
export function isImpossibleDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isValidDate(s);
}

/**
 * Document expiry ka teen-qadam ladder: 7 din pehle, 1 din pehle, aur us din.
 *
 * ⚠️ Ye pehle `lib/notifications.ts` ke andar band tha, aur isi wajah se add
 * wali screen user ko ye kabhi bata nahi paati thi ki khabar kab-kab aayegi.
 * Ab ye yahan (bina kisi native module ke) rehta hai, aur `notifications.ts`
 * isi ko import karta hai — do jagah do ladder ho hi nahi sakte.
 *
 * ⚠️ Web ka cron (`web/app/api/cron/document-expiry/route.ts`) bhi ISI ladder
 * par email + WhatsApp bhejta hai. Ek jagah badla aur doosri jagah nahi, to
 * notification aaj aayegi aur email kisi aur din — sabse bura tajurba.
 */
export const EXPIRY_LEAD_DAYS = [7, 1, 0] as const;

/** Expiry ki khabar din ke kis waqt aati hai. */
export const NOTIFY_HOUR = 9;

/** Ek qadam — kab, kitne din pehle, aur kya wo abhi bhi aane wala hai. */
export type ExpiryNotifyStep = {
  /** Expiry se kitne din pehle. 0 = expiry wale din khud. */
  lead: number;
  /** Theek kis lamhe khabar aayegi. */
  at: Date;
  /**
   * Ye qadam ab bhi aane wala hai?
   *
   * ⚠️ `false` bhi dikhana zaroori hai, chhupana nahi. 3 din baad expire hone
   * wale document par "7 din pehle" wala qadam beet chuka hai — wo kabhi nahi
   * aayega. Use chup-chaap gira dena user ko ye bhram deta hai ki app ne teenon
   * laga diye hain.
   */
  willFire: boolean;
};

/**
 * Is expiry par khabar kab-kab aayegi — user ko dikhane ke liye.
 *
 * Hisaab bilkul wahi hai jo `scheduleDocumentExpiry()` karta hai (local
 * midnight + {@link NOTIFY_HOUR}), aur `willFire` bhi wahi shart hai jo
 * `schedule()` lagata hai (beeta hua waqt par kuch nahi lagta). Isliye screen
 * par jo likha hai, phone par theek wahi hota hai.
 */
export function expiryNotifyPlan(
  expiry: string,
  now: Date = new Date(),
): ExpiryNotifyStep[] {
  if (!isValidDate(expiry)) return [];
  const [y, m, d] = expiry.split("-").map(Number);
  return EXPIRY_LEAD_DAYS.map((lead) => {
    const at = new Date(y, m - 1, d, NOTIFY_HOUR, 0, 0, 0);
    at.setDate(at.getDate() - lead);
    return { lead, at, willFire: at.getTime() > now.getTime() };
  });
}

/**
 * Khabar ka waqt beet chuka tha — us document ko kitni der baad bataayein.
 *
 * 5 minute, aur teenon wajah maayne rakhti hain:
 *
 *   • Itni der me user Save dabaa ke screen se nikal chuka hota hai. Usi screen
 *     par bajne wala alert bhaddha lagta hai — wo abhi wahi kaam kar raha hai.
 *   • Itna kam hai ki wo abhi bhi "abhi wali" khabar hi lagti hai.
 *   • ⚠️ Aur ye ghadi ke farq ke liye jagah chhodta hai. Lamha `created_at` se
 *     ginta hai, jo SERVER ki ghadi hai, jabki alarm PHONE ki ghadi par lagta
 *     hai. Phone ki ghadi thodi aage ho (aam baat hai) aur ye number chhota ho,
 *     to hisaab beeta hua waqt nikal aata aur `schedule()` chup-chaap kuch
 *     lagata hi nahi — yaani wahi purana bug, bas ek nayi wajah se.
 */
export const CATCH_UP_DELAY_MS = 5 * 60_000;

/**
 * Aaj hi expire ho raha document, aur teenon qadam beet chuke — ab kab bataayein?
 *
 * ⚠️ Ye poora function ek asli, aur bilkul chup, khaali jagah bharta hai. Ladder
 * ke teenon qadam ek FIXED lamhe par baithte hain (7 din pehle / 1 din pehle /
 * us din — teenon subah 9 baje). Jo document DOPAHAR ko daala jaye aur AAJ HI
 * expire ho raha ho, uske teenon lamhe daalne se PEHLE hi nikal chuke hote hain:
 *
 *     subah 9:00  ← lead 0 ka lamha
 *     dopahar 2:30 ← user ne document daala
 *
 * `schedule()` beete waqt par kuch nahi lagata, isliye us document par EK BHI
 * alarm nahi lagta tha — aur screen teen kati hui lines dikha ke chup ho jaati
 * thi. User ne document isi liye daala tha ki use yaad dilaya jaye, aur usi din
 * kuch nahi aata tha. (Email/WhatsApp wahan bhi chale jaate hain: web ka cron
 * 25 ghante ki khidki rakhta hai — dekho `web/app/api/cron/document-expiry`.)
 *
 * Lamha `addedAt` se ginte hain, `Date.now()` se nahi, aur wahi is function ka
 * dil hai: `syncNotifications()` HAR baar app saamne aane par chalta hai aur har
 * document ka schedule dobara banata hai. "Abhi se 2 minute" hota to us din app
 * jitni baar khulti, utni baar ek naya alert lagta. `created_at` se ginne par
 * lamha hamesha WAHI ek nikalta hai — bajne ke baad wo beet chuka hota hai aur
 * `schedule()` khud hi use chhod deta hai. Isliye alert theek EK baar aata hai,
 * bina kisi jhande ya storage ke.
 *
 * `null` lauta to yahan kuch karna hi nahi hai — ya to ladder abhi zinda hai
 * (koi qadam aane wala hai), ya date hi beet chuki hai (uski apni chetavni
 * form par hai), ya date galat hai.
 */
export function expiryCatchUp(
  expiry: string,
  addedAt: Date | string | number = new Date(),
  now: Date = new Date(),
): Date | null {
  const plan = expiryNotifyPlan(expiry, now);
  // Date hi galat hai, ya ladder ka koi qadam abhi aana baaki hai.
  if (plan.length === 0 || plan.some((s) => s.willFire)) return null;
  // Din hi beet chuka — uski chetavni form par alag se hai, aur "aaj expire ho
  // raha hai" wali khabar wahan jhooth hoti.
  if (expiryStatus(expiry, now) === "expired") return null;

  const base = new Date(addedAt).getTime();
  if (!Number.isFinite(base)) return null;
  return new Date(base + CATCH_UP_DELAY_MS);
}

/**
 * Ye date beet chuki hai? (aaj wali date beeti hui NAHI hai.)
 *
 * ⚠️ Ye `expiryStatus()` par hi tika hai, apna alag hisaab nahi karta — aur ye
 * jaan-boojh ke hai. Dono jagah alag ganit hone par ek hi document par do alag
 * baatein dikhtin: card par "aaj expire ho raha hai" aur form par "ye date beet
 * chuki hai". Aisi do-zubani galti pakadna sabse mushkil hoti hai.
 *
 * Isliye ek hi jagah se jawab: `daysUntil` ka wahi LOCAL-midnight wala hisaab
 * (upar uski poori wajah likhi hai), aur wahi "aaj = abhi expired nahi" wala
 * niyam.
 *
 * Kis kaam ka: `add-document` isse form par turant chetavni dikhata hai. Beeti
 * hui expiry par notification lag hi nahi sakti (`schedule()` beete waqt par
 * kuch nahi lagata), aur pehle ye baat user ko kahin batayi hi nahi jaati thi —
 * use "Document add ho gaya 🎉" dikhta tha aur wo maan leta tha ki reminder lag
 * gaya.
 *
 * ⚠️ Ye ROK nahi hai. Expire ho chuka document daalna bilkul theek hai — app me
 * uske liye "expired" filter hai aur poora renewal-guide bhi (`renewal.ts`).
 * Isliye ye sirf batata hai, rokta nahi.
 */
export function isPastDate(s: string): boolean {
  return isValidDate(s) && expiryStatus(s) === "expired";
}

/** Labels for {@link expiryLabel} — user ki chuni bhasha se aate hain. */
export type ExpiryLabels = {
  expired: string;
  today: string;
  tomorrow: string;
  /** "{n}" din ki jagah lega */
  inDays: string;
};

/**
 * Human-friendly expiry label, chuni hui bhasha me. Labels caller (doc-card)
 * dict se pass karta hai — is util ko koi hardcoded text nahi rakhna.
 */
export function expiryLabel(
  expiryDate: string,
  labels: ExpiryLabels,
  now: Date = new Date(),
): string {
  const days = daysUntil(expiryDate, now);
  if (days < 0) return labels.expired;
  if (days === 0) return labels.today;
  if (days === 1) return labels.tomorrow;
  return labels.inDays.replace("{n}", String(days));
}
