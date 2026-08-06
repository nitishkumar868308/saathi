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

export function otpConfigured(): boolean {
  return Boolean(SID && TOKEN && smsSender().value);
}

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
