import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Locale = "hinglish" | "hi" | "en";

/**
 * Welcome email — naye user ko (email + Google dono).
 *
 * App sign-in ke baad apne access token ke saath ye call karti hai. Hum:
 *  1. token verify karke user (uid, email, naam) nikalte hain — isliye sirf
 *     apne hi email pe bhej sakte ho, kisi random address pe nahi.
 *  2. profiles.welcomed_at NULL ho tabhi bhejte hain, phir set kar dete hain —
 *     isliye har login pe call karna safe hai, email ek hi baar jaata hai.
 */
export async function POST(request: Request) {
  if (!SUPABASE_URL || !ANON || !SERVICE) {
    return NextResponse.json({ error: "supabase env missing" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "no token" }, { status: 401 });

  let locale: Locale = "hinglish";
  try {
    const body = (await request.json()) as { locale?: string };
    if (body?.locale === "hi" || body?.locale === "en" || body?.locale === "hinglish") {
      locale = body.locale;
    }
  } catch {
    /* body optional */
  }

  // 1. Token se user nikalo (caller ka apna token).
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!userRes.ok) return NextResponse.json({ error: "invalid token" }, { status: 401 });
  const user = (await userRes.json()) as {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; name?: string };
  };
  const email = user.email;
  if (!email) return NextResponse.json({ ok: true, skipped: "no-email" });

  const svcHeaders = {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
  };

  // 2. Pehle se welcome bhej chuke? (idempotent) + DB me saved bhasha lo.
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=welcomed_at,full_name,language`,
    { headers: svcHeaders, cache: "no-store" },
  );
  if (profRes.ok) {
    const rows = (await profRes.json()) as {
      welcomed_at: string | null;
      full_name: string | null;
      language: string | null;
    }[];
    const prof = rows[0];
    if (prof?.welcomed_at) {
      return NextResponse.json({ ok: true, already: true });
    }
    // DB ki bhasha source-of-truth — client ne na bheji ho to yahi use karo.
    const dbLang = prof?.language;
    if (dbLang === "hi" || dbLang === "en" || dbLang === "hinglish") {
      locale = dbLang;
    }
  }

  const name = user.user_metadata?.full_name || user.user_metadata?.name || "";

  // 3. Bhejo + welcomed_at SIRF tabhi set karo jab email SACH ME bhej gaya ho.
  //    (Pehle skip hone pe bhi set ho jaata tha — SMTP env na hone par welcomed_at
  //     stamp ho jaata aur user ko kabhi welcome nahi milta. Ab skip pe retry hoga.)
  const result = await sendWelcomeEmail(email, name, locale);

  if (result.sent) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      headers: { ...svcHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ welcomed_at: new Date().toISOString() }),
      cache: "no-store",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, sent: result.sent, skipped: result.skipped ?? false });
}
