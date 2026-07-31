import { NextResponse } from "next/server";
import { addContactMessage } from "@/lib/store";
import { sendContactEmails } from "@/lib/email";
import { asLocale } from "@/lib/user-locale";

export const runtime = "nodejs";

/**
 * Contact form:
 * - Validate karta hai
 * - Message DB/store mein save karta hai
 * - Gmail se admin ko notification + user ko confirmation bhejta hai
 */
export async function POST(request: Request) {
  let name = "";
  let email = "";
  let message = "";
  // Website par jo bhasha chuni hui hai wahi form bhejta hai — rasid usi me
  // jaani chahiye. Na aaye to Hinglish (site ka default).
  let locale = asLocale(undefined);
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim();
    email = String(body?.email ?? "").trim();
    message = String(body?.message ?? "").trim();
    locale = asLocale(body?.locale);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !emailOk || message.length < 2) {
    return NextResponse.json({ error: "invalid fields" }, { status: 400 });
  }

  await addContactMessage({
    name,
    email,
    message,
    createdAt: new Date().toISOString(),
  });
  console.log(`[contact] saved: ${name} <${email}>`);

  try {
    await sendContactEmails(name, email, message, locale);
  } catch (err) {
    console.error("[contact] email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
