import { NextResponse } from "next/server";
import { sendReminderWhatsApp } from "@/lib/twilio";
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

  // Per-user profile (email + bhasha) cache (N+1 avoid).
  type Loc = "hinglish" | "hi" | "en";
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
      language: (lang === "hi" || lang === "en" || lang === "hinglish" ? lang : "hinglish") as Loc,
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

  let wa = 0;
  let mail = 0;
  const errors: string[] = [];

  for (const r of due) {
    const label = whenLabel(r);

    if (r.user_id) {
      const [profile, phone] = await Promise.all([
        getProfile(r.user_id),
        getPhone(r.user_id),
      ]);

      if (phone) {
        try {
          const res = await sendReminderWhatsApp(phone, r.title, label, r.note, r.user_id);
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
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/advance_reminder`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ p_id: r.id, p_sent_at: nowIso }),
      cache: "no-store",
    }).catch((e) => errors.push(`advance ${r.id}: ${String(e)}`));
  }

  return NextResponse.json({
    processed: due.length,
    whatsapp: wa,
    email: mail,
    errors: errors.slice(0, 10),
  });
}
