import { supabase } from "./supabase";
import { WEB_URL } from "./plan";

/**
 * Phone number ka SMS OTP.
 *
 * ⚠️ Poora kaam server par hota hai, app me nahi — aur ye jaan-boojh ke hai.
 * OTP app me banaya ja sakta tha (aur bahut jagah banaya jaata hai), par tab wo
 * app ke andar hi kahin hota, yaani use padha ja sakta hai: rooted phone, adb
 * backup, ya ek patched APK me app ka storage saaf dikh jaata hai. Aur jo check
 * app ke andar hota hai use app ke andar hi bypass kiya ja sakta hai — hamlavar
 * ko SMS ka intezaar tak nahi karna padta. Poora sawaal hi ye hai ki "kya ye
 * number sach me is user ka hai", aur uska jawab sirf wahi jagah de sakti hai
 * jahan user ka haath na pahunche.
 *
 * Isliye app ko OTP kabhi dikhta hi nahi: uska hash server ke DB me rehta hai
 * (`supabase/phone-otp.sql`), aur app sirf ye poochti hai ki "user ne jo daala
 * wo sahi tha kya".
 *
 * ⚠️ Ab OTP apna khud ka hai, Twilio Verify ka nahi (wo har verification par
 * alag fees leta tha). App ke liye kuch nahi badla — wahi do call, wahi jawab.
 *
 * Isi wajah se `phone_verified_at` bhi app se kabhi nahi likha ja sakta (uski
 * RPC sirf service_role ko mili hai). Warna koi bhi apna number "verified" likh
 * leta aur OTP ka koi matlab hi na bachta.
 */

/** Server jo bata sakta hai — app har ek ka apna message dikhati hai. */
export type PhoneError =
  | "unauthorized"
  | "not_configured"
  | "bad_number"
  | "rate_limited"
  | "phone_taken"
  | "wrong_code"
  | "expired"
  | "failed"
  | "network"
  /** 30 second ka thehraav — button khud khul jayega. */
  | "cooldown"
  /**
   * Ghante/din ki hadd poori. `rate_limited` (Twilio ka apna limit) se alag
   * hai: wahan intezaar kaam aata hai, yahan user ko support se reset
   * karwana padta hai.
   */
  | "too_many"
  /** Us desh me SMS bhejna abhi chalu nahi hai. */
  | "blocked";

async function call<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: PhoneError }> {
  if (!supabase) return { ok: false, error: "failed" };

  // Server user ki pehchaan SIRF is token se karta hai — request me user id
  // bhejna kabhi kaam nahi karega (aur nahi karna chahiye).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "unauthorized" };

  try {
    const res = await fetch(`${WEB_URL}/api/phone/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, data: out as T };
    return { ok: false, error: ((out.error as PhoneError) ?? "failed") };
  } catch {
    // Net nahi. Ise `failed` se alag rakhna zaroori hai: user ko "dobara
    // koshish karo" kehna tabhi sahi hai jab dikkat sach me net ki ho.
    return { ok: false, error: "network" };
  }
}

async function post(path: string, body: unknown): Promise<PhoneError | null> {
  const res = await call<unknown>(path, body);
  return res.ok ? null : res.error;
}

/**
 * "Ye number available hai?" — SIRF DB, koi SMS nahi.
 *
 * ⚠️ Ye `sendPhoneOtp` se PEHLE chalti hai, aur wahi is function ki poori wajah
 * hai. Pehle duplicate ki jaanch sirf `send-otp` ke andar hoti thi, isliye user
 * ko OTP ka modal khul ke dikhta tha — "+91… par code bheja hai" ke saath — aur
 * usi modal me neeche "ye number kisi aur account me verified hai". Screen ek
 * saath do ulti baatein keh rahi thi.
 *
 * Aur ek asli kharcha bhi tha: `send-otp` par jaana matlab us number par OTP ki
 * cooldown aur din/ghante wali ginti kharch ho jaana — ek aise number par jispar
 * SMS kabhi jaana hi nahi tha.
 *
 * `null` = number lene laayak hai (ya jaanch chal hi nahi paayi — tab bhi rokna
 * galat hoga, kyunki asli rok DB ka unique index hai). Warna wo galti jo dikhani
 * chahiye.
 */
export async function checkPhoneAvailable(phone: string): Promise<PhoneError | null> {
  const res = await call<{ available?: boolean }>("check", { phone });
  if (!res.ok) return res.error;
  return res.data.available === false ? "phone_taken" : null;
}

/** Is number par OTP bhejo. `phone` = E.164 (+919876543210). */
export function sendPhoneOtp(phone: string): Promise<PhoneError | null> {
  return post("send-otp", { phone });
}

/** User ne jo code daala wo jaancho — sahi hua to number verified ho jaata hai. */
export function verifyPhoneOtp(phone: string, code: string): Promise<PhoneError | null> {
  return post("verify-otp", { phone, code });
}
