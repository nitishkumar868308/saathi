import { createHash, randomInt } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * App lock (PIN) ka server wala hissa — "PIN bhool gaya" ka email OTP.
 *
 * ── Ye raasta kyun bana ────────────────────────────────────────────────────
 *
 * Pehle lock screen par sirf ek hi raasta tha: **Logout karo aur dobara login
 * karo.** Wo us waqt imaandaar tha, kyunki PIN sirf phone par hota tha aur
 * logout karne se wo apne aap chala jaata tha.
 *
 * Ab PIN account ka hissa hai (`supabase/app-lock.sql`), isliye wo raasta kaam
 * hi nahi karta — logout karke login karo to lock wapas aa jaata hai. Aur wo
 * theek hai: lock ka poora matlab hi yahi hai. Par iska matlab ye bhi hai ki
 * PIN bhoolne wale ke paas ab koi raasta hi nahi bacha — aur bina raaste ka
 * lock user ko uske apne documents se hamesha ke liye bahar kar deta hai.
 *
 * Isliye ek naya raasta: **account ke email par ek 6 ank ka code.** Wo email
 * usi user ka hai jiska lock hai, aur usi email se wo login bhi karta hai —
 * yaani ye lock ko kamzor nahi karta. Jiske haath phone laga hai uske paas is
 * account ka email nahi hoga.
 *
 * ⚠️ Code ka sirf HASH DB me jaata hai (pepper ke saath), bilkul phone wale OTP
 * ki tarah. Aur naya PIN bhi kabhi saaf nahi jaata — app hash+salt banati hai
 * aur wahi bhejti hai.
 */

/**
 * Hash ka pepper — phone wale OTP se ALAG.
 *
 * Alag isliye ki do alag maqsad ka ek hi secret na ho: kal ko phone wala pepper
 * badalna pade (ya leak ho) to PIN reset ke zinda code uske saath na girein.
 * Set na ho to phone wale par gir jaate hain — dev me chalane ke liye.
 */
const PEPPER =
  process.env.APP_LOCK_PEPPER ||
  process.env.OTP_PEPPER ||
  "saathi-dev-pepper-set-APP_LOCK_PEPPER-in-prod";

function headers() {
  return {
    apikey: SERVICE as string,
    Authorization: `Bearer ${SERVICE}`,
    "content-type": "application/json",
  };
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!SUPABASE_URL || !SERVICE) throw new Error("supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`rpc ${name} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * 6 ank ka code — `crypto` se, `Math.random()` se NAHI.
 *
 * `Math.random()` cryptographically secure nahi hai: kuch output dekh ke aage ke
 * output ka andaza lagaya ja sakta hai. Yahan iska matlab hota ki koi apne khud
 * ke do-teen code mangwa ke kisi aur ka code guess kar le.
 */
export function generateResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** User id bhi hash me — ek user ka hash doosre ki row par chipkaya na ja sake. */
export function hashResetCode(userId: string, code: string): string {
  return createHash("sha256").update(`${PEPPER}:${userId}:${code}`).digest("hex");
}

export type ResetIssue =
  | { status: "ok"; ttl: number }
  | { status: "cooldown" | "too_many"; retry_after: number }
  | { status: "invalid" };

export function resetIssue(
  userId: string,
  codeHash: string,
  ip: string | null,
): Promise<ResetIssue> {
  return rpc<ResetIssue>("app_lock_reset_issue", {
    p_user: userId,
    p_hash: codeHash,
    p_ip: ip,
  });
}

/** 'ok' | 'wrong' | 'expired' | 'locked' | 'none' */
export function resetCheck(userId: string, codeHash: string): Promise<string> {
  return rpc<string>("app_lock_reset_check", { p_user: userId, p_hash: codeHash });
}

/**
 * Naya PIN likho — service_role wali RPC se.
 *
 * ⚠️ App wali `set_app_lock` yahan JAAN-BOOJH KE use nahi hoti. Wo `auth.uid()`
 * par chalti hai, yaani app use bina koi code verify kiye khud bula sakti hai —
 * aur tab poora email-OTP sirf dikhawa reh jaata.
 */
export function writeResetPin(userId: string, hash: string, salt: string): Promise<boolean> {
  return rpc<boolean>("admin_set_app_lock", {
    p_user: userId,
    p_hash: hash,
    p_salt: salt,
  });
}

/**
 * App se aaya hash/salt sach me hash/salt jaisa dikhta hai?
 *
 * ⚠️ Ye check zaroori hai. Server PIN ko dekhta hi nahi (aur ye theek hai), par
 * uska matlab ye bhi hai ki jo bhi text app bhejegi wo seedha lock ban jaayega.
 * Khaali string ya kachra bhej dene par lock ek aisi haalat me chala jaata jahan
 * user ka koi bhi PIN kabhi match hi na kare — yaani wo apne hi account se bahar.
 * Shakal jaanch lena us poore nuksaan ko yahin rok deta hai.
 */
export function looksLikeHex(s: string, minLen: number): boolean {
  return typeof s === "string" && s.length >= minLen && s.length <= 256 && /^[0-9a-f]+$/i.test(s);
}

/** Request kis "jagah" se aayi — ginti/fraud ke liye. */
export function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || null;
}
