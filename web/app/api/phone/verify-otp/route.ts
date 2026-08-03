import { NextResponse } from "next/server";
import { appUserId } from "@/lib/app-auth";
import { checkOtp, verifyConfigured } from "@/lib/verify";
import { logServerError } from "@/lib/errors-server";
import { isE164, markPhoneVerified } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * User ne jo 6 digit daale — sahi hue to number us user ke naam par verified.
 *
 * Do kaam ek hi jagah isliye hain ki inke beech me kuch aa hi nahi sakta:
 * "code sahi tha" aur "number is user ka hai" ek hi lamha hai. Agar app pehle
 * check karti aur phir alag se "mera number verified likh do" bhejti, to wo
 * doosri call akeli bhi bheji ja sakti thi — bina kisi OTP ke. Poora
 * verification usi ek chhed se bekaar ho jaata.
 */
export async function POST(request: Request) {
  const userId = await appUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!verifyConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let phone = "";
  let code = "";
  try {
    const body = await request.json();
    phone = String(body?.phone ?? "").trim();
    // Log space/dash daal dete hain ("123 456") — wo Twilio ke liye galat code
    // ban jaata hai. Sirf ank rakhna user ki ek bekaar "galat code" bacha deta.
    code = String(body?.code ?? "").replace(/\D/g, "");
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!isE164(phone)) return NextResponse.json({ error: "bad_number" }, { status: 400 });
  if (code.length < 4) return NextResponse.json({ error: "wrong_code" }, { status: 400 });

  const res = await checkOtp(phone, code, userId).catch((e) => {
    void logServerError(e, { where: "phone/verify-otp", step: "twilio" });
    return { ok: false, reason: "failed" } as const;
  });

  if (!res.ok) {
    // `expired` ko alag rakhna zaroori hai — user ka code sahi ho sakta hai, bas
    // 10 minute nikal gaye. App uspar "dobara bhejo" dikhati hai, "galat code"
    // nahi (jise padh ke user wahi sahi code teen baar daalta rehta tha).
    const status = res.reason === "failed" ? 502 : 400;
    return NextResponse.json({ error: res.reason }, { status });
  }

  /**
   * Code sahi tha. Ab number is user ke naam par.
   *
   * `'taken'` = DB ke unique index ne roka: ye number kisi DOOSRE account me
   * pehle se verified hai. Ye OTP bhejne se pehle bhi dekha jaata hai, par wo
   * check race-proof nahi hai — ye wala hai.
   */
  try {
    const out = await markPhoneVerified(userId, phone);
    if (out === "taken") {
      return NextResponse.json({ error: "phone_taken" }, { status: 409 });
    }
    if (out !== "ok") {
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
  } catch (e) {
    // ⚠️ Yahan chup rehna sabse mehnga hota: user ke saamne OTP sahi nikla, par
    // number kahin save hi nahi hua. Wo dobara-dobara wahi karta rehta aur
    // hamare paas iska koi nishaan tak na hota.
    void logServerError(e, { where: "phone/verify-otp", step: "mark verified", userId });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, phone });
}
