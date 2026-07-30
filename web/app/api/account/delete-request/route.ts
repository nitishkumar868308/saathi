import { NextResponse } from "next/server";
import { addContactMessage } from "@/lib/store";
import { sendAccountDeletionEmails } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Account deletion request (Play Store data-deletion requirement).
 *
 * Request `contact_messages` me hi save hoti hai — ek alag table banane se
 * admin ko do jagah dekhna padta. Prefix se ye messages list me turant alag
 * dikhti hain.
 */
export async function POST(request: Request) {
  let name = "";
  let email = "";
  let reason = "";
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim();
    email = String(body?.email ?? "").trim();
    reason = String(body?.reason ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !emailOk) {
    return NextResponse.json({ error: "invalid fields" }, { status: 400 });
  }

  await addContactMessage({
    name,
    email,
    message: `[ACCOUNT DELETE REQUEST] ${reason || "(koi wajah nahi likhi)"}`,
    createdAt: new Date().toISOString(),
  });
  console.log(`[delete-request] saved: ${name} <${email}>`);

  try {
    await sendAccountDeletionEmails(name, email, reason);
  } catch (err) {
    console.error("[delete-request] email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
