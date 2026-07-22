import { NextResponse } from "next/server";
import { sendDocumentWhatsApp } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// App jaise hi: expiry se 14 / 3 / 0 din pehle, subah 9 baje (IST).
const LEAD_DAYS = [14, 3, 0];
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// 09:00 IST = 03:30 UTC.
const IST_9AM_UTC_MS = (3 * 60 + 30) * 60 * 1000;

function sbHeaders(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sbGet<T>(query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: sbHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase get failed: ${res.status}`);
  return (await res.json()) as T[];
}

type DueDoc = {
  id: string;
  name: string;
  expiry: string; // YYYY-MM-DD
  user_id: string | null;
  expiry_ack_at: string | null;
};

/** Expiry (YYYY-MM-DD) ke liye ek lead ka notification-moment (UTC ms). */
function noticeMoment(expiry: string, lead: number): number {
  const [y, m, d] = expiry.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d); // us din 00:00 UTC
  return base + IST_9AM_UTC_MS - lead * DAY;
}

function whenLabel(lead: number): string {
  if (lead === 0) return "aaj";
  return `${lead} din me`;
}

/**
 * Har ghante pg_cron isse call karta hai. Jis document ka expiry-notification
 * ~1 ghante pehle due tha aur user ne ab tak app me OK/dekha nahi (expiry_ack_at),
 * uska WhatsApp follow-up bhejta hai — ek (document, moment) ka sirf ek baar.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const now = Date.now();

  // Aane wale/haal ke expiry wale documents (thodi range) — poora scan na ho.
  const lo = new Date(now - 20 * DAY).toISOString().slice(0, 10);
  const hi = new Date(now + 20 * DAY).toISOString().slice(0, 10);

  let docs: DueDoc[];
  try {
    docs = await sbGet<DueDoc>(
      `documents?select=id,name,expiry,user_id,expiry_ack_at` +
        `&expiry=gte.${lo}&expiry=lte.${hi}&limit=500`,
    );
  } catch (err) {
    console.error("[cron/document-whatsapp] fetch failed", err);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  const phoneCache = new Map<string, string | null>();
  async function getPhone(uid: string): Promise<string | null> {
    if (phoneCache.has(uid)) return phoneCache.get(uid) ?? null;
    const rows = await sbGet<{ phone: string | null }>(
      `user_details?user_id=eq.${uid}&select=phone`,
    ).catch(() => []);
    const v = rows[0]?.phone ?? null;
    phoneCache.set(uid, v);
    return v;
  }

  let sent = 0;
  const errors: string[] = [];

  for (const doc of docs) {
    if (!doc.user_id || !doc.expiry) continue;

    // Sabse haal wala notification-moment jo 1h+ pehle nikla (25h window me).
    let hit: { moment: number; lead: number } | null = null;
    for (const lead of LEAD_DAYS) {
      const m = noticeMoment(doc.expiry, lead);
      const age = now - m;
      if (age >= HOUR && age < 25 * HOUR) {
        if (!hit || m > hit.moment) hit = { moment: m, lead };
      }
    }
    if (!hit) continue;

    // User ne us moment ke baad ack kiya? -> WhatsApp skip.
    if (doc.expiry_ack_at && new Date(doc.expiry_ack_at).getTime() >= hit.moment) continue;

    // Pehle bhej chuke? unique(document_id, due_at) se dedupe (insert-conflict).
    const dueIso = new Date(hit.moment).toISOString();
    const claim = await fetch(`${SUPABASE_URL}/rest/v1/document_whatsapp_log`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ document_id: doc.id, due_at: dueIso }),
      cache: "no-store",
    });
    // 409 = pehle se log hai -> is moment ka WhatsApp ja chuka, skip.
    if (claim.status === 409) continue;
    if (!claim.ok) {
      errors.push(`log ${doc.id}: ${claim.status}`);
      continue;
    }

    const phone = await getPhone(doc.user_id);
    if (!phone) continue;

    try {
      const res = await sendDocumentWhatsApp(phone, doc.name, whenLabel(hit.lead));
      if (res.sent) sent++;
    } catch (e) {
      errors.push(`wa ${doc.id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ scanned: docs.length, whatsapp: sent, errors: errors.slice(0, 10) });
}
