import { NextResponse } from "next/server";
import { appUserId } from "@/lib/app-auth";
import { logServerError } from "@/lib/errors-server";
import { isE164, otpIssue, phoneTakenByOther } from "@/lib/phone";
import {
  countryOf,
  generateCode,
  hashCode,
  otpTransport,
  sendOtpSms,
  verifySendOtp,
  VERIFY_SENTINEL,
} from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Profile ke phone number par OTP bhejo.
 *
 * Number BODY se aata hai (user abhi type kar raha hai, wo abhi DB me hai bhi
 * nahi), par user ki pehchaan hamesha TOKEN se — kabhi body se nahi.
 *
 * Jawab me kabhi OTP nahi jaata. Ye ab bhi utna hi sach hai jitna Twilio Verify
 * ke zamane me tha: code sirf SMS me aur uska hash DB me jaata hai; na response
 * me, na kisi header me, na log me.
 *
 * ⚠️ Tarteeb jaan-boojh ke aisi hai — pehle DB, phir SMS:
 *
 *   1. hadd jaancho + code likho  (`otp_issue`)
 *   2. SMS bhejo                   (`sendOtpSms`)
 *
 * Ulta karne par ek fail hue insert ke baad SMS ja chuka hota, aur user ke paas
 * ek aisa code hota jo verify hi nahi ho sakta — sabse uljhan wali soorat.
 */
export async function POST(request: Request) {
  const userId = await appUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const transport = otpTransport();
  if (!transport) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let phone = "";
  try {
    const body = await request.json();
    phone = String(body?.phone ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Shakal yahin jaanch lo — galat number Twilio tak bhejne ka matlab hai ek
  // bekaar API call aur user ko ek dheema, bemtlab error.
  if (!isE164(phone)) {
    return NextResponse.json({ error: "bad_number" }, { status: 400 });
  }

  /**
   * SMS bhejne se PEHLE dekh lo ki ye number kisi aur account me verify to nahi.
   *
   * Ye asli rok nahi hai — asli rok DB ka unique index hai (`phone-verify.sql`),
   * jo race me bhi kabhi nahi tootta. Ye sirf itna karta hai ki user 6 digit
   * type karne ke BAAD "ye number kisi aur ka hai" na padhe. Ek SMS ka paisa
   * bhi bach jaata hai.
   */
  try {
    if (await phoneTakenByOther(userId, phone)) {
      return NextResponse.json({ error: "phone_taken" }, { status: 409 });
    }
  } catch (e) {
    // Ye check na chal paaye to rukna galat hoga — unique index abhi bhi peeche
    // khada hai, isliye aage badhna surakshit hai.
    void logServerError(e, { where: "phone/send-otp", step: "taken check" });
  }

  const country = countryOf(phone);

  /**
   * Code.
   *
   * Verify wale raaste me code TWILIO banata hai — hum use na dekhte hain na
   * bhejte hain. Phir bhi `otp_issue` chalta hai, kyunki rate-limit, cooldown
   * aur fraud ki ginti dono raaston me apne hi DB se hoti hai (warna do raaste
   * do alag niyam se chalte, aur user ko kabhi 30 second ka intezaar milta,
   * kabhi kuch aur). Us row me ek SENTINEL hash jaata hai — ek aisi value jo
   * kisi asli code se kabhi nahi banti, taaki galti se bhi koi use "sahi code"
   * na maan le. Milaan us raaste me Twilio karta hai, ye row nahi.
   */
  const code = transport === "sms" ? generateCode() : VERIFY_SENTINEL;

  /**
   * Hadd + code, dono ek hi DB call me.
   *
   * Rate-limit DB me hai, memory me nahi — Vercel par har serverless instance
   * ki apni memory hoti hai, aur tez-tez requests alag-alag instance par ja ke
   * in-memory counter ko patla kar deti hain. OTP par ye do tarah se mehnga
   * hai: har SMS ka daam, aur 6 ank ki brute-force.
   */
  let issued;
  try {
    issued = await otpIssue(userId, phone, hashCode(phone, code), clientIp(request), country);
  } catch (e) {
    void logServerError(e, { where: "phone/send-otp", step: "issue", userId });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  if (issued.status === "cooldown") {
    return NextResponse.json(
      { error: "cooldown", retryAfter: issued.retry_after },
      { status: 429, headers: { "Retry-After": String(issued.retry_after) } },
    );
  }
  if (issued.status === "too_many") {
    /**
     * Aaj/is ghante ki hadd poori. Ye `cooldown` se ALAG jawab hai, aur ye
     * farak zaroori hai: cooldown 30 second ka intezaar hai, par yahan
     * intezaar karne ko kehna jhooth hoga — user ko sach me madad chahiye.
     * App is par profile me "support me ticket raise karo" wali line dikhati
     * hai, aur admin ek button se uski ginti reset kar deta hai.
     */
    return NextResponse.json(
      { error: "too_many", retryAfter: issued.retry_after },
      { status: 429, headers: { "Retry-After": String(issued.retry_after) } },
    );
  }
  if (issued.status !== "ok") {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  const res = await (transport === "sms"
    ? sendOtpSms(phone, code, issued.ttl, userId)
    : verifySendOtp(phone, userId)
  ).catch((e) => {
    void logServerError(e, { where: "phone/send-otp", step: "twilio", transport });
    return { ok: false, reason: "failed" } as const;
  });

  if (!res.ok) {
    // 429 sirf rate-limit par — app usi par "thodi der baad" wali baat dikhati
    // hai. Baaki sab 502: dikkat hamari taraf hai, user ke number me nahi.
    const status =
      res.reason === "bad_number" || res.reason === "blocked"
        ? 400
        : res.reason === "rate_limited"
          ? 429
          : 502;
    return NextResponse.json({ error: res.reason }, { status });
  }

  return NextResponse.json({ ok: true, retryAfter: cooldownHint(issued.ttl) });
}

/**
 * App ke countdown ke liye.
 *
 * Ye asli hadd nahi hai (wo DB me hai) — sirf ek ishara hai taaki button turant
 * dobara zinda na dikhe. Asli faisla hamesha server ka hai; app ka countdown
 * khatam hone par bhi server `cooldown` de sakta hai aur app usse maan leti hai.
 */
function cooldownHint(ttlSeconds: number): number {
  // TTL 600s hai aur cooldown 30s — ttl se seedha nikalna galat hoga. 30 hi
  // bhejte hain; server ka jawab hamesha upar rehta hai.
  void ttlSeconds;
  return 30;
}

/**
 * Request kis "jagah" se aayi — fraud ginti ke liye.
 *
 * Vercel `x-forwarded-for` bharta hai; sabse pehla hissa asli client hota hai.
 * Kuch na mile to null — tab IP wali ginti lagti hi nahi (usse behtar hai ki
 * sab ek hi bucket me daal ke asli users ko block kar diya jaye).
 */
function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || null;
}
