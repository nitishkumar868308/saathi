import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import { sendMail, renderEmail, emailParagraph, escapeHtml } from "@/lib/email";
import { isFcmConfigured, sendPush } from "@/lib/fcm";
import { logServerError } from "@/lib/errors-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_RECIPIENTS = 1000;

type Profile = {
  id: string;
  email: string | null;
  language: string | null;
  full_name?: string | null;
  created_at?: string | null;
};

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
 * Kaun "active" hai — jisne kabhi ek bhi reminder ya document banaya.
 *
 * Sirf sign-up kar lena active hona nahi hai: yahi log wo hain jinhe wapas
 * bulane wala email bhejna hota hai.
 */
async function activeUserIds(): Promise<Set<string>> {
  const [rem, docs] = await Promise.all([
    sbGet<{ user_id: string | null }>("reminders?select=user_id"),
    sbGet<{ user_id: string | null }>("documents?select=user_id"),
  ]);
  const active = new Set<string>();
  [...rem, ...docs].forEach((r) => r.user_id && active.add(r.user_id));
  return active;
}

/** Jin users ka kam se kam ek phone register hai — unhi tak push ja sakti hai. */
async function usersWithDevice(): Promise<Set<string>> {
  const rows = await sbGet<{ user_id: string | null }>(
    "device_tokens?select=user_id",
  ).catch(() => [] as { user_id: string | null }[]);
  const out = new Set<string>();
  rows.forEach((r) => r.user_id && out.add(r.user_id));
  return out;
}

/**
 * Bhejne se PEHLE poori list dikhane ke liye (item 8).
 *
 * ⚠️ Pehle admin sirf "sab" ya "inactive" chun sakta tha aur mail seedha chala
 * jaata tha — kis-kis ko gaya ye baad me bhi pata nahi chalta tha. Ek galat
 * click par active users ko bhi "wapas aa jao" wala mail chala jaata. Ab UI
 * pehle ye list mangata hai, admin us par nishaan lagata hai, aur POST me wahi
 * chune hue ids jaati hain.
 */
export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  try {
    const [profiles, active, withDevice] = await Promise.all([
      sbGet<Profile>("profiles?select=id,email,full_name,language,created_at&order=created_at.desc"),
      activeUserIds(),
      // ⚠️ Ye pehle nahi aata tha, aur usi wajah se sabse uljhan wala sawaal
      // bina jawab ke reh jaata tha: "email to gaya, notification kyun nahi?"
      // Jawab hamesha yahi hota hai — us user ka koi phone register hi nahi
      // hai. Ab bhejne se PEHLE dikh jaata hai.
      usersWithDevice(),
    ]);

    // Bina email wale bhej hi nahi sakte — list me dikhana bhi galat sandesh
    // dega ("inhe kyun nahi gaya?").
    const users = profiles
      .filter((p) => !!p.email)
      .map((p) => ({
        id: p.id,
        email: p.email,
        name: p.full_name ?? null,
        language: p.language ?? null,
        joinedAt: p.created_at ?? null,
        active: active.has(p.id),
        hasDevice: withDevice.has(p.id),
      }));

    // UI ko batana zaroori hai ki push ka option dikhaye ya nahi. Bina Firebase
    // env ke "Notification bhejo" button dikhana jhooth hoga — admin dabata aur
    // kuch jaata hi nahi.
    return NextResponse.json({ users, pushReady: isFcmConfigured() });
  } catch (e) {
    return NextResponse.json({ error: "fetch failed", detail: String(e) }, { status: 500 });
  }
}

/** Chune hue users ke saare device tokens (ek user ke kai phone ho sakte hain). */
async function tokensFor(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const out = new Set<string>();
  // PostgREST ka `in.(...)` URL me jaata hai — bahut lambi list URL todd deti
  // hai. 200 ke jhund me poochte hain.
  for (let i = 0; i < userIds.length; i += 200) {
    const slice = userIds.slice(i, i + 200);
    const rows = await sbGet<{ token: string }>(
      `device_tokens?select=token&user_id=in.(${slice.join(",")})`,
    ).catch(() => []);
    rows.forEach((r) => r.token && out.add(r.token));
  }
  return Array.from(out);
}

