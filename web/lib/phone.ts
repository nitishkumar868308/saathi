const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Phone verification ke DB wale do kaam.
 *
 * Dono `security definer` RPC se hote hain (`supabase/phone-verify.sql`) aur
 * dono sirf service_role ko mile hain. Wajah seedhi hai: `phone_verified_at`
 * agar app se set ho sakta, to OTP ka koi matlab hi na rehta — koi bhi apna
 * number "verified" likh leta. Isliye wo column sirf isi raaste se badalta hai,
 * aur ye raasta sirf us API route ke paas hai jo Twilio se "approved" sun chuka
 * hai.
 */

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
 * E.164 ki shakal: `+` aur uske baad 8–15 ank, pehla ank 0 nahi.
 *
 * Ye poori validation NAHI hai — asli "ye number is desh me ho sakta hai kya"
 * app me `libphonenumber-js` dekhta hai (jo har desh ke apne rules jaanta hai).
 * Yahan wo dobara karne ka koi matlab nahi; server ka kaam sirf itna hai ki
 * bilkul bekaar text Twilio tak na pahunche.
 */
export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/** Ye number pehle se kisi DOOSRE account me verified hai? */
export function phoneTakenByOther(userId: string, phone: string): Promise<boolean> {
  return rpc<boolean>("phone_taken_by_other", { p_user: userId, p_phone: phone });
}

/**
 * Verify ho chuka number is user ke naam par likh do.
 *
 * `'taken'` ka matlab hai DB ke unique index ne roka — yaani do log ek hi number
 * ek hi pal me verify kar rahe the, aur doosra haar gaya. Ye virle hota hai par
 * hota hai, aur isi ek jagah par wo pakka rukta hai.
 */
export function markPhoneVerified(userId: string, phone: string): Promise<string> {
  return rpc<string>("mark_phone_verified", { p_user: userId, p_phone: phone });
}

/* ───────────────────────── apna khud ka OTP ───────────────────────── */

/**
 * Neeche wale dono bhi `security definer` RPC hain aur sirf service_role ko
 * mile hain (`supabase/phone-otp.sql`). App ko `phone_otp` table ka raasta
 * bilkul nahi milna chahiye — warna wo apna hi hash padh ke aage badh sakti
 * hai, aur poora OTP bekaar ho jaata hai.
 */

export type OtpIssue =
  | { status: "ok"; ttl: number }
  | { status: "cooldown" | "too_many"; retry_after: number }
  | { status: "invalid" };

/**
 * Naya OTP jaari karo — hadd jaanchte hue.
 *
 * Rate-limit / cooldown / fraud, teenon ka faisla DB me hota hai (code me
 * nahi), kyunki Vercel par har serverless instance ki apni memory hoti hai aur
 * in-memory counter alag-alag instance par ja ke patla ho jaata hai. OTP par ye
 * do tarah se mehnga hai: har SMS ka daam, aur 6 ank ki brute-force.
 */
export function otpIssue(
  userId: string,
  phone: string,
  codeHash: string,
  ip: string | null,
  country: string | null,
): Promise<OtpIssue> {
  return rpc<OtpIssue>("otp_issue", {
    p_user: userId,
    p_phone: phone,
    p_hash: codeHash,
    p_ip: ip,
    p_country: country,
  });
}

/** 'ok' | 'wrong' | 'expired' | 'locked' | 'none' */
export function otpCheck(
  userId: string,
  phone: string,
  codeHash: string,
): Promise<string> {
  return rpc<string>("otp_check", {
    p_user: userId,
    p_phone: phone,
    p_hash: codeHash,
  });
}

export type OtpStatus = {
  blocked: boolean;
  sent_hour: number;
  sent_day: number;
  per_hour: number;
  per_day: number;
};

/** Is user ne kitne SMS mangwaye aur hadd kya hai — admin ke faisle ke liye. */
export function otpStatus(userId: string): Promise<OtpStatus> {
  return rpc<OtpStatus>("otp_status", { p_user: userId });
}

/**
 * Admin: is user ki OTP ginti saaf karo.
 *
 * Lautata hai kitni rows ginti se hataayi gayi. Rows delete nahi hoti — sirf
 * `ignored` lagta hai, taaki fraud dekhne ke liye itihaas bacha rahe.
 */
export function otpResetUser(userId: string): Promise<number> {
  return rpc<number>("otp_reset_user", { p_user: userId });
}
