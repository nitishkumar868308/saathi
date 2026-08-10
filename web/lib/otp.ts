import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { logServiceUsage } from "@/lib/usage-server";

/**
 * Apna khud ka SMS OTP — Twilio Verify ki jagah.
 *
 * ⚠️ Pehle yahan Twilio Verify tha (`lib/verify.ts`, ab comment kiya hua). Wo
 * OTP khud banata, bhejta aur check karta tha — aur har verification par SMS ke
 * daam ke UPAR apni alag fees leta tha. Wo fees teen kaamo ki thi: code banana,
 * use sambhalna, galat koshishein ginna. Teenon chhote hain, teenon ab hamare
 * paas hain:
 *
 *   • code banana      → yahan (`generateCode`, crypto se)
 *   • sambhalna        → Postgres (`supabase/phone-otp.sql`)
 *   • koshish ginna    → wahi, `otp_check` me
 *
 * Twilio se ab sirf saada SMS jaata hai — sabse sasta raasta.
 *
 * ⚠️ Surakhsha me kuch kam NAHI hua, aur ye jaan-boojh ke hai. Sabse aam galti
 * jo is badlaav me hoti hai wo ye hai ki code app me (localStorage /
 * AsyncStorage) rakh diya jaye aur milaan app ke andar ho. Wo verification ko
 * poori tarah bekaar kar deta hai: app ka storage user ke apne phone par hai
 * (rooted phone / adb backup / patched APK me saaf padha ja sakta hai), aur jo
 * check app ke andar hai use app ke andar hi bypass kiya ja sakta hai —
 * hamlavar ko SMS ka intezaar tak nahi karna padta. Poora sawaal hi ye hai ki
 * "kya ye number sach me is user ka hai", aur uska jawab sirf wahi jagah de
 * sakti hai jahan user ka haath na pahunche.
 *
 * Isliye: code ka HASH sirf DB me, milaan sirf DB me, aur app ko OTP kabhi
 * nahi dikhta — bilkul waise hi jaise Verify ke zamane me nahi dikhta tha.
 *
 * .env.local:
 *   TWILIO_ACCOUNT_SID=AC...
 *   TWILIO_AUTH_TOKEN=...
 *   OTP_PEPPER=<lamba random secret>          # hash ke liye; badalne par sab
 *                                             # zinda code bekaar ho jayenge
 *   # Bhejne ka raasta — inme se koi EK (upar wala jeetega):
 *   TWILIO_MESSAGING_SERVICE_SID=MG...        # sabse behtar (neeche padho)
 *   TWILIO_SMS_FROM_IN=+91...                 # desh-wise number (optional)
 *   TWILIO_SMS_FROM=+1...                     # aakhri fallback
 *   # Compliance:
 *   OTP_BRAND=Apka Saathi                     # SMS me brand ka naam
 *   OTP_BLOCKED_COUNTRIES=NG,PK               # (optional) in deshon me mat bhejo
 */

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;

/**
 * Hash ka pepper.
 *
 * Salt se alag: salt har row ka apna hota hai aur DB me hi likha hota hai;
 * pepper ek hi hai aur DB ke BAHAR rehta hai. Faayda seedha hai — DB leak ho
 * jaye (backup, ek galat SELECT) to bhi akele hash se code nikalna namumkin
 * hai, kyunki 6 ank ki poori list (sirf 10 lakh) pepper ke bina banti hi nahi.
 *
 * Set na ho to ek tay string — dev me chalane ke liye. Production me ise
 * zaroor set karna; iske bina 10 lakh hash pehle se bana ke rakhe ja sakte hain.
 */
const PEPPER = process.env.OTP_PEPPER || "saathi-dev-pepper-set-OTP_PEPPER-in-prod";

const BRAND = process.env.OTP_BRAND || "Apka Saathi";

/* ─────────────────────────── kaunsa raasta ─────────────────────────── */

