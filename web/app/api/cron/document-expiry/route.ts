import { NextResponse } from "next/server";
import { sendDocumentWhatsApp } from "@/lib/twilio";
import { sendDocumentExpiryEmail } from "@/lib/email";
import {
  PROFILE_SELECT,
  toReminderProfile,
  type Loc,
  type ProfileRow,
  type ReminderProfile,
} from "@/lib/reminder-channels";

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

  const profileCache = new Map<string, ReminderProfile>();
  const phoneCache = new Map<string, string | null>();

  async function getProfile(uid: string): Promise<ReminderProfile> {
    const cached = profileCache.get(uid);
    if (cached) return cached;
    const rows = await sbGet<ProfileRow>(
      `profiles?id=eq.${uid}&select=${PROFILE_SELECT}`,
    ).catch(() => []);
    const v = toReminderProfile(rows[0]);
    profileCache.set(uid, v);
    return v;
  }

  /**
   * Is user ka WhatsApp number — SIRF tab jab wo verify ho chuka ho.
   *
   * ⚠️ Pehle yahan sirf `phone` padha jaata tha, aur jo bhi likha ho wahi sach
   * maan liya jaata tha. Ek digit ki galti ka natija ye hota tha ki reminder
   * kisi AJNABI ke WhatsApp par jaata rehta — mahino tak, roz — aur asli user
   * ko kabhi kuch nahi milta. Dono me se kisi ko wajah pata hi nahi chalti thi:
   * bhejne wale ko "sent" dikhta tha aur paane wale ko koi reminder hi nahi.
   *
   * `phone_verified_at` tabhi bharta hai jab us number par SMS ka OTP pahunch ke
   * wapas confirm ho chuka ho (`supabase/phone-verify.sql`). Number badalte hi
   * DB ka trigger use null kar deta hai, isliye purana verification naye number
   * par kabhi chipak nahi sakta.
   *
   * Iska seedha asar: jin purane users ne abhi tak verify nahi kiya, unka
   * WhatsApp tab tak nahi jaayega. Email aur phone ki notification pehle ki
   * tarah chalti rahengi — sirf wahi raasta rukta hai jahan galti kisi TEESRE
   * banda tak pahunch jaati hai.
   */
  async function getPhone(uid: string): Promise<string | null> {
    if (phoneCache.has(uid)) return phoneCache.get(uid) ?? null;
    const rows = await sbGet<{ phone: string | null; phone_verified_at: string | null }>(
      `user_details?user_id=eq.${uid}&select=phone,phone_verified_at`,
    ).catch(() => []);
    const row = rows[0];
    const v = row?.phone && row.phone_verified_at ? row.phone : null;
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
  /** Free plan wale — inka expiry alert phone par gaya, email/WhatsApp Plus ka hai. */
  let skippedFree = 0;
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

    /**
     * Email aur WhatsApp SIRF Plus me — bilkul wahi niyam jo reminder cron me
     * hai (`lib/reminder-channels.ts`).
     *
     * ⚠️ Yahan `continue` karna theek hai (reminder cron se ulta): us cron me
     * neeche `advance_reminder` chalta hai jo har haal me chahiye. Yahan neeche
     * sirf bhejna hi bacha hai — `claim()` bhi tabhi lagta hai jab sach me
     * kuch bheja jaye, warna Plus lene ke baad us din ka alert "bhej diya"
     * mark hoke chup-chaap gum ho jaata.
     *
     * Phone ki notification par koi asar nahi — wo app khud lagati hai
     * (`scheduleDocumentExpiry`) aur free plan me chalti rehti hai.
     */
    if (!profile.isPlus) {
      skippedFree++;
      continue;
    }

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
        const res = await sendDocumentWhatsApp(
          phone,
          doc.name,
          whenLabel(hit.lead, profile.language),
          doc.user_id,
          profile.language,
          // Greeting ka naam ("Namaste Nitish"). Naam na ho to twilio.ts bhasha
          // ka aam shabd laga deta hai — khaali variable Meta reject kar deta
          // hai, yaani us user ka message bilkul hi nahi jaata.
          profile.name,
        );
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
    // "email 0 kyun gaye" ka jawab — free users the, SMTP kharab nahi hai.
    skippedFreePlan: skippedFree,
    errors: errors.slice(0, 10),
  });
}

/** WhatsApp ke liye chhota label — template variable me yahi jaata hai. */
/**
 * "aaj" / "kal" / "3 din me" — user ki bhasha me.
 *
 * ⚠️ Ye pehle hamesha Hinglish tha, aur seedha WhatsApp message ke beech me
 * chala jaata tha. Yaani Hindi wale user ko poora message Hindi me milta aur
 * beech me "3 din me" Hinglish me.
 */
function whenLabel(lead: number, locale: Loc): string {
  if (locale === "hi") {
    if (lead === 0) return "आज";
    if (lead === 1) return "कल";
    return `${lead} दिन में`;
  }
  if (locale === "en") {
    if (lead === 0) return "today";
    if (lead === 1) return "tomorrow";
    return `in ${lead} days`;
  }
  if (lead === 0) return "aaj";
  if (lead === 1) return "kal";
  return `${lead} din me`;
}
