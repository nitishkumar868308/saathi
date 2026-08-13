import { NextResponse } from "next/server";

import { appUser } from "@/lib/app-auth";
import { logServerError } from "@/lib/errors-server";
import {
  approvalIssue,
  clientIp,
  generateApprovalCode,
  hashApprovalCode,
  looksLikeDeviceId,
} from "@/lib/device-approval";
import { sendDeviceApprovalEmail } from "@/lib/email";
import { localeForUser } from "@/lib/user-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Naya phone" — account ke email par 6 ank ka code.
 *
 * ⚠️ Tarteeb jaan-boojh ke aisi hai — pehle DB, phir email:
 *
 *   1. hadd jaancho + code ka hash likho (`device_approval_issue`)
 *   2. email bhejo
 *
 * Ulta karne par ek fail hue insert ke baad email ja chuka hota, aur user ke
 * paas ek aisa code hota jo kabhi verify hi nahi ho sakta.
 *
 * ⚠️ `deviceId` body se aata hai, aur wahi theek bhi hai: wo phone ke apne
 * SecureStore ka UUID hai, token me kahin nahi hota. Par uspar BHAROSA nahi
 * kiya jaata — wo hash me jaata hai aur DB me alag se milaaya bhi jaata hai
 * (`device_approval_check` ka 'other_device'). Yaani ek phone par manga hua code
 * doosre phone par nahi chalega.
 *
 * User ki pehchaan HAMESHA token se — kabhi body se. Body me user id maan lene
 * ka matlab hota koi bhi kisi ka bhi phone chaalu kar le.
 *
 * Jawab me code kabhi nahi jaata — na body me, na header me, na log me.
 */
export async function POST(request: Request) {
  const user = await appUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  /**
   * Email hai hi nahi — virle, par ho sakta hai (phone-only auth).
   *
   * Chup-chaap "ok" lauta dena sabse bura hoga: user us code ka intezaar karta
   * rahega jo kabhi aayega hi nahi. App is par support wala raasta dikhati hai,
   * jahan se admin manually approve kar sakta hai.
   */
  if (!user.email) return NextResponse.json({ error: "no_email" }, { status: 400 });

  let deviceId = "";
  try {
    const body = await request.json();
    deviceId = String(body?.deviceId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!looksLikeDeviceId(deviceId)) {
    return NextResponse.json({ error: "bad_device" }, { status: 400 });
  }

  const code = generateApprovalCode();

  let issued;
  try {
    issued = await approvalIssue(
      user.id,
      deviceId,
      hashApprovalCode(user.id, deviceId, code),
      clientIp(request),
    );
  } catch (e) {
    void logServerError(e, { where: "device/approve/send", step: "issue", userId: user.id });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  if (issued.status === "cooldown" || issued.status === "too_many") {
    return NextResponse.json(
      { error: issued.status, retryAfter: issued.retry_after },
      { status: 429, headers: { "Retry-After": String(issued.retry_after) } },
    );
  }
  if (issued.status !== "ok") return NextResponse.json({ error: "failed" }, { status: 500 });

  try {
    const locale = await localeForUser(user.id);
    const sent = await sendDeviceApprovalEmail({
      to: user.email,
      name: user.name,
      code,
      minutes: Math.round(issued.ttl / 60),
      locale,
      userId: user.id,
    });
    // SMTP set hi nahi hai — "code bhej diya" kehna jhooth hoga.
    if (!sent.sent) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  } catch (e) {
    void logServerError(e, { where: "device/approve/send", step: "email", userId: user.id });
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }

  // Poora email nahi bhejte — sirf mask kiya hua, taaki user ko pata chale ki
  // code kahan gaya hai bina poora pata screen par likhe.
  return NextResponse.json({ ok: true, email: maskEmail(user.email), retryAfter: 60 });
}

/** "nitish@gmail.com" → "ni•••@gmail.com" */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const head = name.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, Math.min(5, name.length - 2)))}@${domain}`;
}
