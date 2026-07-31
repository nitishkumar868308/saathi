/**
 * Admin login par brute-force ki rok.
 *
 * ⚠️ Pehle `/api/admin/login` par koi rok thi hi nahi: koi bhi jitni marzi baar
 * password try kar sakta tha, utni hi tezi se jitni HTTP request ja sakein. Aur
 * wo ek password poore user database, sab documents, aur kisi ko bhi Plus dene
 * ki taakat kholta hai. Ek shared password + unlimited koshish = sirf waqt ki
 * baat.
 *
 * ⚠️ Ye rok **memory me** hai, isliye ye poori guarantee nahi hai: Vercel par
 * har serverless instance ka apna counter hota hai, aur bahut bhaari hamla kai
 * instance faila ke thodi der ko isse patla kar sakta hai. Phir bhi ye asli
 * kaam karti hai — aam script-wali koshish (ek jagah se hazaron guess) yahin
 * ruk jaati hai, aur uske liye kisi nayi table ya migration ki zaroorat nahi.
 *
 * Sach me pukhta chahiye to agla kadam ye hai: attempts ko Supabase me likho
 * (sab instance ek hi ginti dekhein), ya admin ko apne Supabase account +
 * 2FA ke peeche le jao.
 */

type Entry = {
  /** Is window me kitni galat koshish. */
  count: number;
  /** Window kab shuru hua. */
  windowStart: number;
  /** Is waqt tak band (0 = band nahi). */
  blockedUntil: number;
};

const attempts = new Map<string, Entry>();

/** Itni der me itni galat koshish — uske baad band. */
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;
const BLOCK_MS = 15 * 60_000;

/** Map ko badhne se roko — mare hue entries hata do. */
function prune(now: number): void {
  if (attempts.size < 500) return;
  // `forEach` isliye (for…of nahi): project ka tsconfig purane target par hai
  // aur Map ko seedha iterate karne se build hi fail ho jaata hai.
  const dead: string[] = [];
  attempts.forEach((e, key) => {
    if (e.blockedUntil < now && now - e.windowStart > WINDOW_MS) dead.push(key);
  });
  dead.forEach((k) => attempts.delete(k));
}

/**
 * Request kis "jagah" se aayi.
 *
 * Vercel `x-forwarded-for` bharta hai; sabse pehla hissa asli client hota hai.
 * Kuch na mile to ek hi bucket ("unknown") — us soorat me rok sabke liye ek
 * saath lagti hai, jo galat password ke liye theek hi hai.
 */
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

/** Abhi koshish karne di jaye? Nahi to kitne second baad. */
export function loginAllowed(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  prune(now);
  const e = attempts.get(key);
  if (!e) return { allowed: true, retryAfter: 0 };

  if (e.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((e.blockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Galat password — ginti badhao, aur hadd paar ho to band kar do. */
export function recordFailure(key: string): void {
  const now = Date.now();
  const e = attempts.get(key);

  // Window nikal chuka ho to nayi ginti — purani galtiyan hamesha yaad nahi rakhni.
  if (!e || now - e.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now, blockedUntil: 0 });
    return;
  }

  e.count += 1;
  if (e.count >= MAX_FAILURES) {
    e.blockedUntil = now + BLOCK_MS;
    e.count = 0;
    e.windowStart = now;
  }
}

/** Sahi password — slate saaf. */
export function recordSuccess(key: string): void {
  attempts.delete(key);
}
