import { supabase } from "./supabase";
import { WEB_URL } from "./plan";
import { adoptResetPin, makePinHash } from "./app-lock";

/**
 * "PIN bhool gaya" — account ke email par ek 6 ank ka code.
 *
 * ── Ye raasta kyun chahiye tha ────────────────────────────────────────────
 *
 * Pehle lock screen par ek hi raasta tha: **Logout karo, phir login karo.** Wo
 * us waqt imaandaar tha kyunki PIN sirf phone par hota tha — logout karte hi wo
 * apne aap chala jaata tha.
 *
 * Ab PIN account ka hissa hai, isliye wo raasta kaam hi nahi karta: logout karke
 * login karo to lock wapas aa jaata hai. Aur wo theek hai — lock ka poora matlab
 * hi yahi hai. Par uske saath ek nayi zimmedari aati hai: PIN bhoolne wale ke
 * paas KOI raasta hona chahiye, warna lock user ko uske apne documents se
 * hamesha ke liye bahar kar deta hai.
 *
 * ⚠️ Naya PIN kabhi network par nahi jaata. App yahan khud salt aur hash banati
 * hai aur sirf wo dono bhejti hai — bilkul waise hi jaise wo phone par rakhti
 * hai. Server PIN ko kabhi dekhta hi nahi.
 *
 * ⚠️ Code ki jaanch aur naya PIN likhna EK HI call me hota hai. Do call banane
 * par doosri ke paas apna koi saboot nahi hota ki code verify ho chuka tha —
 * app seedha doosri call maar ke bina kisi code ke PIN badal leti, aur poora
 * email-OTP dikhawa reh jaata.
 */

export type LockResetError =
  | "unauthorized"
  /** Account par email hai hi nahi (phone-only login) — support hi raasta hai. */
  | "no_email"
  /** Email bhejne ka setup hi nahi hai. */
  | "not_configured"
  /** 60 second ka thehraav — button khud khul jayega. */
  | "cooldown"
  /** Ghante/din ki hadd poori. */
  | "too_many"
  | "wrong_code"
  | "expired"
  /** Us code par bahut galat koshish — naya code mangwana padega. */
  | "locked"
  | "failed"
  | "network";

type Sent = { email: string; retryAfter: number };

async function post<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: LockResetError }> {
  if (!supabase) return { ok: false, error: "failed" };

  // Server user ki pehchaan SIRF is token se karta hai — request me user id
  // bhejna kabhi kaam nahi karega (aur nahi karna chahiye).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "unauthorized" };

  try {
    const res = await fetch(`${WEB_URL}/api/app-lock/reset/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, data: out as T };
    return { ok: false, error: ((out.error as LockResetError) ?? "failed") };
  } catch {
    // Net nahi. Ise `failed` se alag rakhna zaroori hai: user ko "dobara koshish
    // karo" kehna tabhi sahi hai jab dikkat sach me net ki ho.
    return { ok: false, error: "network" };
  }
}

/** Account ke email par code bhejo. Kaamyab hone par mask kiya hua email milta hai. */
export async function sendLockResetCode(): Promise<
  { ok: true; email: string; retryAfter: number } | { ok: false; error: LockResetError }
> {
  const res = await post<Sent>("send", {});
  if (!res.ok) return res;
  return {
    ok: true,
    email: String(res.data.email ?? ""),
    retryAfter: Number(res.data.retryAfter ?? 60),
  };
}

/**
 * Code + naya PIN. Kaamyab hone par naya PIN phone par bhi baith jaata hai.
 *
 * ⚠️ Local par likhna server ke KAAMYAAB hone ke BAAD hi hota hai. Ulta karne
 * par net toot-ne wali soorat me phone par naya PIN hota aur server par purana —
 * aur agla sync purane ko wapas le aata, yaani user ka naya PIN chup-chaap
 * gayab.
 */
export async function resetPinWithCode(
  code: string,
  newPin: string,
): Promise<LockResetError | null> {
  let creds: { hash: string; salt: string };
  try {
    creds = await makePinHash(newPin);
  } catch {
    return "failed";
  }

  const res = await post<{ ok: boolean }>("confirm", { code, ...creds });
  if (!res.ok) return res.error;

  await adoptResetPin(creds.hash, creds.salt);
  return null;
}
