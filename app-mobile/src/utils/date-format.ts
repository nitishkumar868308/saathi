/**
 * Date ka ek hi niyam, poori app ke liye: **ISO andar, user ki apni shakl bahar.**
 *
 * ⚠️ Ye file isliye bani ki app sirf India ke liye nahi hai, par uski har date
 * India (aur ISO) maan ke likhi ja rahi thi. Do alag galtiyan chal rahi thi:
 *
 *  1. **User se ISO likhwana.** Expiry ka khaana ek TextInput tha jiska
 *     placeholder `YYYY-MM-DD` tha. Ye India me bhi ajeeb hai (log 15/08/2029
 *     likhte hain) aur America me to seedha galat — wahan 03/11 ka matlab 11
 *     March nahi, 3 November hota hai. Ek galat expiry sabse mehngi galti hai:
 *     us document ka reminder galat din bajta hai aur kisi ko pata bhi nahi
 *     chalta ki wo kahan se aayi thi.
 *
 *  2. **Dikhate waqt `en-IN` hardcode karna.** Har screen `locale === "hi" ?
 *     "hi-IN" : "en-IN"` likhti thi. Yaani London ka user bhi Indian format
 *     dekhta tha, aur New York ka bhi.
 *
 * Ab: DB me hamesha ISO (`YYYY-MM-DD`) — wahi sort hota hai, wahi Postgres ka
 * `date` column hai, wahi cron padhta hai. Aur user ko hamesha USKI apni shakl,
 * jo uske PHONE ki regional setting se aati hai.
 */

/**
 * Kis locale me date dikhani hai.
 *
 * `undefined` ka matlab hai "phone ki apni setting" — aur wahi sabse sahi jawab
 * hai. Phone hi wo ek jagah hai jahan user ne apna desh aur apni pasand pehle se
 * tay kar rakhi hai: en-IN par "15 Aug 2029", en-US par "Aug 15, 2029", en-GB
 * par "15 Aug 2029", de-DE par "15.08.2029".
 *
 * Ek hi apwaad: user ne app ki bhasha **Hindi** chuni ho. Tab wo Devanagari me
 * padhna chahta hai, chahe phone angrezi par set ho — wo ek jaan-boojh ke liya
 * gaya faisla hai aur use anadekha karna galat hoga.
 *
 * "hinglish" aur "en" dono par phone ki setting hi chalti hai — dono Latin
 * script me hain, aur unme desh ka format hi asli baat hai.
 */
export function dateLocale(appLocale?: string): string | undefined {
  return appLocale === "hi" ? "hi-IN" : undefined;
}

/** 'YYYY-MM-DD' → Date (LOCAL midnight). Galat ho to `null`. */
export function fromIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  /**
   * ⚠️ Round-trip check — bina iske `2027-02-29` chup-chaap 1 March ban jaata
   * hai (JavaScript din ke overflow ko sarka deta hai). `utils/expiry.ts` ke
   * `isValidDate` me iski poori wajah likhi hai.
   */
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Date → 'YYYY-MM-DD' — LOCAL din ke hisaab se.
 *
 * ⚠️ `toISOString().slice(0, 10)` yahan kabhi mat likhna. Wo UTC me badalta hai,
 * aur India (UTC+5:30) me raat 12 se 5:30 ke beech chuni gayi date EK DIN PEECHE
 * chali jaati hai. Yaani user 15 tarikh chunta aur DB me 14 baithta.
 */
export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 'YYYY-MM-DD' ko user ki apni shakl me — "15 Aug 2029" / "15.08.2029".
 *
 * Galat/khaali ISO par wahi string wapas milti hai (crash se behtar), par
 * aisa hona hi nahi chahiye — sab jagah picker se hi date aati hai.
 */
export function formatDate(iso: string, appLocale?: string): string {
  const d = fromIsoDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(dateLocale(appLocale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Wahi date, par mahine ka poora naam — "15 August 2029". */
export function formatDateLong(iso: string, appLocale?: string): string {
  const d = fromIsoDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(dateLocale(appLocale), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Sirf mahine ka naam — "February". Galat date ki wajah batane ke liye. */
export function monthName(year: number, month1to12: number, appLocale?: string): string {
  return new Date(year, month1to12 - 1, 1).toLocaleDateString(dateLocale(appLocale), {
    month: "long",
  });
}

/** Us mahine me kitne din hote hain. (Agle mahine ka "0" din = is ka aakhri.) */
export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}
