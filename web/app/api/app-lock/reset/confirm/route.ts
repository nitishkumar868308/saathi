import { NextResponse } from "next/server";

import { appUserId } from "@/lib/app-auth";
import { logServerError } from "@/lib/errors-server";
import { hashResetCode, looksLikeHex, resetCheck, writeResetPin } from "@/lib/app-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Email ka code jaancho aur NAYA PIN likh do — ek hi call me.
 *
 * ⚠️ Do call (pehle "code sahi hai?", phir "naya PIN likho") jaan-boojh ke NAHI
 * banaye. Us soorat me doosri call ke paas apna koi saboot nahi hota ki code
 * verify ho chuka tha — app seedha doosri call maar ke bina kisi code ke PIN
 * badal leti, aur poora email-OTP dikhawa reh jaata. Ek hi call me code aur naya
 * hash saath aane se ye soorat ban hi nahi sakti.
 *
 * ⚠️ Naya PIN yahan SAAF NAHI aata. App khud salt banati hai, hash banati hai,
 * aur sirf wo dono bhejti hai — bilkul waise hi jaise wo phone par rakhti hai.
 * Server PIN ko kabhi dekhta hi nahi.
 */
export async function POST(request: Request) {
  const userId = await appUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let code = "";
  let hash = "";
  let salt = "";
  try {
    const body = await request.json();
    code = String(body?.code ?? "").trim();
    hash = String(body?.hash ?? "").trim();
    salt = String(body?.salt ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "wrong_code" }, { status: 400 });
  }
  /**
   * Shakal ki jaanch — upar `looksLikeHex` par poori wajah likhi hai. Chhota sa
   * check, par iske bina app ek khaali/kachra hash bhej ke user ko uske apne
   * account se hamesha ke liye bahar kar sakti hai.
   */
  if (!looksLikeHex(hash, 64) || !looksLikeHex(salt, 16)) {
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }

  let verdict: string;
  try {
    verdict = await resetCheck(userId, hashResetCode(userId, code));
  } catch (e) {
    void logServerError(e, { where: "app-lock/reset/confirm", step: "check", userId });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  if (verdict !== "ok") {
    // 'none' ka matlab bhi user ke liye "expired" hi hai — koi zinda code hai hi
    // nahi, isliye use naya mangwana hai. Use "wrong" batane par wo apna BILKUL
    // SAHI code baar-baar daalta rehta hai.
    const error =
      verdict === "wrong" ? "wrong_code" : verdict === "locked" ? "locked" : "expired";
    return NextResponse.json({ error }, { status: 400 });
  }

  try {
    const ok = await writeResetPin(userId, hash, salt);
    if (!ok) return NextResponse.json({ error: "failed" }, { status: 500 });
  } catch (e) {
    void logServerError(e, { where: "app-lock/reset/confirm", step: "write", userId });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
