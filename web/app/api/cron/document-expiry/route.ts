import { NextResponse } from "next/server";
import { sendDocumentWhatsApp } from "@/lib/twilio";
import { sendDocumentExpiryEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Document expiry ka teen-qadam ladder — 7 din pehle, 1 din pehle, us din.
 *
 * ⚠️ Ye app ke `EXPIRY_LEAD_DAYS` (app-mobile/src/lib/notifications.ts) ke saath
 * BILKUL milna chahiye. Wahan phone ki notification isi ladder par lagti hai,
 * yahan email + WhatsApp. Ek jagah badla aur doosri jagah nahi, to user ko
 * notification aaj aayegi aur email kisi aur din — sabse bura tajurba.
 */
const LEAD_DAYS = [7, 1, 0];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// App bhi 9 baje subah bhejti hai (NOTIFY_HOUR). 09:00 IST = 03:30 UTC.
const IST_9AM_UTC_MS = (3 * 60 + 30) * 60 * 1000;

/**
 * Ek moment ki khabar kitni der tak bheji ja sakti hai.
 *
 * Cron har 15 minute chalta hai, isliye normal haalat me khabar 9:00-9:15 IST
 * ke beech chali jaati hai. Ye 25 ghante ki khidki sirf isliye hai ki agar cron
 * ya deploy kuch ghante down raha ho to khabar chhoote nahi — der se sahi, jaye
 * to zaroor.
 */
const WINDOW_MS = 25 * HOUR;

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

type Loc = "hinglish" | "hi" | "en";

type DueDoc = {
  id: string;
  name: string;
  expiry: string; // YYYY-MM-DD
  user_id: string | null;
  /** User ne alert dekh liya (us moment ka WhatsApp skip). */
  expiry_ack_at: string | null;
  /** User ne kaha kaam HO GAYA — aage ki koi khabar nahi jaani chahiye. */
  renewed_at: string | null;
};

/** Expiry (YYYY-MM-DD) ke liye ek lead ka notification-moment (UTC ms). */
function noticeMoment(expiry: string, lead: number): number {
  const [y, m, d] = expiry.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d); // us din 00:00 UTC
  return base + IST_9AM_UTC_MS - lead * DAY;
}

/**
 * Har 15 minute pg_cron isse call karta hai.
 *
 * Jis document ka koi bhi lead-moment abhi-abhi nikla hai, uska email aur
 * WhatsApp bhejta hai — ek (document, moment, channel) ka sirf ek baar.
 * `renewed_at` bhara ho (user ne kaha kaam ho gaya) to kuch nahi jaata.
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
      `documents?select=id,name,expiry,user_id,expiry_ack_at,renewed_at` +
        `&expiry=gte.${lo}&expiry=lte.${hi}&renewed_at=is.null&limit=500`,
    );
  } catch (err) {
    console.error("[cron/document-expiry] fetch failed", err);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  const profileCache = new Map<string, { email: string | null; language: Loc }>();
  const phoneCache = new Map<string, string | null>();

  async function getProfile(uid: string): Promise<{ email: string | null; language: Loc }> {
    const cached = profileCache.get(uid);
    if (cached) return cached;
    const rows = await sbGet<{ email: string | null; language: string | null }>(
      `profiles?id=eq.${uid}&select=email,language`,
    ).catch(() => []);
    const lang = rows[0]?.language;
    const v = {
      email: rows[0]?.email ?? null,
      language: (lang === "hi" || lang === "en" || lang === "hinglish"
        ? lang
        : "hinglish") as Loc,
    };
    profileCache.set(uid, v);
    return v;
  }

  async function getPhone(uid: string): Promise<string | null> {
    if (phoneCache.has(uid)) return phoneCache.get(uid) ?? null;
    const rows = await sbGet<{ phone: string | null }>(
      `user_details?user_id=eq.${uid}&select=phone`,
    ).catch(() => []);
    const v = rows[0]?.phone ?? null;
    phoneCache.set(uid, v);
    return v;
  }

  /**
   * Is (document, moment, channel) ki khabar pehle ja chuki?
   *
   * Dedupe insert se hota hai, select se nahi: do cron ek saath chal jayein to
   * select-phir-insert dono ko "nahi gaya" bata deta aur khabar do baar jaati.
   * unique constraint par 409 hi sach hai.
   */
  async function claim(docId: string, dueIso: string, channel: string): Promise<boolean> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/document_notify_log`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ document_id: docId, due_at: dueIso, channel }),
      cache: "no-store",
    });
    if (res.status === 409) return false; // pehle ja chuki
    if (!res.ok) throw new Error(`log ${channel}: ${res.status}`);
    return true;
  }

  let mail = 0;
  let wa = 0;
  const errors: string[] = [];

  for (const doc of docs) {
    if (!doc.user_id || !doc.expiry) continue;

    // Sabse haal wala moment jo nikal chuka hai (khidki ke andar).
    let hit: { moment: number; lead: number } | null = null;
    for (const lead of LEAD_DAYS) {
      const m = noticeMoment(doc.expiry, lead);
      const age = now - m;
      if (age >= 0 && age < WINDOW_MS) {
        if (!hit || m > hit.moment) hit = { moment: m, lead };
      }
    }
    if (!hit) continue;

    const dueIso = new Date(hit.moment).toISOString();
    const profile = await getProfile(doc.user_id);

    // --- Email ---
    if (profile.email) {
      try {
        if (await claim(doc.id, dueIso, "email")) {
          const res = await sendDocumentExpiryEmail(
            profile.email,
            doc.name,
            hit.lead,
            profile.language,
            doc.user_id,
          );
          if (res.sent) mail++;
        }
      } catch (e) {
        errors.push(`mail ${doc.id}: ${String(e)}`);
      }
    }

    // --- WhatsApp ---
    // User ne is moment ke BAAD app me alert dekh liya ho to WhatsApp bekaar
    // hai — wo pehle hi jaan chuka hai. (Email upar isliye chala jaata hai ki
    // wo aksar isi moment par nikal jaata hai, ack se pehle.)
    if (doc.expiry_ack_at && new Date(doc.expiry_ack_at).getTime() >= hit.moment) continue;

    const phone = await getPhone(doc.user_id);
    if (!phone) continue;
    try {
      if (await claim(doc.id, dueIso, "whatsapp")) {
        const res = await sendDocumentWhatsApp(phone, doc.name, whenLabel(hit.lead), doc.user_id);
        if (res.sent) wa++;
      }
    } catch (e) {
      errors.push(`wa ${doc.id}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    scanned: docs.length,
    email: mail,
    whatsapp: wa,
    errors: errors.slice(0, 10),
  });
}

/** WhatsApp ke liye chhota label — template variable me yahi jaata hai. */
function whenLabel(lead: number): string {
  if (lead === 0) return "aaj";
  if (lead === 1) return "kal";
  return `${lead} din me`;
}
