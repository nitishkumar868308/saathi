import { createHash, randomInt } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * "Naya phone" ka server wala hissa — email par 6 ank ka code.
 *
 * ── Ye raasta kyun bana ────────────────────────────────────────────────────
 *
 * Ek waqt me ek hi phone "active" rehta hai (`supabase/device-approval.sql`).
 * Naya phone lene wale ko us active jagah par apna haq jataana hota hai, aur
 * uska saboot email hai.
 *
 * ⚠️ Email hi kyun, phone number kyun nahi — ye is poore feature ka sabse
 * zaroori faisla hai. Jis pal user ko ye code sabse zyada chahiye hota hai
 * (naya phone), theek usi pal uska purana SIM aksar nikal chuka hota hai. SMS
 * wala raasta usi soorat me fail karta jiske liye wo banaya gaya tha. Email
 * naye phone par bhi pehle hi minute me khul jaata hai.
 *
 * ⚠️ Code ka sirf HASH DB me jaata hai (pepper ke saath), bilkul PIN reset aur
 * phone OTP ki tarah. Code khud sirf email me jaata hai — na response me, na
 * header me, na log me.
 *
 * Poora dhaancha `app-lock.ts` se liya gaya hai — wo pehle se chal raha hai aur
 * uske cooldown/hadd/tries asli use me tay ho chuke hain. Yahan naya hisaab
 * banane ka matlab hota wahi saari galtiyan dobara karna.
 */

/**
 * Hash ka pepper — PIN reset aur phone OTP dono se ALAG.
 *
 * Alag isliye ki teen alag maqsad ka ek hi secret na ho: kal ko koi ek badalna
 * pade (ya leak ho) to baaki do ke zinda code uske saath na girein. Set na ho to
 * PIN wale par, phir phone wale par gir jaata hai — dev me chalane ke liye.
 */
const PEPPER =
  process.env.DEVICE_APPROVAL_PEPPER ||
  process.env.APP_LOCK_PEPPER ||
  process.env.OTP_PEPPER ||
  "saathi-dev-pepper-set-DEVICE_APPROVAL_PEPPER-in-prod";

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
 * ke do-teen code mangwa ke kisi aur ka code guess kar le — aur us code se uske
 * phone par notification le jaaye.
 */
export function generateApprovalCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * User id AUR device id dono hash me.
 *
 * ⚠️ Device id bhi isliye ki ek phone par maanga hua code doosre phone par
 * chipkaya na ja sake. DB me bhi `device_id` alag se milaaya jaata hai
 * (`device_approval_check` ka 'other_device'), yaani do jagah rok hai — kyunki
 * yahi wo ek cheez hai jo is poore feature ko dikhawa bana deti.
 */
export function hashApprovalCode(userId: string, deviceId: string, code: string): string {
  return createHash("sha256").update(`${PEPPER}:${userId}:${deviceId}:${code}`).digest("hex");
}

export type ApprovalIssue =
  | { status: "ok"; ttl: number }
  | { status: "cooldown" | "too_many"; retry_after: number }
  | { status: "invalid" };

export function approvalIssue(
  userId: string,
  deviceId: string,
  codeHash: string,
  ip: string | null,
): Promise<ApprovalIssue> {
  return rpc<ApprovalIssue>("device_approval_issue", {
    p_user: userId,
    p_device: deviceId,
    p_hash: codeHash,
    p_ip: ip,
  });
}

/**
 * Code jaancho — aur sahi nikla to device wahin active bhi ho jaata hai.
 *
 * ⚠️ Ye do call me nahi hai, aur ye jaan-boojh ke hai. Alag "verify" aur
 * "activate" banane par doosri call ke paas apna koi saboot nahi hota ki code
 * verify ho chuka tha — app seedha doosri maar ke bina kisi code ke apna device
 * active kar leti. Poori jaanch DB ke ek hi function me hai.
 *
 * 'ok' | 'wrong' | 'expired' | 'locked' | 'none' | 'other_device'
 */
export function approvalCheck(
  userId: string,
  deviceId: string,
  codeHash: string,
): Promise<string> {
  return rpc<string>("device_approval_check", {
    p_user: userId,
    p_device: deviceId,
    p_hash: codeHash,
  });
}

/**
 * Device id ki shakal jaancho.
 *
 * App par ye `SecureStore` me pada UUID hai (`app-mobile/src/lib/device.ts`).
 * Server uspar bharosa nahi karta — ye seedha DB ki query aur hash dono me
 * jaata hai, isliye uski lambai aur shakal pehle hi baandh dete hain.
 */
export function looksLikeDeviceId(s: unknown): s is string {
  return typeof s === "string" && s.length >= 8 && s.length <= 100 && /^[A-Za-z0-9._:-]+$/.test(s);
}

/** Request kis "jagah" se aayi — ginti/fraud ke liye. */
export function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || null;
}
