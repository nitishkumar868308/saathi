import { supabase } from "./supabase";
import { WEB_URL } from "./plan";

/**
 * Phone number ka SMS OTP.
 *
 * ⚠️ Poora kaam server par hota hai, app me nahi — aur ye jaan-boojh ke hai.
 * OTP app me banaya ja sakta tha (aur bahut jagah banaya jaata hai), par tab wo
 * app ke andar hi kahin hota, yaani use padha ja sakta hai. Yahan app ko OTP
 * kabhi dikhta hi nahi: wo Twilio Verify ke paas rehta hai, aur app sirf ye
 * poochti hai ki "user ne jo daala wo sahi tha kya".
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
  | "network";

async function post(path: string, body: unknown): Promise<PhoneError | null> {
  if (!supabase) return "failed";

  // Server user ki pehchaan SIRF is token se karta hai — request me user id
  // bhejna kabhi kaam nahi karega (aur nahi karna chahiye).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return "unauthorized";

  try {
    const res = await fetch(`${WEB_URL}/api/phone/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    return (out.error as PhoneError) ?? "failed";
  } catch {
    // Net nahi. Ise `failed` se alag rakhna zaroori hai: user ko "dobara
    // koshish karo" kehna tabhi sahi hai jab dikkat sach me net ki ho.
    return "network";
  }
}

/** Is number par OTP bhejo. `phone` = E.164 (+919876543210). */
export function sendPhoneOtp(phone: string): Promise<PhoneError | null> {
  return post("send-otp", { phone });
}

/** User ne jo code daala wo jaancho — sahi hua to number verified ho jaata hai. */
export function verifyPhoneOtp(phone: string, code: string): Promise<PhoneError | null> {
  return post("verify-otp", { phone, code });
}
