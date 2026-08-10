import { NextResponse } from "next/server";
import { addContactMessage } from "@/lib/store";
import { sendContactEmails } from "@/lib/email";
import { asLocale } from "@/lib/user-locale";
import { hit, requestKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
// Rate-limit ki ginti memory me rehti hai — is route ko cache/prerender nahi
// hona chahiye, warna wo ginti kabhi chalti hi nahi.
export const dynamic = "force-dynamic";

/**
 * Ek ghante me ek jagah se itne hi contact form.
 *
 * 5 udaar hai: ek asli aadmi do-teen se aage nahi jaata (aur jaaye bhi to
 * pehla message pahunch hi chuka hai). Iske aage har request DO email bhejti
 * hai, isliye ginti yahin rok deni chahiye.
 */
const MAX_PER_HOUR = 5;
const WINDOW_MS = 60 * 60_000;

/**
 * Contact form:
 * - Validate karta hai
 * - Message DB/store mein save karta hai
 * - Gmail se admin ko notification + user ko confirmation bhejta hai
 *
 * ⚠️ Ye endpoint bina login ke khula hai aur har kaamyab request par DO email
 * jaati hai — ek admin ko, aur ek us pate par jo FORM me likha ho. Yaani bina
 * rok ke ye kisi bhi ajnabi ke inbox me hamare apne domain se mail bharne ka
 * auzaar tha. Poori baat `lib/rate-limit.ts` ke upar likhi hai.
 */
export async function POST(request: Request) {
  const gate = hit("contact", requestKey(request), MAX_PER_HOUR, WINDOW_MS);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "bahut zyada message — thodi der baad try karo" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

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