/** FCM ne jo tokens "mare hue" bataye, unhe DB se hata do. */
async function dropDeadTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_device_tokens`, {
    method: "POST",
    headers: { ...sbHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ p_tokens: tokens }),
    cache: "no-store",
  }).catch(() => {
    /* best-effort — agli baar phir koshish ho jaayegi */
  });
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

  let body: {
    subject?: string;
    message?: string;
    audience?: string;
    userIds?: unknown;
    channel?: string;
  };
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

  // Email, phone ki notification, ya dono. Purane callers (jinme `channel` nahi
  // hai) ke liye default "email" — unka vyavhaar bilkul waisa hi rehta hai.
  const channel = body.channel === "push" || body.channel === "both" ? body.channel : "email";
  const wantsEmail = channel !== "push";
  const wantsPush = channel !== "email";
  if (wantsPush && !isFcmConfigured()) {
    return NextResponse.json(
      { error: "Firebase set nahi hai — push nahi ja sakta (FIREBASE-SETUP.md dekho)" },
      { status: 503 },
    );
  }

  // Admin ne list me se khud kuch log chune hain? Tab audience bekaar hai —
  // ye chuni hui list hi sach hai. Yahi wo raasta hai jisse galti se active
  // users ko mail nahi jaata (item 8).
  const picked = Array.isArray(body.userIds)
    ? new Set(body.userIds.filter((v): v is string => typeof v === "string" && !!v))
    : null;
  if (picked && picked.size === 0) {
    return NextResponse.json({ error: "kam se kam ek user chuno" }, { status: 400 });
  }

  // Targets nikaalo.
  let profiles: Profile[];
  try {
    profiles = await sbGet<Profile>("profiles?select=id,email,language");
  } catch (e) {
    return NextResponse.json({ error: "profiles fetch failed", detail: String(e) }, { status: 500 });
  }

  // Sirf push bhej rahe hain to email na hona koi rukawat nahi — us user ke
  // phone par notification phir bhi ja sakti hai.
  let targets = wantsEmail ? profiles.filter((p) => !!p.email) : profiles;

  if (picked) {
    targets = targets.filter((p) => picked.has(p.id));
  } else if (audience === "inactive") {
    // Active = jinhone koi reminder ya document banaya. Baaki inactive.
    try {
      const active = await activeUserIds();
      targets = targets.filter((p) => !active.has(p.id));
    } catch (e) {
      return NextResponse.json({ error: "activity fetch failed", detail: String(e) }, { status: 500 });
    }
  }

  targets = targets.slice(0, MAX_RECIPIENTS);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  /* ------------------------------ email ------------------------------ */

  if (wantsEmail) {
    // Admin-composed message ko branded shell me daalo. Newlines -> paragraphs.
    const inner = escapeHtml(message)
      .split(/\n{2,}/)
      .map((para) => emailParagraph(para.replace(/\n/g, "<br/>")))
      .join("");
    const html = renderEmail(subject, inner, subject);

    for (const p of targets) {
      if (!p.email) continue;
      try {
        const res = await sendMail({ to: p.email, subject, html, fromName: "Apka Saathi" });
        if (res.sent) sent++;
        else skipped++;
      } catch (e) {
        errors.push(`${p.email}: ${String(e)}`);
        void logServerError(e, { where: "admin/notify", step: "email", to: p.email });
      }
    }
  }

  /* ------------------------------- push ------------------------------- */

  let push: { sent: number; failed: number; devices: number } | null = null;

  if (wantsPush) {
    const tokens = await tokensFor(targets.map((p) => p.id)).catch((e) => {
      void logServerError(e, { where: "admin/notify", step: "device_tokens fetch" });
      return [] as string[];
    });
    const res = await sendPush(tokens, subject, message);
    push = { sent: res.sent, failed: res.failed, devices: tokens.length };
    errors.push(...res.errors);

    // ⚠️ Ye logging pehle nahi thi, aur usi wajah se push fail hone par admin ko
    // kuch pata hi nahi chalta tha: error sirf HTTP response me jaata tha, aur
    // Logs screen khaali rehti thi. Ab har fail wahan dikhega.
    if (res.errors.length) {
      void logServerError(new Error(`push failed: ${res.errors[0]}`), {
        where: "admin/notify",
        channel,
        devices: tokens.length,
        sent: res.sent,
        failed: res.failed,
        allErrors: res.errors,
      });
    }
    // "Ek bhi device nahi mila" bhi batane laayak hai — ye fail nahi hai, par
    // admin ko lagta hai push toot gayi. Warning level isi ke liye.
    if (tokens.length === 0) {
      void logServerError(new Error("push: koi device token nahi mila"), {
        where: "admin/notify",
        channel,
        users: targets.length,
        hint: "users ne push wali nayi app install/login nahi ki",
      });
    }

    // App uninstall ho chuki / token expire — DB se hata do, warna har broadcast
    // me ye tokens fail ginte rahenge aur list kachre se bharti jaayegi.
    await dropDeadTokens(res.deadTokens);
  }

  return NextResponse.json({
    audience: picked ? "picked" : audience,
    channel,
    total: targets.length,
    sent,
    skipped,
    push,
    errors: errors.slice(0, 5),
  });
}
