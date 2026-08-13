import { NextResponse } from "next/server";

import { appUserId } from "@/lib/app-auth";
import { logServerError } from "@/lib/errors-server";
import { approvalCheck, hashApprovalCode, looksLikeDeviceId } from "@/lib/device-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Code jaancho aur is phone ko chaalu kar do — ek hi call me.
 *
 * ⚠️ Do call (pehle "code sahi hai?", phir "device chaalu karo") jaan-boojh ke
 * NAHI banaye. Us soorat me doosri call ke paas apna koi saboot nahi hota ki
 * code verify ho chuka tha — app seedha doosri maar ke bina kisi code ke apna
 * device chaalu kar leti, aur poora email-OTP dikhawa reh jaata. Yahi galti PIN
 * reset me pehle pakdi ja chuki hai, isliye wahan bhi dono kaam ek hi call me
 * hain.
 *
 * Asli kaam DB ke `device_approval_check` me hota hai: code milaana, is device
 * ko chaalu karna, baaki phone utaarna aur unke notification token hataana — sab
 * ek hi transaction me. Beech ki haalat (dono phone chaalu, ya dono band) ban hi
 * nahi sakti.
 */
export async function POST(request: Request) {
  const userId = await appUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let code = "";
  let deviceId = "";
  try {
    const body = await request.json();
    code = String(body?.code ?? "").trim();
    deviceId = String(body?.deviceId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "wrong_code" }, { status: 400 });
  }
  if (!looksLikeDeviceId(deviceId)) {
    return NextResponse.json({ error: "bad_device" }, { status: 400 });
  }

  let verdict: string;
  try {
    verdict = await approvalCheck(userId, deviceId, hashApprovalCode(userId, deviceId, code));
  } catch (e) {
    void logServerError(e, { where: "device/approve/confirm", step: "check", userId });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  if (verdict === "ok") return NextResponse.json({ ok: true });

  /**
   * 'none' ka matlab bhi user ke liye "expired" hi hai — koi zinda code hai hi
   * nahi, isliye use naya mangwana hai. Use "wrong" batane par wo apna BILKUL
   * SAHI code baar-baar daalta rehta hai (ye galti Twilio Verify wale raaste par
   * ho chuki hai, dekho lib/otp.ts).
   *
   * 'other_device' bhi 'expired' hi hai user ke liye: code kisi aur phone ke
   * liye manga gaya tha, to is phone par naya mangwana hi sahi raasta hai.
   */
  const error =
    verdict === "wrong"
      ? "wrong_code"
      : verdict === "locked"
        ? "locked"
        : "expired";
  return NextResponse.json({ error }, { status: 400 });
}
