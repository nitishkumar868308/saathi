import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Account delete requests — dekhna aur poora karna, dono yahin se.
 *
 * ⚠️ Pehle ye request `contact_messages` me ek prefix ke saath padi rehti thi.
 * Admin use sirf PADH sakta tha — na status, na koi action. Play Store ki
 * data-deletion shart ke liye request lena kaafi nahi hai; use poora karna bhi
 * padta hai, aur uska saboot rakhna bhi.
 *
 * Do raaste, jaan-boojh ke alag:
 *
 *   hide  (soft) — `profiles.deleted_at` set. Data DB me rehta hai par RLS use
 *                  user side par band kar deti hai. Wapas laaya ja sakta hai.
 *   purge (hard) — sab kuch sach me delete: storage ki files, har table ki rows,
 *                  aur aakhir me auth user. Wapas nahi aata.
 *
 * Hamesha hide pehle, purge baad me — user aksar do din baad wapas aa jaata hai,
 * aur purge ke baad uske paas kuch nahi bachta.
 */

/**
 * User ka data kahan-kahan pada hai.
 *
 * ⚠️ Ye list is poore feature ka dil hai. Ek bhi table chhoot gayi to "delete"
 * jhoot ban jaata hai — user ka data kahin na kahin pada rehta hai jabki hum
 * keh chuke hote hain ki hata diya. Nayi table jodo to ise bhi jodna.
 *
 * `label` admin ko dikhta hai, isliye technical naam nahi — wo cheez jo user
 * samajhta hai.
 */
const USER_TABLES: { table: string; col: string; label: string }[] = [
  { table: "documents", col: "user_id", label: "Documents" },
  { table: "reminders", col: "user_id", label: "Reminders" },
  { table: "notes", col: "user_id", label: "Notes" },
  { table: "messages", col: "user_id", label: "Saathi chat" },
  { table: "support_tickets", col: "user_id", label: "Support tickets" },
  { table: "reviews", col: "user_id", label: "Reviews" },
  { table: "payments", col: "user_id", label: "Payments" },
  { table: "user_details", col: "user_id", label: "Profile details" },
  { table: "device_tokens", col: "user_id", label: "Notification tokens" },
  { table: "device_users", col: "user_id", label: "Device logins" },
  { table: "analytics_events", col: "user_id", label: "Analytics events" },
  { table: "service_usage", col: "user_id", label: "AI / WhatsApp usage" },
  { table: "message_sends", col: "user_id", label: "Broadcast messages" },
  { table: "app_errors", col: "user_id", label: "Error logs" },
  // Phone verification ke bheje hue OTP ka hisaab (`supabase/phone-otp.sql`).
  // Isme user ka phone number hai, isliye purge me shaamil hona zaroori hai.
  { table: "phone_otp", col: "user_id", label: "SMS OTP history" },
  { table: "referrals", col: "referrer_id", label: "Referrals made" },
  { table: "referrals", col: "referee_id", label: "Referred by" },
  // Profile sabse aakhir me — baaki sab uske hisaab se dikhta hai.
  { table: "profiles", col: "id", label: "Profile" },
];

/** Documents ki asli files yahan padi hain (private bucket). */
const DOC_BUCKET = "documents";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * `user_id` / `id` body se aate hain aur seedha PostgREST ke URL me chipakte
 * hain — `profiles?id=eq.<uid>`, `documents?user_id=eq.<uid>`, aur (sabse
 * zaroori) DELETE wale filter me.
 *
 * ⚠️ Ye route service_role se chalta hai, yaani us request ke paas poora DB
 * hai. Guard peeche khada hai (sirf `deleteRequests` menu wala admin), par jo
 * request 20 table par DELETE chalati ho uske filter ko bina jaanche URL me
 * jodna theek nahi — ek `&` ya `,` filter ka matlab badal sakta hai, aur us
 * galti ko wapas nahi laaya ja sakta.
 *
 * Shakal ki jaanch sabse sasta taala hai: dono asli me UUID hain.
 */
function badId(v: string): boolean {
  return !UUID.test(v);
}

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Har handler ka pehla pehra — 401/403/503 ka response, ya null (sab theek). */
async function denied(): Promise<NextResponse | null> {
  const g = await guard("deleteRequests");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  return null;
}

/**
 * Ek table me is user ki kitni rows hain.
 *
 * `head=true` + `count=exact` se rows aati hi nahi, sirf ginti aati hai —
 * 5000 documents wale user par bhi ye halka rehta hai. Table hi na ho (koi SQL
 * file nahi chalayi) to `null`, taaki UI use "0" na dikha de: dono baaton me
 * bada fark hai.
 */
