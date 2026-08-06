/**
 * ⚠️ TWILIO VERIFY — POORI TARAH BAND. Neeche ka saara code comment me hai.
 *
 * Iski jagah ab apna khud ka OTP hai:
 *   • `lib/otp.ts`              — code banana, hash, aur saada SMS bhejna
 *   • `supabase/phone-otp.sql`  — code rakhna, hadd lagana, milaan karna
 *
 * KYUN HATAYA — Verify har verification par SMS ke daam ke UPAR apni alag fees
 * leta hai. Wo fees teen kaamo ki thi: OTP banana, use sambhalna, aur galat
 * koshishein ginna. Teenon chhote hain, teenon ab apne paas hain, aur Twilio se
 * ab sirf saada SMS jaata hai — sabse sasta raasta.
 *
 * SURAKHSHA ME KUCH KAM NAHI HUA. Jo cheezein Verify de raha tha, wo sab ab bhi
 * hain (aur kuch zyada bhi):
 *
 *   ✓ secure random OTP       crypto.randomInt (Math.random KABHI nahi)
 *   ✓ expiry                   default 10 min, admin se badla ja sakta hai
 *   ✓ galat koshish ki hadd    5, aur uske baad code marr jaata hai
 *   ✓ brute-force rok          attempts DB me badhta hai, ek hi statement me
 *   ✓ rate limiting            cooldown + per-hour + per-day, sab DB me
 *   ✓ fraud detection          ek IP se kitne alag number, blocked countries
 *   ✓ multi-country routing    Messaging Service, ya desh-wise number
 *   ✓ compliance / sender      brand, "kisi ko mat batao", DLT-ready template
 *
 * ⚠️ FILE MITAYI NAHI GAYI, jaan-boojh ke. Do wajah: agar kabhi Verify par wapas
 * jaana pade (jaise kisi naye desh me apna sender register hone tak) to ye poora
 * kaam karta hua code yahin pada hai; aur `docs/` me iske reference bache hue
 * hain. Wapas chalu karne ke liye ise uncomment karke dono route badal dena.
 *
 * ⚠️ Aur ek baat, jo is badlaav me sabse aam galti hai: OTP ko app ke
 * localStorage/AsyncStorage me MAT rakhna aur milaan app ke andar MAT karna. Wo
 * verification ko poori tarah bekaar kar deta hai — app ka storage user ke apne
 * phone par hai (rooted phone / adb backup / patched APK me saaf padha ja sakta
 * hai), aur jo check app ke andar hai use app ke andar hi bypass kiya ja sakta
 * hai. Isliye hash sirf DB me hai aur milaan bhi wahin hota hai.
 */

