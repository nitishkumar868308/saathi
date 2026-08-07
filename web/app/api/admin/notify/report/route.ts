import { NextResponse } from "next/server";

import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Message users" ka hisaab — kisko kitni baar gaya, kisne khola, kaun kahan gaya.
 *
 * ⚠️ Yahan jaan-boojh ke koi SQL view/aggregate nahi hai. Ginti JS me hoti hai,
 * kyunki:
 *   • PostgREST se group-by karne ke liye har baar ek naya DB view banana padta,
 *     aur wo admin panel ke har chhote badlav par migration maang leta;
 *   • is app ke paimane par rows hazaaron me hain, laakhon me nahi.
 *
 * Isliye seema saaf rakhi hai (`MAX_SENDS`) — usse zyada purana data report me
 * nahi aata, aur UI wahi saaf-saaf likh deta hai. Chup-chaap kaat dena sabse
 * bura hota: admin ko lagta ki 300 hi message gaye the.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Itni sends rows tak report banti hai (nayi se purani). */
const MAX_SENDS = 5000;
/** Ek user ki timeline me itne hi events — poori history UI me kaam ki nahi. */
const MAX_EVENTS = 200;

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

type BatchRow = {
  id: string;
  subject: string;
  body: string;
  channel: string;
  audience: string;
  total: number;
  created_at: string;
};

type SendRow = {
  id: string;
  batch_id: string;
  user_id: string | null;
  email: string | null;
  channel: string;
  status: string;
  error: string | null;
  devices: number;
  opened_at: string | null;
  clicked_at: string | null;
  open_count: number;
  click_count: number;
  last_target: string | null;
  created_at: string;
};

type ProfileRow = { id: string; email: string | null; full_name: string | null };

type EventRow = {
  send_id: string;
  type: string;
  target: string | null;
  url: string | null;
  created_at: string;
};

/** Ek jagah ki ginti — user ke liye bhi, batch ke liye bhi wahi shakal. */
type Tally = {
  emailSent: number;
  emailFailed: number;
  pushSent: number;
  pushFailed: number;
  opened: number;
  clicked: number;
  openCount: number;
  clickCount: number;
  toApp: number;
  toWeb: number;
};

function emptyTally(): Tally {
  return {
    emailSent: 0,
    emailFailed: 0,
    pushSent: 0,
    pushFailed: 0,
    opened: 0,
    clicked: 0,
    openCount: 0,
    clickCount: 0,
    toApp: 0,
    toWeb: 0,
  };
}

function add(t: Tally, s: SendRow): void {
  const ok = s.status === "sent";
  if (s.channel === "push") {
    if (ok) t.pushSent++;
    else t.pushFailed++;
  } else {
    if (ok) t.emailSent++;
    else t.emailFailed++;
  }
  // Na gaye hue message ka "khola/ignore" ginna galat hoga — wo user ki galti
  // nahi hai. Isliye rate hamesha SENT par hi banti hai.
  if (!ok) return;
  if (s.opened_at) t.opened++;
  if (s.clicked_at) t.clicked++;
  t.openCount += s.open_count;
  t.clickCount += s.click_count;
  if (s.last_target === "app") t.toApp++;
  else if (s.last_target === "web") t.toWeb++;
}

export async function GET(request: Request) {
  const g = await guard("message");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  /** Ek user ki poori timeline chahiye? (drill-down) */
  const userId = url.searchParams.get("userId");

  const cols =
    "id,batch_id,user_id,email,channel,status,error,devices,opened_at,clicked_at,open_count,click_count,last_target,created_at";

  let batches: BatchRow[];
  let sends: SendRow[];
  let profiles: ProfileRow[];
  try {
    [batches, sends, profiles] = await Promise.all([
      sbGet<BatchRow>("message_batches?select=*&order=created_at.desc&limit=200"),
      sbGet<SendRow>(`message_sends?select=${cols}&order=created_at.desc&limit=${MAX_SENDS}`),
      sbGet<ProfileRow>("profiles?select=id,email,full_name"),
    ]);
  } catch (e) {
    // Migration na chali ho to table hi nahi hoti — ye sabse aam soorat hai, aur
    // ise "sab toot gaya" dikhana galat hoga. UI isko pehchaan ke seedha likh
    // deta hai ki `supabase/message-tracking.sql` chalana baaki hai.
    return NextResponse.json(
      { error: "report fetch failed", detail: String(e), needsMigration: true },
      { status: 200 },
    );
  }

  const nameOf = new Map(profiles.map((p) => [p.id, p.full_name] as const));
  const mailOf = new Map(profiles.map((p) => [p.id, p.email] as const));

  /* ------------------------------ per user ------------------------------ */

  const byUser = new Map<
    string,
    { id: string; name: string | null; email: string | null; last: string; tally: Tally }
  >();

  for (const s of sends) {
    // Delete ho chuke user ki rows bhi report me rehti hain — unka apna khaana,
    // taaki totals kabhi jhooth na bolein.
    const key = s.user_id ?? `deleted:${s.email ?? "unknown"}`;
    let row = byUser.get(key);
    if (!row) {
      row = {
        id: s.user_id ?? "",
        name: s.user_id ? (nameOf.get(s.user_id) ?? null) : null,
        email: (s.user_id ? mailOf.get(s.user_id) : null) ?? s.email,
        // `sends` nayi se purani order me aati hain, isliye pehli hi sabse nayi.
        last: s.created_at,
        tally: emptyTally(),
      };
      byUser.set(key, row);
    }
    add(row.tally, s);
  }

  /* ------------------------------ per batch ----------------------------- */

  const byBatch = new Map<string, Tally>();
  for (const s of sends) {
    let t = byBatch.get(s.batch_id);
    if (!t) {
      t = emptyTally();
      byBatch.set(s.batch_id, t);
    }
    add(t, s);
  }

  /* ------------------------------ drill-down ---------------------------- */

  let detail: {
    sends: (SendRow & { subject: string | null })[];
    events: EventRow[];
  } | null = null;

  if (userId) {
    const mine = sends.filter((s) => s.user_id === userId);
    const subjectOf = new Map(batches.map((b) => [b.id, b.subject] as const));
    let events: EventRow[] = [];
    if (mine.length > 0) {
      const ids = mine.slice(0, 200).map((s) => s.id);
      events = await sbGet<EventRow>(
        `message_events?select=send_id,type,target,url,created_at` +
          `&send_id=in.(${ids.join(",")})&order=created_at.desc&limit=${MAX_EVENTS}`,
      ).catch(() => []);
    }
    detail = {
      sends: mine.map((s) => ({ ...s, subject: subjectOf.get(s.batch_id) ?? null })),
      events,
    };
  }

  return NextResponse.json({
    // Poori list nayi se purani — UI khud paginate karta hai.
    users: Array.from(byUser.values())
      .map((u) => ({ ...u, ...u.tally, tally: undefined }))
      .sort((a, b) => (a.last < b.last ? 1 : -1)),
    batches: batches.map((b) => ({
      id: b.id,
      subject: b.subject,
      body: b.body,
      channel: b.channel,
      audience: b.audience,
      total: b.total,
      createdAt: b.created_at,
      ...(byBatch.get(b.id) ?? emptyTally()),
    })),
    // UI ko batana zaroori hai ki purana data kat gaya hai ya nahi.
    truncated: sends.length >= MAX_SENDS,
    detail,
  });
}