async function countRows(table: string, col: string, uid: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${uid}&select=${col}&limit=0`,
      { headers: headers({ Prefer: "count=exact" }), cache: "no-store" },
    );
    if (!res.ok) return null;
    // content-range: "0-0/42"
    const total = res.headers.get("content-range")?.split("/")[1];
    const n = Number(total);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Is user ki storage files (documents bucket me `<uid>/…`). */
async function listUserFiles(uid: string): Promise<string[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${DOC_BUCKET}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ prefix: `${uid}/`, limit: 1000 }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { name?: string }[];
    return rows.map((r) => `${uid}/${r.name}`).filter((p) => !p.endsWith("/"));
  } catch {
    return [];
  }
}

export async function GET() {
  const bad = await denied();
  if (bad) return bad;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/account_delete_requests?select=*&order=created_at.desc&limit=200`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const requests = (await res.json()) as { user_id: string | null }[];

    /**
     * Har pending request ke user ka profile — taaki admin ko dikhe ki account
     * abhi chalu hai ya pehle se hidden. Bina iske admin ko pata hi nahi chalta
     * ki uska pichhla "hide" laga bhi tha ya nahi.
     */
    const uids = Array.from(
      new Set(requests.map((r) => r.user_id).filter(Boolean) as string[]),
    );
    let profiles: Record<string, { deleted_at: string | null; email: string | null }> = {};
    if (uids.length > 0) {
      const pr = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${uids.join(",")})&select=id,email,deleted_at`,
        { headers: headers(), cache: "no-store" },
      );
      if (pr.ok) {
        const rows = (await pr.json()) as {
          id: string;
          email: string | null;
          deleted_at: string | null;
        }[];
        profiles = Object.fromEntries(
          rows.map((p) => [p.id, { deleted_at: p.deleted_at, email: p.email }]),
        );
      }
    }

    return NextResponse.json({ requests, profiles });
  } catch (err) {
    console.error("[admin/delete-requests GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}

/**
 * Ek user ka poora hisaab — kya-kya, kitna.
 *
 * Admin ko delete dabane se PEHLE ye dikhta hai. "42 documents, 130 reminders"
 * dekh kar wo soch samajh ke dabata hai; ek khaali "Delete" button par wo
 * bharosa nahi ho sakta.
 */
async function inventory(uid: string) {
  const items = await Promise.all(
    USER_TABLES.map(async (t) => ({
      ...t,
      count: await countRows(t.table, t.col, uid),
    })),
  );
  const files = await listUserFiles(uid);
  return { items, files: files.length };
}

export async function POST(request: Request) {
  const bad = await denied();
  if (bad) return bad;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const id = String(body.id ?? "").trim();
  const uid = String(body.user_id ?? "").trim();

  // Shakal pehle — dono aage URL filter me jaate hain (upar `badId` dekho).
  if (uid && badId(uid)) {
    return NextResponse.json({ error: "bad user_id" }, { status: 400 });
  }
  if (id && badId(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  try {
    /* ---- kya-kya delete hoga (sirf dikhane ke liye) ---- */
    if (action === "inventory") {
      if (!uid) return NextResponse.json({ error: "user_id chahiye" }, { status: 400 });
      return NextResponse.json(await inventory(uid));
    }

    /* ---- soft: user side band, data DB me safe ---- */
    if (action === "hide" || action === "unhide") {
      if (!uid) return NextResponse.json({ error: "user_id chahiye" }, { status: 400 });
      const deleted_at = action === "hide" ? new Date().toISOString() : null;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ deleted_at }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`profiles: ${res.status} ${await res.text()}`);

      if (id) await setStatus(id, action === "hide" ? "hidden" : "pending", null);
      return NextResponse.json({ ok: true });
    }

    /* ---- admin ne mana kiya ---- */
    if (action === "reject") {
      if (!id) return NextResponse.json({ error: "id chahiye" }, { status: 400 });
      await setStatus(id, "rejected", null, String(body.note ?? "") || null);
      return NextResponse.json({ ok: true });
    }

    /* ---- hard: sab kuch sach me mita do ---- */
    if (action === "purge") {
      if (!uid) return NextResponse.json({ error: "user_id chahiye" }, { status: 400 });

      const removed: Record<string, number> = {};

      // 1. Storage ki files. Rows se PEHLE — rows chali gayi to file ka rasta
      //    hi nahi bachta aur wo bucket me hamesha ke liye padi reh jaati hai.
      const files = await listUserFiles(uid);
      if (files.length > 0) {
        const del = await fetch(`${SUPABASE_URL}/storage/v1/object/${DOC_BUCKET}`, {
          method: "DELETE",
          headers: headers(),
          body: JSON.stringify({ prefixes: files }),
          cache: "no-store",
        });
        if (del.ok) removed["files"] = files.length;
      }

      // 2. Har table ki rows. Ginti pehle le lete hain — delete ke baad ginne
      //    ko kuch bachta hi nahi, aur `removed` hi ekmatra saboot hota hai.
      for (const t of USER_TABLES) {
        const before = await countRows(t.table, t.col, uid);
        if (before === null) continue; // table hi nahi hai — chhod do
        if (before === 0) continue;
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/${t.table}?${t.col}=eq.${uid}`,
          { method: "DELETE", headers: headers({ Prefer: "return=minimal" }), cache: "no-store" },
        );
        if (res.ok) removed[t.label] = (removed[t.label] ?? 0) + before;
      }

      // 3. Aakhir me auth user. Iske baad login ka koi raasta nahi bachta.
      const au = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
        method: "DELETE",
        headers: headers(),
        cache: "no-store",
      });
      removed["Login"] = au.ok ? 1 : 0;

      if (id) await setStatus(id, "deleted", removed);
      return NextResponse.json({ ok: true, removed });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[admin/delete-requests POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "action failed" },
      { status: 500 },
    );
  }
}

async function setStatus(
  id: string,
  status: string,
  removed: Record<string, number> | null,
  note?: string | null,
) {
  const patch: Record<string, unknown> = {
    status,
    handled_at: status === "pending" ? null : new Date().toISOString(),
  };
  if (removed) patch.removed = removed;
  if (note !== undefined) patch.note = note;

  await fetch(`${SUPABASE_URL}/rest/v1/account_delete_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
    cache: "no-store",
  });
}
