import { NextResponse } from "next/server";

import { appUser } from "@/lib/app-auth";
import { logServerError } from "@/lib/errors-server";
import { clientIp, generateResetCode, hashResetCode, resetIssue } from "@/lib/app-lock";
import { sendAppLockResetEmail } from "@/lib/email";
import { localeForUser } from "@/lib/user-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "PIN bhool gaya" — account ke email par 6 ank ka code.
 *
 * ⚠️ Tarteeb jaan-boojh ke aisi hai — pehle DB, phir email:
 *
 *   1. hadd jaancho + code ka hash likho (`app_lock_reset_issue`)
 *   2. email bhejo
 *
 * Ulta karne par ek fail hue insert ke baad email ja chuka hota, aur user ke
 * paas ek aisa code hota jo kabhi verify hi nahi ho sakta — sabse uljhan wali
 * soorat, aur PIN reset me sabse mehngi (user pehle se apne app se bahar khada
 * hai).
 *
 * Jawab me code kabhi nahi jaata — na body me, na header me, na log me. Wo poori
 * baat hi yahi hai ki code SIRF us email tak pahunche.
 */
export async function POST(request: Request) {
  const user = await appUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  /**
   * Email hai hi nahi — ye virle hota hai (phone-only auth) par ho sakta hai.
   *
   * Yahan chup-chaap "ok" lauta dena sabse bura hoga: user code ka intezaar
   * karta rehta jo kabhi aayega hi nahi. Saaf keh dena hi ek raasta hai — app
   * uspar support wali line dikhati hai.
   */
  if (!user.email) {
    return NextResponse.json({ error: "no_email" }, { status: 400 });
  }

  const code = generateResetCode();

  let issued;
  try {
    issued = await resetIssue(user.id, hashResetCode(user.id, code), clientIp(request));
  } catch (e) {
    void logServerError(e, { where: "app-lock/reset/send", step: "issue", userId: user.id });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  if (issued.status === "cooldown" || issued.status === "too_many") {
    return NextResponse.json(
      { error: issued.status, retryAfter: issued.retry_after },
      { status: 429, headers: { "Retry-After": String(issued.retry_after) } },
    );
  }
  if (issued.status !== "ok") {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  try {
    const locale = await localeForUser(user.id);
    const sent = await sendAppLockResetEmail({
      to: user.email,
      name: user.name,
      code,
      minutes: Math.round(issued.ttl / 60),
      locale,
      userId: user.id,
    });
    // SMTP set hi nahi hai — user ko "code bhej diya" kehna jhooth hoga.
    if (!sent.sent) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  } catch (e) {
    void logServerError(e, { where: "app-lock/reset/send", step: "email", userId: user.id });
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
