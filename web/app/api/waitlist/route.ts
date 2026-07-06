import { NextResponse } from "next/server";
import { addToWaitlist, getWaitlistCount } from "@/lib/store";
import { sendWaitlistWelcome } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Waitlist signup.
 * - Email validate karta hai
 * - Store mein dedup ke saath add karta hai (dubara add nahi hota)
 * - Naye signup pe Gmail se welcome email bhejta hai (agar configured ho)
 */

const BASE_COUNT = Number(process.env.WAITLIST_BASE_COUNT ?? 500);

export async function GET() {
  const stored = await getWaitlistCount();
  return NextResponse.json({ count: BASE_COUNT + stored });
}

export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  let added = false;
  let count = 0;
  try {
    const r = await addToWaitlist(email, new Date().toISOString());
    added = r.added;
    count = r.count;
  } catch (err) {
    console.error("[waitlist] store error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }

  if (!added) {
    // Pehle se list mein hai — dubara add nahi kiya, email bhi nahi bheja.
    console.log(`[waitlist] duplicate ignored: ${email}`);
    return NextResponse.json({
      ok: true,
      already: true,
      count: BASE_COUNT + count,
    });
  }

  console.log(`[waitlist] new signup: ${email}`);
  try {
    await sendWaitlistWelcome(email);
  } catch (err) {
    // Email fail ho to bhi signup succeed rehta hai.
    console.error("[waitlist] welcome email failed:", err);
  }

  return NextResponse.json({ ok: true, already: false, count: BASE_COUNT + count });
}