/**
 * OTP kis raaste se jaayega.
 *
 *   "sms"    — apna code + saada Twilio SMS. Sabse sasta, aur default yahi hai.
 *   "verify" — Twilio Verify (wo khud code banata, bhejta aur check karta hai).
 *   null     — kuch bhi set nahi; app ko "not_configured" milta hai.
 *
 * ── Verify wapas kyun aaya ──────────────────────────────────────────────
 *
 * ⚠️ Ye is file ka sabse zaroori sudhaar hai. Verify se apne OTP par aate waqt
 * DO cheezein chhoot gayi thi, aur dono ka nateeja user ke liye bilkul ek hi
 * tha — profile me number verify karte hi "SMS isn't switched on yet":
 *
 *   1. `otpConfigured()` sirf `smsSender()` dekhta tha, jo SIRF
 *      `TWILIO_MESSAGING_SERVICE_SID` aur `TWILIO_SMS_FROM` padhta hai. Par is
 *      file ka apna doc `TWILIO_SMS_FROM_IN` jaisa desh-wise number bhi ek
 *      valid raasta batata hai, aur `senderFor()` use theek use bhi karta hai.
 *      Yaani sirf desh-wise number set karne wala setup POORI TARAH sahi hone
 *      ke baawajood "configured hi nahi" mana jaata tha.
 *
 *   2. Asli setup me `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` aur
 *      `TWILIO_VERIFY_SERVICE_SID` — teenon maujood the, par koi SMS sender
 *      kabhi jodha hi nahi gaya (Verify ko uski zaroorat nahi thi). Migration
 *      me sirf code badla, env nahi — aur phone verification us din se band
 *      pada tha.
 *
 * Isliye ab: SMS sender ho to wahi (sasta), warna Verify se kaam chala lo. Jo
 * bhi maujood hai, usse verification CHALNA chahiye — chup-chaap band pade
 * rehne se har soorat behtar hai.
 */
export type OtpTransport = "sms" | "verify" | null;

const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

/**
 * Koi bhi SMS sender set hai?
 *
 * `smsSender()` se alag: wo bhejte waqt EK sender chunta hai, ye sirf ye dekhta
 * hai ki koi raasta hai ya nahi. Desh-wise number (`TWILIO_SMS_FROM_IN`) yahan
 * ginta hai — `senderFor()` use use karta hai, isliye use "hai hi nahi" maanna
 * galat tha.
 */
function hasAnySmsSender(): boolean {
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) return true;
  if (process.env.TWILIO_SMS_FROM) return true;
  return Object.keys(process.env).some(
    (k) => k.startsWith("TWILIO_SMS_FROM_") && !!process.env[k],
  );
}

export function otpTransport(): OtpTransport {
  if (!SID || !TOKEN) return null;
  if (hasAnySmsSender()) return "sms";
  if (VERIFY_SID) return "verify";
  return null;
}

export function otpConfigured(): boolean {
  return otpTransport() !== null;
}

/**
 * Verify wale raaste me DB row me kya likha jaata hai.
 *
 * ⚠️ Wahan asli code Twilio ke paas hota hai — hamare paas kuch bhi aisa nahi
 * hota jise hash kiya ja sake. Par row phir bhi banti hai, kyunki rate-limit /
 * cooldown / fraud ki ginti dono raaston me apne hi DB se chalti hai.
 *
 * Isliye ek tay sentinel: `generateCode()` hamesha 6 ANK deta hai, aur ye value
 * ank hai hi nahi — yaani iska hash kisi bhi asli code ke hash se kabhi nahi
 * milega. Agar kal ko koi galti se `otp_check` ko is raaste par bhi laga de, to
 * wo "wrong" hi kahega, chup-chaap paas nahi karega.
 */
export const VERIFY_SENTINEL = "twilio-verify";

/* ─────────────────────────── code banana ─────────────────────────── */

/**
 * 6 ank ka code — `crypto` se, `Math.random()` se NAHI.
 *
 * ⚠️ `Math.random()` yahan kabhi nahi. Wo cryptographically secure nahi hai:
 * V8 ka xorshift128+ apni seed se poori tarah tay hota hai, aur kuch output
 * dekh ke aage ke output nikale ja sakte hain. OTP me iska matlab hai ki ek
 * hamlavar apne khud ke kuch code mangwa ke doosron ke code ka andaza laga
 * sakta hai.
 *
 * `randomInt` uniform hai — modulo bias bhi nahi (jo `randomBytes % 1000000`
 * karne par aa jaata hai).
 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Code ka hash — DB me yahi jaata hai.
 *
 * `phone` bhi hash me hai, aur ye zaroori hai: iske bina ek hi code ka hash har
 * number par ek jaisa hota, aur ek row ka hash doosre number par chipkaya ja
 * sakta tha.
 */
