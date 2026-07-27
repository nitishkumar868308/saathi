import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import { sendMail, renderEmail, emailParagraph, escapeHtml } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_RECIPIENTS = 1000;

type Profile = { id: string; email: string | null; language: string | null };

function sbHeaders() {
  return { apikey: SERVICE as string, Authorization: `Bearer ${SERVICE}` };
}

async function sbGet<T>(query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: sbHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  return (await res.json()) as T[];
}

/**
 * Admin se registered users ko email bhejo — sabko ya sirf "inactive"
 * (registered hue par kabhi reminder/document nahi banaya).
 *
 * POST body: { subject, message, audience: "all" | "inactive" }
 */
export async function POST(request: Request) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  let body: { subject?: string; message?: string; audience?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  const audience = body.audience === "inactive" ? "inactive" : "all";
  if (!subject || !message) {
    return NextResponse.json({ error: "subject aur message dono chahiye" }, { status: 400 });
  }

  // Targets nikaalo.
  let profiles: Profile[];
  try {
    profiles = await sbGet<Profile>("profiles?select=id,email,language");
  } catch (e) {
    return NextResponse.json({ error: "profiles fetch failed", detail: String(e) }, { status: 500 });
  }

  let targets = profiles.filter((p) => !!p.email);

  if (audience === "inactive") {
    // Active = jinhone koi reminder ya document banaya. Baaki inactive.
    try {
      const [rem, docs] = await Promise.all([
        sbGet<{ user_id: string | null }>("reminders?select=user_id"),
        sbGet<{ user_id: string | null }>("documents?select=user_id"),
      ]);
      const active = new Set<string>();
      [...rem, ...docs].forEach((r) => r.user_id && active.add(r.user_id));
      targets = targets.filter((p) => !active.has(p.id));
    } catch (e) {
      return NextResponse.json({ error: "activity fetch failed", detail: String(e) }, { status: 500 });
    }
  }

  targets = targets.slice(0, MAX_RECIPIENTS);

  // Admin-composed message ko branded shell me daalo. Newlines -> paragraphs.
  const inner = escapeHtml(message)
    .split(/\n{2,}/)
    .map((para) => emailParagraph(para.replace(/\n/g, "<br/>")))
    .join("");
  const html = renderEmail(subject, inner, subject);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const p of targets) {
    try {
      const res = await sendMail({ to: p.email as string, subject, html, fromName: "Apka Saathi" });
      if (res.sent) sent++;
      else skipped++;
    } catch (e) {
      errors.push(`${p.email}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    audience,
    total: targets.length,
    sent,
    skipped,
    errors: errors.slice(0, 5),
  });
}
