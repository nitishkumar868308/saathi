import { NextResponse } from "next/server";

import { guard } from "@/lib/admin-guard";
import { sendPlanExpiredEmail } from "@/lib/email";
import { isFcmConfigured, sendPush } from "@/lib/fcm";
import { getOffers } from "@/lib/offers";
import { logServerError } from "@/lib/errors-server";
import type { Loc } from "@/lib/reminder-channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * "Plus khatam" — jinka Plus nikal chuka hai, unhe uski KHABAR dena.
 *
 * ── Ye kyun bana ──────────────────────────────────────────────────────
 *
 * ⚠️ Downgrade ab apne aap hota hai (`supabase/cron-plan-expiry.sql`, har
 * ghante): Plus khatam hote hi free hadd se AAGE ke documents lock ho jaate
 * hain aur aage ke reminders pause. Ye theek hai — par user ko iski khabar
 * kahin se milti hi nahi thi.
 *
 * Uske liye wo bilkul aisa dikhta hai jaise app kharab ho gayi ho: "mere
 * documents kahan gaye", "reminder aana band kyun ho gaya". Ye sabse bura kism
 * ka bharosa-todne wala pal hai, kyunki hua kuch galat nahi tha — bas plan
 * khatam ho gaya aur wo ek line kisi ne kahi hi nahi.
 *
 * ⚠️ Khabar JAAN-BOOJH KE apne aap nahi jaati, admin ke click par jaati hai.
 * Wajah: ye ek paise wali baat hai. Ek galat samjha hua downgrade (Play ka
 * webhook der se aaya, grant galat lag gaya) par apne aap "aapka Plus khatam ho
 * gaya" bhej dena us user ka bharosa seedha todta hai, aur us email ko wapas
 * nahi liya ja sakta. Admin pehle list me dekh leta hai ki ginti sach lag rahi
 * hai ya nahi — phir bhejta hai.
 *
 * GET  → list (kaun-kaun, kitna lock hua, khabar gayi ya nahi)
 * POST → { userId, channels: ("email" | "push")[] } — bhejo aur nishaan lagao
 */

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  language: string | null;
  plan_expires_at: string | null;
  plan_expiry_notified_at: string | null;
};

export type PlanExpiryUser = {
  id: string;
  email: string | null;
  name: string;
  language: Loc;
  expiredAt: string | null;
  notifiedAt: string | null;
  documents: number;
  reminders: number;
  lockedDocuments: number;
  pausedReminders: number;
  /** Is user tak push ja sakti hai? (Ek bhi phone registered hai ya nahi.) */
  hasDevice: boolean;
};

