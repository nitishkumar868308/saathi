import { NextResponse } from "next/server";
import { appUserId } from "@/lib/app-auth";
import { sendOtp, verifyConfigured } from "@/lib/verify";
import { logServerError } from "@/lib/errors-server";
import { isE164, phoneTakenByOther } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Profile ke phone number par OTP bhejo.
 *
 * Number BODY se aata hai (user abhi type kar raha hai, wo abhi DB me hai bhi
 * nahi), par user ki pehchaan hamesha TOKEN se — kabhi body se nahi.
 *
 * Jawab me kabhi OTP nahi jaata (na ja sakta hai — Twilio Verify use hume bhi
 * nahi batata). App sirf itna jaanti hai ki SMS chala gaya.
 */
export async function POST(request: Request) {
  const userId = await appUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!verifyConfigured()) {
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

  const res = await sendOtp(phone, userId).catch((e) => {
    void logServerError(e, { where: "phone/send-otp", step: "twilio" });
    return { ok: false, reason: "failed" } as const;
  });

  if (!res.ok) {
    // 429 sirf rate-limit par — app usi par "thodi der baad" wali baat dikhati
    // hai. Baaki sab 502: dikkat hamari taraf hai, user ke number me nahi.
    const status = res.reason === "bad_number" ? 400 : res.reason === "rate_limited" ? 429 : 502;
    return NextResponse.json({ error: res.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}