// import { logServiceUsage } from "@/lib/usage-server";
//
// /**
//  * Phone number ka SMS OTP — Twilio Verify se.
//  *
//  * Kyun Verify, khud ka OTP nahi: OTP khud banane ka matlab hai use kahin store
//  * karna, uski expiry sambhalna, galat koshishein ginna, aur brute-force rokna —
//  * chaaron me se ek bhi galti poore verification ko bekaar kar deti hai. Verify
//  * ye chaaron apne paas rakhta hai. Hum na OTP banate hain, na dekhte hain, na
//  * kabhi save karte hain — sirf "bhejo" aur "ye code sahi hai kya" poochte hain.
//  *
//  * .env.local:
//  *   TWILIO_ACCOUNT_SID=AC...
//  *   TWILIO_AUTH_TOKEN=...
//  *   TWILIO_VERIFY_SERVICE_SID=VA...
//  */
//
// const SID = process.env.TWILIO_ACCOUNT_SID;
// const TOKEN = process.env.TWILIO_AUTH_TOKEN;
// const SERVICE = process.env.TWILIO_VERIFY_SERVICE_SID;
//
// export function verifyConfigured(): boolean {
//   return Boolean(SID && TOKEN && SERVICE);
// }
//
// function auth(): string {
//   return `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString("base64")}`;
// }
//
// async function call(path: string, form: URLSearchParams) {
//   const res = await fetch(
//     `https://verify.twilio.com/v2/Services/${SERVICE}/${path}`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: auth(),
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//       body: form.toString(),
//       cache: "no-store",
//     },
//   );
//   const body = (await res.json().catch(() => ({}))) as {
//     status?: string;
//     code?: number;
//     message?: string;
//   };
//   return { ok: res.ok, http: res.status, body };
// }
//
// export type SendResult =
//   | { ok: true }
//   | { ok: false; reason: "not_configured" | "bad_number" | "rate_limited" | "failed" };
//
// /**
//  * Is number par OTP bhejo. `phone` = E.164 (jaise +919876543210).
//  *
//  * Twilio ke error codes jaan-boojh ke alag-alag samjhe jaate hain: user ko
//  * "number galat hai" aur "abhi bahut baar koshish ho chuki" me farak dikhna
//  * chahiye. Dono ko ek jaisa "nahi bheja ja saka" batana wahi bekaar message hai
//  * jiske baad user wahi galat number dobara-dobara daalta rehta hai.
//  */
// export async function sendOtp(phone: string, userId?: string | null): Promise<SendResult> {
//   if (!verifyConfigured()) return { ok: false, reason: "not_configured" };
//
//   const { ok, body } = await call(
//     "Verifications",
//     new URLSearchParams({ To: phone, Channel: "sms" }),
//   );
//
//   if (ok && body.status === "pending") {
//     logServiceUsage("twilio", "otp_send", { userId });
//     return { ok: true };
//   }
//
//   logServiceUsage("twilio", "otp_send", {
//     ok: false,
//     userId,
//     meta: { code: body.code, status: body.status },
//   });
//
//   // 60200 = "To" ki shakal hi galat hai, 60033 = Twilio us number tak nahi ja
//   // sakta (landline, band number, ya jis desh me service nahi hai).
//   if (body.code === 60200 || body.code === 60033) return { ok: false, reason: "bad_number" };
//   // 60203 = ek hi number par bahut saari koshishein, 429 = account ka rate limit.
//   if (body.code === 60203 || body.code === 20429) return { ok: false, reason: "rate_limited" };
//   return { ok: false, reason: "failed" };
// }
//
// export type CheckResult =
//   | { ok: true }
//   | { ok: false; reason: "not_configured" | "wrong_code" | "expired" | "failed" };
//
// /**
//  * User ne jo 6 digit daale, wo sahi hain kya.
//  *
//  * ⚠️ `expired` ko `wrong_code` se alag rakhna zaroori hai. Verify ka code 10
//  * minute me marr jaata hai, aur uske baad Twilio 404 deta hai — jo bilkul waisa
//  * hi dikhta hai jaise galat code. User apna bilkul SAHI code teen baar daal ke
//  * "galat code" padhta rehta tha, jabki karna sirf "dobara bhejo" tha.
//  */
// export async function checkOtp(
//   phone: string,
//   code: string,
//   userId?: string | null,
// ): Promise<CheckResult> {
//   if (!verifyConfigured()) return { ok: false, reason: "not_configured" };
//
//   const { ok, http, body } = await call(
//     "VerificationCheck",
//     new URLSearchParams({ To: phone, Code: code }),
//   );
//
//   if (ok && body.status === "approved") {
//     logServiceUsage("twilio", "otp_check", { userId });
//     return { ok: true };
//   }
//
//   logServiceUsage("twilio", "otp_check", {
//     ok: false,
//     userId,
//     meta: { code: body.code, status: body.status, http },
//   });
//
//   // 404 / 20404 = is number ka koi zinda verification hai hi nahi — yaani wo
//   // expire ho chuka (ya pehle hi approve ho chuka hai).
//   if (http === 404 || body.code === 20404) return { ok: false, reason: "expired" };
//   if (body.status === "pending" || body.status === "canceled") {
//     return { ok: false, reason: "wrong_code" };
//   }
//   return { ok: false, reason: "failed" };
// }
//