export function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${PEPPER}:${phone}:${code}`).digest("hex");
}

/**
 * Do hash barabar hain?
 *
 * ⚠️ Saada `===` yahan nahi. String compare pehle farak par ruk jaata hai,
 * yaani jitne shuruaati akshar milte hain utna hi zyada waqt lagta hai. Us waqt
 * ke farak se hash ek-ek akshar karke nikala ja sakta hai (timing attack).
 * `timingSafeEqual` hamesha poora padhta hai.
 *
 * (DB wala milaan bhi hota hai; ye us soorat ke liye hai jab kabhi code me
 * milaan karna pade — aur taaki koi galti se `===` na likh de.)
 */
export function hashEquals(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  // Lambai alag ho to timingSafeEqual throw karta hai. Lambai chhupane laayak
  // baat hai bhi nahi — sha256 hex hamesha 64 akshar ka hota hai.
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/* ──────────────────── desh, routing, compliance ──────────────────── */

/**
 * E.164 se desh ka andaza.
 *
 * Poora nahi hai (na hi hona chahiye — asli validation app me
 * `libphonenumber-js` karta hai). Yahan ka kaam sirf do hai: routing ke liye
 * sahi sender chunna, aur blocked-country list lagana. Isliye sirf wo prefix
 * jinki hume zaroorat hai, aur baaki ke liye null.
 */
export function countryOf(phone: string): string | null {
  const p = phone.replace(/\s/g, "");
  // Lambe prefix pehle — "+1" har "+1xxx" se pehle match kar jaata.
  const map: [string, string][] = [
    ["+977", "NP"],
    ["+971", "AE"],
    ["+966", "SA"],
    ["+880", "BD"],
    ["+94", "LK"],
    ["+92", "PK"],
    ["+91", "IN"],
    ["+65", "SG"],
    ["+64", "NZ"],
    ["+61", "AU"],
    ["+60", "MY"],
    ["+49", "DE"],
    ["+44", "GB"],
    ["+33", "FR"],
    ["+1", "US"],
  ];
  for (const [prefix, cc] of map) {
    if (p.startsWith(prefix)) return cc;
  }
  return null;
}

/** In deshon me OTP bhejna hi nahi. Khaali = sab chalu. */
function blockedCountries(): Set<string> {
  const raw = process.env.OTP_BLOCKED_COUNTRIES ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
}

/**
 * Kis sender se bhejna hai.
 *
 * Teen raaste, isi tarteeb me:
 *
 *  1. **Messaging Service (MG…)** — sabse behtar, aur production me yahi
 *     hona chahiye. Wo ek pool sambhalta hai aur teen kaam khud karta hai jo
 *     warna hume karne padte: har desh ke liye sahi sender chunna
 *     (multi-country routing), local rules ka paalan (India ka DLT-registered
 *     header, US ka 10DLC/toll-free registration, alphanumeric sender ID jahan
 *     zaroori ho), aur STOP/opt-out sambhalna.
 *
 *  2. **Desh-wise number** — `TWILIO_SMS_FROM_IN` jaisa. Chhote setup ke liye
 *     theek hai: bharatiya user ko bharatiya number se SMS behtar pahunchta
 *     hai (videshi number se aane wale SMS aksar carrier hi gira dete hain).
 *
 *  3. **Ek hi number** — aakhri fallback. Chalega, par delivery kam rahegi.
 */
function smsSender(): { field: "MessagingServiceSid" | "From"; value: string } {
  const mg = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (mg) return { field: "MessagingServiceSid", value: mg };
  return { field: "From", value: process.env.TWILIO_SMS_FROM ?? "" };
}

/** Desh ka apna number ho to wahi, warna aam wala. */
function senderFor(country: string | null): { field: "MessagingServiceSid" | "From"; value: string } {
  const mg = process.env.TWILIO_MESSAGING_SERVICE_SID;
  // Messaging Service khud routing karta hai — usme desh ke hisaab se chunna
  // ulta bura hai (wo pool ka faisla hum se behtar leta hai).
  if (mg) return { field: "MessagingServiceSid", value: mg };
  const perCountry = country ? process.env[`TWILIO_SMS_FROM_${country}`] : undefined;
  return { field: "From", value: perCountry || process.env.TWILIO_SMS_FROM || "" };
}

/**
 * SMS ka text.
 *
 * Compliance ki teen baatein isme jaan-boojh ke hain:
 *
 *  • **Brand ka naam sabse pehle.** Kai carrier (aur India me DLT) bina
 *    pehchaan wale transactional SMS gira dete hain. User ke liye bhi ye
 *    zaroori hai — bina naam ke OTP dekh ke wo samajh hi nahi paata ki kis app
 *    ka hai.
 *  • **"kisi ko mat batao".** OTP fraud ka sabse aam roop yahi hai: koi call
 *    karke code maang leta hai. Ye line har OTP SMS me honi chahiye.
 *  • **Koi link nahi.** Link wale SMS phishing filter me atakte hain, aur OTP
 *    me unki zaroorat bhi nahi.
 *
 * ⚠️ Text ek hi rakha gaya hai (Hinglish), user ki bhasha ke hisaab se nahi.
 * Wajah: India me DLT par har template alag se register hota hai aur SMS me
 * WAHI text jaana chahiye jo register hua ho — ek akshar ka farak bhi delivery
 * fail kar deta hai. Teen bhashaon ka matlab hai teen register kiye hue
 * template aur teen alag content SID. Wo tab karna jab teenon register ho
 * jayein; tab tak ek hi text sabse surakshit hai.
 */
export function otpMessage(code: string, minutes: number): string {
  return `${BRAND}: ${code} aapka verification code hai. ${minutes} minute me expire ho jayega. Kisi ko mat batao.`;
}

/* ───────────────────────────── bhejna ───────────────────────────── */

export type SendResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_configured" | "bad_number" | "blocked" | "rate_limited" | "failed";
    };

/**
 * OTP ka SMS bhejo. `phone` = E.164 (+919876543210).
 *
 * Sirf bhejta hai — code banana aur DB me likhna caller ka kaam hai (route),
 * kyunki DB pehle likhna hota hai: ulta karne par ek fail hue insert ke baad
 * SMS ja chuka hota aur user ke paas ek aisa code hota jo kisi kaam ka nahi.
 */
export async function sendOtpSms(
  phone: string,
  code: string,
  ttlSeconds: number,
  userId?: string | null,
): Promise<SendResult> {
  if (!SID || !TOKEN) return { ok: false, reason: "not_configured" };

  const country = countryOf(phone);
  if (country && blockedCountries().has(country)) {
    // Ye asli fraud-rok hai: jin deshon me hamare user hi nahi, wahan jaane
    // wala har SMS ya to galti hai ya SMS-pumping fraud (hamlavar apne premium
    // number par SMS mangwa ke revenue share kamata hai). Wo bill hamara hi
    // banta hai.
    logServiceUsage("twilio", "otp_send", {
      ok: false,
      userId,
      meta: { blocked: country },
    });
    return { ok: false, reason: "blocked" };
  }

  const sender = senderFor(country);
  if (!sender.value) return { ok: false, reason: "not_configured" };

  const form = new URLSearchParams({
    To: phone,
    Body: otpMessage(code, Math.round(ttlSeconds / 60)),
    [sender.field]: sender.value,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    },
  );

  const body = (await res.json().catch(() => ({}))) as { code?: number; sid?: string };

  if (res.ok && body.sid) {
    logServiceUsage("twilio", "otp_send", { userId, meta: { country } });
    return { ok: true };
  }

  logServiceUsage("twilio", "otp_send", {
    ok: false,
    userId,
    meta: { code: body.code, http: res.status, country },
  });

  // 21211 = "To" ki shakal galat, 21614 = ye number SMS le hi nahi sakta
  // (landline), 21408 = us desh me bhejna account par enable nahi hai.
  if (body.code === 21211 || body.code === 21614) return { ok: false, reason: "bad_number" };
  if (body.code === 21408) return { ok: false, reason: "blocked" };
  // 20429 = Twilio ka apna rate limit.
  if (body.code === 20429 || res.status === 429) return { ok: false, reason: "rate_limited" };
  return { ok: false, reason: "failed" };
}

/* ─────────────────────── Twilio Verify wala raasta ─────────────────────── */

/**
 * Verify tab chalta hai jab koi SMS sender set hi na ho (upar `otpTransport()`).
 *
 * ⚠️ Yahan bhi wahi purana niyam poori tarah lagu hai, aur ise todna sabse aam
 * galti hoti: **code kabhi app tak nahi jaata aur milaan kabhi app me nahi
 * hota.** Verify me code Twilio ke paas rehta hai aur milaan Twilio karta hai;
 * hum sirf "approved" ya "nahi" sunte hain. Uske baad `phone_verified_at`
 * likhne ka haq waise hi sirf server ke paas hai (`mark_phone_verified`,
 * service_role only) — wo hissa dono raaston me bilkul ek jaisa hai.
 *
 * Rate-limit, cooldown aur fraud ki ginti YAHAN BHI apne DB se hi chalti hai
 * (route me `otp_issue`). Verify ki apni bhi hoti hai, par uspar chhod dene ka
 * matlab hota ki do raaste do alag niyam se chalein — aur user ko kabhi 30
 * second ka intezaar milta, kabhi kuch aur.
 */
async function twilioForm(
  path: string,
  form: URLSearchParams,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${VERIFY_SID}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    },
  );
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

/** Verify se OTP bhejo. */
export async function verifySendOtp(
  phone: string,
  userId?: string | null,
): Promise<SendResult> {
  if (!SID || !TOKEN || !VERIFY_SID) return { ok: false, reason: "not_configured" };

  const country = countryOf(phone);
  if (country && blockedCountries().has(country)) {
    logServiceUsage("twilio", "otp_send", { ok: false, userId, meta: { blocked: country } });
    return { ok: false, reason: "blocked" };
  }

  const { status, body } = await twilioForm(
    "Verifications",
    new URLSearchParams({ To: phone, Channel: "sms" }),
  );

  if (status < 400) {
    logServiceUsage("twilio", "otp_send", { userId, meta: { country, via: "verify" } });
    return { ok: true };
  }

  logServiceUsage("twilio", "otp_send", {
    ok: false,
    userId,
    meta: { code: body.code, http: status, country, via: "verify" },
  });

  // 60200 = "To" ki shakal galat, 60205 = ye number SMS le hi nahi sakta,
  // 60410 = ye number Verify me block hai, 60203 = ek hi number par bahut
  // koshishein (Twilio ka apna rate limit).
  if (body.code === 60200 || body.code === 60205) return { ok: false, reason: "bad_number" };
  if (body.code === 60410) return { ok: false, reason: "blocked" };
  if (body.code === 60203 || status === 429) return { ok: false, reason: "rate_limited" };
  return { ok: false, reason: "failed" };
}

/** Verify se code jaancho. */
export type VerifyCheck = "approved" | "wrong" | "expired" | "failed";

export async function verifyCheckOtp(phone: string, code: string): Promise<VerifyCheck> {
  if (!SID || !TOKEN || !VERIFY_SID) return "failed";

  const { status, body } = await twilioForm(
    "VerificationCheck",
    new URLSearchParams({ To: phone, Code: code }),
  );

  if (status < 400) return body.status === "approved" ? "approved" : "wrong";

  /**
   * 404 ka matlab yahan "URL galat hai" nahi hai.
   *
   * Verify har verification ko approve/expire hote hi hata deta hai. Uske baad
   * usi number par check karne par 404 aata hai — yaani "is number ka koi
   * zinda code hai hi nahi". User ke liye wo `expired` hai, `wrong` nahi: use
   * naya code mangwana hai, wahi purana dobara nahi daalna. Ise `wrong` batane
   * par user apna BILKUL SAHI code baar-baar daal ke "galat code" padhta rehta
   * hai — theek wahi galti jo apne OTP wale raaste me pehle ho chuki hai.
   */
  if (status === 404 || body.code === 20404) return "expired";
  if (body.code === 60202) return "wrong"; // max check attempts
  return "failed";
}