function sbHeaders(extra?: Record<string, string>) {
  return {
    apikey: SERVICE as string,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sbGet<T>(query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: sbHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  return (await res.json()) as T[];
}

/** `profiles.language` ka jo bhi ho — hamesha teen me se ek. */
function toLoc(language: string | null | undefined): Loc {
  return language === "hi" || language === "en" ? language : "hinglish";
}

/**
 * Push ka title/body — user ki apni bhasha me.
 *
 * ⚠️ Lehja email jaisa hi hai: "sab surakshit hai", "aapne kho diya" nahi. Aur
 * ye SACH hai — kuch delete nahi hota, sirf lock hota hai, aur Plus wapas lete
 * hi sab khud khul jaata hai. Notification ki ek line me dara dena bahut aasan
 * hai, aur uska koi faayda bhi nahi.
 */
const PUSH_COPY: Record<Loc, { title: string; body: string }> = {
  hinglish: {
    title: "Aapka Plus khatam ho gaya",
    body: "Kuch delete nahi hua — sab surakshit hai. Bas kuch documents aur reminders abhi lock hain. Tap karke dekho.",
  },
  hi: {
    title: "आपका Plus खत्म हो गया",
    body: "कुछ डिलीट नहीं हुआ — सब सुरक्षित है। बस कुछ डॉक्युमेंट और रिमाइंडर अभी लॉक हैं। टैप करके देखिए।",
  },
  en: {
    title: "Your Plus has ended",
    body: "Nothing was deleted — everything is safe. Some documents and reminders are locked for now. Tap to see.",
  },
};

/* ------------------------------------------------------------------ */
/*  GET — kaun-kaun free plan par gir chuka hai                        */
/* ------------------------------------------------------------------ */

export async function GET() {
  const g = await guard("planExpiry");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const nowIso = new Date().toISOString();

  /**
   * ⚠️ Shart wahi hai jo `is_plus_active()` lagata hai — plan column `'plus'` hi
   * rehta hai aur expiry nikal jaati hai (`cron-plan-expiry.sql` column ko
   * 'free' JAAN-BOOJH KE nahi karta; wo itihaas hai). Ise yahan dobara likhna
   * padta hai kyunki PostgREST se function-based filter nahi lagta — par shart
   * ek hi hai, aur badalne par dono jagah badalni hogi.
   */
  let rows: ProfileRow[];
  try {
    rows = await sbGet<ProfileRow>(
      `profiles?select=id,email,full_name,language,plan_expires_at,plan_expiry_notified_at` +
        `&plan=eq.plus&plan_expires_at=not.is.null&plan_expires_at=lt.${nowIso}` +
        `&order=plan_expires_at.desc&limit=200`,
    );
  } catch (e) {
    await logServerError(e, { where: "admin/plan-expiry", step: "profiles" });
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  if (rows.length === 0) {
    const offers = await getOffers();
    return NextResponse.json({ users: [], offers, push: isFcmConfigured() });
  }

  const ids = rows.map((r) => r.id);
  const inList = `(${ids.join(",")})`;

  const [offers, docs, rems, devices] = await Promise.all([
    getOffers(),
    sbGet<{ user_id: string | null }>(`documents?select=user_id&user_id=in.${inList}`).catch(
      () => [],
    ),
    sbGet<{ user_id: string | null }>(`reminders?select=user_id&user_id=in.${inList}`).catch(
      () => [],
    ),
    sbGet<{ user_id: string | null }>(`device_tokens?select=user_id&user_id=in.${inList}`).catch(
      () => [],
    ),
  ]);

  const count = (list: { user_id: string | null }[]) => {
    const m = new Map<string, number>();
    list.forEach((r) => r.user_id && m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1));
    return m;
  };
  const docCount = count(docs);
  const remCount = count(rems);
  const withDevice = new Set(devices.map((d) => d.user_id).filter(Boolean) as string[]);

  const users: PlanExpiryUser[] = rows.map((r) => {
    const documents = docCount.get(r.id) ?? 0;
    const reminders = remCount.get(r.id) ?? 0;
    return {
      id: r.id,
      email: r.email,
      name: r.full_name?.trim() || "",
      language: toLoc(r.language),
      expiredAt: r.plan_expires_at,
      notifiedAt: r.plan_expiry_notified_at,
      documents,
      reminders,
      // Free hadd se aage jitne the, utne lock/pause hue.
      lockedDocuments: Math.max(0, documents - offers.freeDocuments),
      pausedReminders: Math.max(0, reminders - offers.freeReminders),
      hasDevice: withDevice.has(r.id),
    };
  });

  return NextResponse.json({ users, offers, push: isFcmConfigured() });
}

/* ------------------------------------------------------------------ */
/*  POST — ek user ko khabar bhejo                                     */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  const g = await guard("planExpiry");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  let body: { userId?: string; channels?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId chahiye" }, { status: 400 });

  const wantEmail = (body.channels ?? []).includes("email");
  const wantPush = (body.channels ?? []).includes("push");
  if (!wantEmail && !wantPush) {
    return NextResponse.json({ error: "kam se kam ek channel chuno" }, { status: 400 });
  }

  const rows = await sbGet<ProfileRow>(
    `profiles?id=eq.${userId}&select=id,email,full_name,language,plan_expires_at,plan_expiry_notified_at`,
  ).catch(() => []);
  const profile = rows[0];
  if (!profile) return NextResponse.json({ error: "user nahi mila" }, { status: 404 });

  const locale = toLoc(profile.language);
  const [offers, docs, rems] = await Promise.all([
    getOffers(),
    sbGet<{ id: string }>(`documents?select=id&user_id=eq.${userId}`).catch(() => []),
    sbGet<{ id: string }>(`reminders?select=id&user_id=eq.${userId}`).catch(() => []),
  ]);

  const counts = {
    freeDocuments: offers.freeDocuments,
    freeReminders: offers.freeReminders,
    lockedDocuments: Math.max(0, docs.length - offers.freeDocuments),
    pausedReminders: Math.max(0, rems.length - offers.freeReminders),
  };

  const result = { email: false, push: 0, errors: [] as string[] };

  /* --- Email --- */
  if (wantEmail) {
    if (!profile.email) {
      result.errors.push("is user ka email hai hi nahi");
    } else {
      try {
        const r = await sendPlanExpiredEmail(
          profile.email,
          profile.full_name ?? "",
          counts,
          locale,
          userId,
        );
        if (r.sent) result.email = true;
        // `skipped` = SMTP ka env hi set nahi tha. Ye "bhej diya" se bilkul alag
        // baat hai, aur ise chup-chaap nigal jaana wahi purani galti hoti.
        else result.errors.push("SMTP set nahi hai — email nahi gaya");
      } catch (e) {
        result.errors.push(`email fail: ${String(e)}`);
        await logServerError(e, { where: "admin/plan-expiry", step: "email", userId });
      }
    }
  }

  /* --- Push --- */
  if (wantPush) {
    if (!isFcmConfigured()) {
      result.errors.push("Firebase set nahi hai — notification nahi gayi");
    } else {
      const tokens = await sbGet<{ token: string }>(
        `device_tokens?select=token&user_id=eq.${userId}`,
      ).catch(() => []);
      if (tokens.length === 0) {
        result.errors.push("is user ka koi phone registered nahi hai");
      } else {
        const copy = PUSH_COPY[locale] ?? PUSH_COPY.hinglish;
        try {
          const r = await sendPush(
            tokens.map((t) => ({ token: t.token })),
            copy.title,
            copy.body,
            /**
             * ⚠️ `kind: "plan_expired"` sirf ek label nahi hai — app isi se
             * apna full-screen wala samjhane ka page kholti hai
             * (`components/plan-expired-alert.tsx`). Ise badla to notification
             * dikhna band nahi hogi, par tap karne par kuch hoga hi nahi.
             */
            { kind: "plan_expired" },
          );
          result.push = r.sent;
          if (r.sent === 0 && r.errors.length) result.errors.push(r.errors[0]);
        } catch (e) {
          result.errors.push(`push fail: ${String(e)}`);
          await logServerError(e, { where: "admin/plan-expiry", step: "push", userId });
        }
      }
    }
  }

  /**
   * Nishaan tabhi lagta hai jab SACH ME kuch chala gaya ho.
   *
   * ⚠️ Warna ek fail hui koshish us user ko list ke "bataya ja chuka hai" wale
   * hisse me daal deti, aur uski khabar hamesha ke liye gum ho jaati — theek
   * wahi chup-chaap fail jise ye poora section hataane ke liye bana hai.
   */
  if (result.email || result.push > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ plan_expiry_notified_at: new Date().toISOString() }),
      cache: "no-store",
    }).catch(() => {
      // Nishaan na lag paaye to sirf itna hota hai ki wo user list me phir se
      // "abhi tak nahi bataya" dikhega. Bhej to diya ja chuka hai.
      result.errors.push("bhej diya, par nishaan lagana fail hua");
    });
  }

  return NextResponse.json(result);
}
