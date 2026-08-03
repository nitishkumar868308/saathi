import { NextResponse } from "next/server";
import { sendReminderWhatsApp } from "@/lib/twilio";
import {
  PROFILE_SELECT,
  toReminderProfile,
  type ProfileRow,
  type ReminderProfile,
} from "@/lib/reminder-channels";
import { sendReminderEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

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

type DueReminder = {
  id: string;
  title: string;
  /** User ne apne shabdon me jo likha tha — email/WhatsApp me title ke saath. */
  note: string | null;
  time_label: string | null;
  remind_at: string;
  user_id: string | null;
};

function whenLabel(r: DueReminder): string {
  if (r.time_label) return r.time_label;
  return new Date(r.remind_at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Har minute Supabase pg_cron isse call karta hai.
 * Due reminders (remind_at <= now, on, abhi tak nahi bheje) ko
 * WhatsApp + email bhejta hai, phir notified_at set karta hai.
 */
export async function POST(request: Request) {
  // Auth — sirf cron/known caller.
  const auth = request.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const nowIso = new Date().toISOString();

  let due: DueReminder[];
  try {
    due = await sbGet<DueReminder>(
      `reminders?select=id,title,note,time_label,remind_at,user_id` +
        `&is_on=eq.true&is_paused=eq.false&notified_at=is.null&remind_at=lte.${nowIso}` +
        `&order=remind_at.asc&limit=50`,
    );
  } catch (err) {
    console.error("[cron/send-reminders] fetch due failed", err);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  // Per-user profile (email + bhasha + plan) cache (N+1 avoid).
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

  /** Jo kuch bhi galat gaya — jawab me aata hai, taaki chup-chaap na rahe. */
  const errors: string[] = [];

  /**
   * Reminder ko aage sarkao — aur agar wo na ho paaye to usse ROKO.
   *
   * ⚠️ Yahan pehle ek chup-chaap bug tha jo bahut mehnga pad sakta tha. Call aisi
   * likhi thi: `fetch(...).catch(...)`. Par `fetch` sirf network toot-ne par
   * reject karta hai — 404 ya 500 ek KAAMYAB promise hai. Yaani RPC ke fail hone
   * par (SQL na chala ho, function ka naam/grant badla ho, ya ek 500) yahan kuch
   * pata hi nahi chalta tha, `notified_at` null pada rehta tha, `remind_at` beet
   * chuka hota tha — aur agle minute wahi reminder DOBARA due nikal aata tha.
   *
   * Cron har minute chalta hai. Iska matlab ek hi reminder par har minute ek
   * WhatsApp aur ek email — ghanton tak, jab tak kisi ki nazar na pade. User ke
   * liye ye "spam" hai, hamare liye Twilio ka bill, aur number block hone ka
   * seedha raasta.
   *
   * Ab do parat:
   *   1. `res.ok` sach me dekha jaata hai, aur fail admin ko dikhta hai.
   *   2. Fail hone par `notified_at` seedha bhar dete hain. Isse roz wala reminder
   *      us din ke baad ruk jaata hai (jo apne aap me theek nahi hai) — par ek
   *      ruka hua reminder har minute bajne wale reminder se bahut behtar hai.
   *      Wajah `errors` me chali jaati hai, isliye ye chup-chaap nahi hota.
   */
  async function advance(id: string): Promise<void> {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/advance_reminder`, {
        method: "POST",
        headers: sbHeaders({ Prefer: "return=minimal" }),
        body: JSON.stringify({ p_id: id, p_sent_at: nowIso }),
        cache: "no-store",
      });
      if (res.ok) return;
      errors.push(
        `advance ${id}: HTTP ${res.status} (supabase/reminder-repeat.sql run kiya?)`,
      );
    } catch (e) {
      errors.push(`advance ${id}: ${String(e)}`);
    }

    // Aakhri sahara — dobara-dobara bhejne se rok do.
    try {
      const stop = await fetch(`${SUPABASE_URL}/rest/v1/reminders?id=eq.${id}`, {
        method: "PATCH",
        headers: sbHeaders({ Prefer: "return=minimal" }),
        body: JSON.stringify({ notified_at: nowIso }),
        cache: "no-store",
      });
      if (!stop.ok) errors.push(`stop ${id}: HTTP ${stop.status}`);
    } catch (e) {
      errors.push(`stop ${id}: ${String(e)}`);
    }
  }

  let wa = 0;
  let mail = 0;
  /** Free plan wale — inka reminder bhi nikla, par email/WhatsApp Plus ka hai. */
  let skippedFree = 0;

  for (const r of due) {
    const label = whenLabel(r);

    if (r.user_id) {
      const profile = await getProfile(r.user_id);

      /**
       * Email aur WhatsApp SIRF Plus me.
       *
       * ⚠️ Pehle ye check tha hi nahi — har user ko email jaata tha, jabki
       * pricing page par yahi Plus ka feature bech rahe hain. Free user ko
       * phone ki notification tab bhi milti hai (wo free plan ka hissa hai);
       * band sirf ye do raaste hote hain.
       *
       * ⚠️ Yahan `continue` MAT karna. Neeche wala `advance_reminder` HAR
       * reminder par chalna zaroori hai — wahi remind_at ko agle din par
       * sarkaata hai. Chhod dete to free user ka roz wala reminder pehle hi
       * din par atak jaata aur phone ki notification bhi dobara kabhi na aati.
       */
      if (!profile.isPlus) {
        skippedFree++;
      } else {
        const phone = await getPhone(r.user_id);
        if (phone) {
          try {
            const res = await sendReminderWhatsApp(
              phone,
              r.title,
              label,
              r.note,
              r.user_id,
              // Email pehle se user ki bhasha me jaata tha, WhatsApp nahi — ek
              // hi reminder do alag bhashaon me pahunchta tha.
              profile.language,
              // Greeting ka naam ("Namaste Nitish"). Naam na ho to twilio.ts
              // bhasha ka aam shabd laga deta hai — khaali variable Meta reject
              // kar deta hai, yaani us user ka reminder bilkul hi nahi jaata.
              profile.name,
            );
            if (res.sent) wa++;
          } catch (e) {
            errors.push(`wa ${r.id}: ${String(e)}`);
          }
        }
        if (profile.email) {
          try {
            const res = await sendReminderEmail(
              profile.email,
              r.title,
              label,
              profile.language,
              r.note,
              r.user_id,
            );
            if (res.sent) mail++;
          } catch (e) {
            errors.push(`mail ${r.id}: ${String(e)}`);
          }
        }
      }
    }

    // Bhej diya — ab aage badho.
    //
    // ⚠️ Pehle yahan seedha `notified_at = now` PATCH hota tha. Roz wale
    // reminder ("gym subah 6, 90 din tak") me wo ghaatak tha: pehli subah
    // notified_at bhar jaata aur query usse dobara kabhi uthati hi nahi —
    // reminder ek hi baar aake chup ho jaata tha.
    //
    // `advance_reminder` dono soorat sambhalta hai: ek baar wale me wahi purana
    // notified_at, aur roz wale me remind_at agle din pe sarka ke notified_at
    // saaf — taaki kal subah wapas due ho jaye. Agla din nikaalne ka hisaab
    // wahi SQL function karta hai jo app ka "ho gaya" button use karta hai,
    // isliye dono kabhi alag din par nahi ja sakte.
    await advance(r.id);
  }

  return NextResponse.json({
    processed: due.length,
    whatsapp: wa,
    email: mail,
    // Ye ginti dikhna zaroori hai: "email 0 kyun gaye" ka jawab yahin milta hai
    // (free users the), warna lagta hai SMTP hi toot gaya.
    skippedFreePlan: skippedFree,
    errors: errors.slice(0, 10),
  });
}
