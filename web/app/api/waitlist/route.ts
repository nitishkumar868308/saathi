import { NextResponse } from "next/server";

/**
 * Waitlist signup endpoint.
 *
 * Abhi ke liye: email validate karke success return karta hai aur server log mein print.
 *
 * 👉 Supabase se jodne ke liye (jab ready ho):
 *   1. Supabase mein ek table banao:  waitlist (id, email unique, created_at)
 *   2. Env vars set karo (Vercel + .env.local):
 *        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (service key sirf server pe!)
 *   3. Neeche TODO wali jagah par insert karo:
 *
 *      const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/waitlist`, {
 *        method: "POST",
 *        headers: {
 *          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
 *          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
 *          "Content-Type": "application/json",
 *          Prefer: "resolution=ignore-duplicates",
 *        },
 *        body: JSON.stringify({ email }),
 *      });
 */
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

  // TODO: Supabase `waitlist` table mein insert karo (upar comment dekho).
  console.log(`[waitlist] new signup: ${email}`);

  return NextResponse.json({ ok: true });
}
