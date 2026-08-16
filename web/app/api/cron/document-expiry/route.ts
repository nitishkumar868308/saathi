import { NextResponse } from "next/server";
import { beatCron } from "@/lib/cron-heartbeat";
import { sendDocumentWhatsApp, twilioConfigured, waTemplateState } from "@/lib/twilio";
import { sendDocumentExpiryEmail, emailConfigured } from "@/lib/email";
import { logDeliverySkip } from "@/lib/delivery-log";
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
  // Auth paar ho gayi — yaani cron ki call sach me aayi AUR secret bhi sahi
  // tha. Yahi wo ek nishaan hai jo admin ko "job hi nahi hai" aur "job hai par
  // secret purana hai" me farq karne deta hai (wajah `lib/cron-heartbeat.ts`).
  beatCron("document-expiry");
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
    rawPhoneCache.set(uid, Boolean(row?.phone));
    const v = row?.phone && row.phone_verified_at ? row.phone : null;
    phoneCache.set(uid, v);
    return v;
  }

  /**
   * Number DAALA hua hai? (Verify hua ya nahi, ye alag baat hai.)
   *
   * Dono ka ilaaj alag hai — poori wajah `api/cron/send-reminders/route.ts` par
   * likhi hai, jahan bilkul yahi jodi hai.
   */
  const rawPhoneCache = new Map<string, boolean>();
  async function hasPhone(uid: string): Promise<boolean> {
    if (!rawPhoneCache.has(uid)) await getPhone(uid);
    return rawPhoneCache.get(uid) ?? false;
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

  /**
   * Claim wapas lo — khabar sach me gayi hi nahi.
   *
   * ⚠️ Ye is route ka sabse mehnga bug tha, aur bilkul chup tha. Tarteeb aisi
   * hai: pehle `claim()` (dedupe ke liye — do cron ek saath chal sakte hain),
   * phir bhejna. Par bhejna DO tarah se bina exception ke fail hota hai:
   *
   *   • SMTP ka env set na ho  -> `sendDocumentExpiryEmail` chup-chaap
   *     `{ sent: false, skipped: true }` lauta deta hai (`lib/email.ts`).
   *   • Twilio ka env set na ho -> `sendWhatsApp` bhi bilkul waise hi.
   *
   * Aur claim tab bhi TABLE ME PADI REH JAATI thi. Uska matlab: us (document,
   * moment, channel) ki khabar HAMESHA ke liye "bhej di gayi" mark ho gayi.
   * Baad me SMTP/Twilio theek kar bhi lo — un documents ka wo alert dobara
   * kabhi nahi jaata, kyunki wo moment ek hi baar aata hai.
   *
   * Yahi wajah hai ki "email/WhatsApp nahi aa raha" env theek karne ke BAAD bhi
   * theek nahi hota tha — jitne din config toota raha, utne din ke alert
   * hamesha ke liye jal chuke the.
   *
   * Ab jo bheja hi nahi gaya, uski claim hata di jaati hai — agla cron (15
   * minute baad) usi khidki me dobara koshish kar lega. Khidki 25 ghante ki hai,
   * isliye ek raat ka outage bhi khabar nahi khaata.
   *
   * ⚠️ Ye SIRF `skipped` par chalta hai (env set hi nahi tha), THROW par NAHI.
   * Ye farq zaroori hai. `sendMail` aur `sendWhatsApp` dono asli fail par throw
   * karte hain — aur asli fail aksar pakki hoti hai (template reject ho gaya,
   * number block hai, SMTP ka password badal gaya). Us par claim wapas lene ka
   * matlab hota: har 15 minute, 25 ghante tak, wahi fail hone wali call — yaani
   * ek document par ~100 bekaar koshishein, aur Twilio ke logs bhar jaate.
   * Fail `errors` me chala jaata hai; use dekh ke theek karna hi sahi raasta
   * hai, andhe retry nahi.
   */
  async function unclaim(docId: string, dueIso: string, channel: string): Promise<void> {
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/document_notify_log` +
          `?document_id=eq.${docId}&due_at=eq.${encodeURIComponent(dueIso)}` +
          `&channel=eq.${channel}`,
        { method: "DELETE", headers: sbHeaders({ Prefer: "return=minimal" }), cache: "no-store" },
      );
    } catch {
      /* Hata na paye to bas ek alert chhoot gaya — dobara bhejne se behtar hai. */
    }
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
      let claimed = false;
      try {
        claimed = await claim(doc.id, dueIso, "email");
        if (claimed) {
          const res = await sendDocumentExpiryEmail(
            profile.email,
            doc.name,
            hit.lead,
            profile.language,
            doc.user_id,
          );
          if (res.sent) {
            mail++;
            claimed = false; // sach me chala gaya — claim ab sahi hai, rehne do
          } else {
            // SMTP env hi nahi tha — claim jalane ka koi matlab nahi (upar
            // `unclaim` par poori wajah likhi hai).
            errors.push(`mail ${doc.id}: not sent (SMTP configured?)`);
            logDeliverySkip({
              channel: "email",
              kind: "document",
              reason: "smtp_off",
              userId: doc.user_id,
              itemId: doc.id,
            });
          }
        }
      } catch (e) {
        // Asli fail — claim RAKHI rehti hai (upar `unclaim` par wajah likhi hai).
        claimed = false;
        errors.push(`mail ${doc.id}: ${String(e)}`);
        logDeliverySkip({
          channel: "email",
          kind: "document",
          reason: "send_failed",
          userId: doc.user_id,
          itemId: doc.id,
          detail: String(e),
        });
      }
      if (claimed) await unclaim(doc.id, dueIso, "email");
    } else {
      logDeliverySkip({
        channel: "email",
        kind: "document",
        reason: "no_email",
        userId: doc.user_id,
        itemId: doc.id,
      });
    }

    // --- WhatsApp ---
    // User ne is moment ke BAAD app me alert dekh liya ho to WhatsApp bekaar
    // hai — wo pehle hi jaan chuka hai. (Email upar isliye chala jaata hai ki
    // wo aksar isi moment par nikal jaata hai, ack se pehle.)
    if (doc.expiry_ack_at && new Date(doc.expiry_ack_at).getTime() >= hit.moment) continue;

    const phone = await getPhone(doc.user_id);
    if (!phone) {
      // ⚠️ Pehle yahan seedha `continue` tha — poori tarah chup. Yahi wo sabse
      // aam wajah hai jiska jawab admin ko kabhi milta hi nahi tha.
      logDeliverySkip({
        channel: "whatsapp",
        kind: "document",
        reason: (await hasPhone(doc.user_id)) ? "phone_unverified" : "no_phone",
        userId: doc.user_id,
        itemId: doc.id,
      });
      continue;
    }
    let waClaimed = false;
    try {
      waClaimed = await claim(doc.id, dueIso, "whatsapp");
      if (waClaimed) {
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
        if (res.sent) {
          wa++;
          waClaimed = false; // sach me chala gaya — claim rehne do
        } else {
          // Twilio ka env hi nahi tha — claim jalane ka koi matlab nahi.
          errors.push(`wa ${doc.id}: not sent (Twilio configured?)`);
          logDeliverySkip({
            channel: "whatsapp",
            kind: "document",
            reason: "twilio_off",
            userId: doc.user_id,
            itemId: doc.id,
          });
        }
      }
    } catch (e) {
      // Asli fail — claim RAKHI rehti hai (upar `unclaim` par wajah likhi hai).
      waClaimed = false;
      errors.push(`wa ${doc.id}: ${String(e)}`);
      logDeliverySkip({
        channel: "whatsapp",
        kind: "document",
        reason: "send_failed",
        userId: doc.user_id,
        itemId: doc.id,
        detail: String(e),
      });
    }
    // Env hi set nahi tha — claim wapas, taaki env theek hote hi agla cron isse
    // bhej de. (Asli fail upar `catch` me hi nipat chuka hai.)
    if (waClaimed) await unclaim(doc.id, dueIso, "whatsapp");
  }

  return NextResponse.json({
    scanned: docs.length,
    email: mail,
    whatsapp: wa,
    // "email 0 kyun gaye" ka jawab — free users the, SMTP kharab nahi hai.
    skippedFreePlan: skippedFree,
    // Server ka apna haal — poori wajah `api/cron/send-reminders/route.ts` par
    // likhi hai. Dono cron ek jaisa jawab dete hain, taaki jaanch ek jagah se
    // ho sake.
    config: {
      twilio: twilioConfigured(),
      smtp: emailConfigured(),
      waTemplate: waTemplateState("document", "hinglish"),
    },
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
