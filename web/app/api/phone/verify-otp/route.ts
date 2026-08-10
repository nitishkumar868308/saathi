import { NextResponse } from "next/server";
import { appUserId } from "@/lib/app-auth";
import { logServerError } from "@/lib/errors-server";
import { isE164, markPhoneVerified, otpCheck } from "@/lib/phone";
import { hashCode, otpTransport, verifyCheckOtp, VERIFY_SENTINEL } from "@/lib/otp";

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
 *
 * ⚠️ Milaan DB me hota hai (`otp_check`), yahan nahi — aur app me to bilkul
 * nahi. Ek hi statement me `attempts` badhta hai aur hash milta hai, isliye
 * ek saath aayi 50 requests bhi ginti se bach nahi sakti. Code kabhi is
 * process me plain shakal me nahi aata: user ka bheja hua code seedha hash
 * banta hai aur hash hi DB jaata hai.
 */
export async function POST(request: Request) {
  const userId = await appUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const transport = otpTransport();
  if (!transport) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let phone = "";
  let code = "";
  try {
    const body = await request.json();
    phone = String(body?.phone ?? "").trim();
    // Log space/dash daal dete hain ("123 456") — wo hash ko poori tarah badal
    // deta hai. Sirf ank rakhna user ki ek bekaar "galat code" bacha deta hai.
    code = String(body?.code ?? "").replace(/\D/g, "");
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!isE164(phone)) return NextResponse.json({ error: "bad_number" }, { status: 400 });
  if (code.length < 4) return NextResponse.json({ error: "wrong_code" }, { status: 400 });

  let verdict: string;
  try {
    if (transport === "sms") {
      verdict = await otpCheck(userId, phone, hashCode(phone, code));
    } else {
      /**
       * Twilio Verify wala raasta.
       *
       * ⚠️ Faisla Twilio ka hai (code usi ke paas hai), par ginti hamari apni
       * DB me hi hoti hai — aur wo `otp_check` ke bina badhti hi nahi. Isliye
       * dono soorat me use bulate hain:
       *
       *   • Twilio ne approve kiya  → SENTINEL hash bhejte hain, jo us row se
       *     milta hai. Row "used" ho jaati hai, yaani wahi verification dobara
       *     nahi chalega.
       *   • Twilio ne mana kiya     → ek jaan-boojh ke galat hash bhejte hain,
       *     taaki `attempts` badhe. Bina iske 6 ank ki brute-force par sirf
       *     Twilio ki apni hadd bachti, aur hamare "5 galat koshish ke baad
       *     code marr jaata hai" wale niyam ka koi matlab hi na rehta.
       *
       * `verdict` ko wahi shabd banate hain jo `otp_check` deta hai, taaki
       * neeche ka jawab dono raaston me bilkul ek jaisa rahe.
       */
      const twilio = await verifyCheckOtp(phone, code);
      if (twilio === "failed") {
        void logServerError(new Error("verify check failed"), {
          where: "phone/verify-otp",
          step: "twilio",
          userId,
        });
        return NextResponse.json({ error: "failed" }, { status: 502 });
      }
      const dbVerdict = await otpCheck(
        userId,
        phone,
        hashCode(phone, twilio === "approved" ? VERIFY_SENTINEL : `bad:${code}`),
      );
      // Approve hote hue bhi hamari row lock/expire ho chuki ho (5 galat
      // koshish, ya 10 minute) — to hadd hamari hi chalegi. Twilio ki apni
      // expiry lambi hoti hai; do alag hadd me se kadi wali maanna hi theek hai.
      verdict = twilio === "approved" ? dbVerdict : twilio;
    }
  } catch (e) {
    void logServerError(e, { where: "phone/verify-otp", step: "check", userId, transport });
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }

  if (verdict !== "ok") {
    /**
     * Char alag jawab, char alag agla kadam — aur user ko ye farak dikhna
     * chahiye:
     *
     *   wrong   — code galat hai. Dobara daalo.
     *   expired — code sahi ho sakta hai, bas 10 minute nikal gaye. "Dobara
     *             bhejo" dabao. (Ise `wrong` bata dene par user apna BILKUL
     *             SAHI code teen baar daal ke "galat code" padhta rehta tha.)
     *   locked  — 5 galat koshish ho gayi, ye code ab marr chuka. Naya mangao.
     *   none    — is number ka koi zinda code hai hi nahi. Bhi naya mangao.
     */
    const error =
      verdict === "wrong"
        ? "wrong_code"
        : verdict === "locked"
          ? "too_many"
          : "expired";
    return NextResponse.json({ error }, { status: 400 });
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
