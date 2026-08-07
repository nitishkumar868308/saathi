import { promises as fs } from "fs";
import path from "path";

/**
 * Data store — Supabase (asli DB) ya local file, dono support.
 *
 * Agar env mein SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set hain to
 * sab kuch Supabase DB mein jaata hai. Warna local `data/*.json` file
 * fallback use hoti hai (dev ke liye).
 *
 * Tables:
 *   contact_messages(id, name, email, message, created_at)
 *
 * NOTE: waitlist aur launch offer dono hata diye gaye — ab sirf referral se
 * Plus milta hai (dekho supabase/rewards-referrals.sql).
 */

type ContactEntry = {
  /** File-store wale fallback me nahi hota (wahan reply bhi nahi ho sakta). */
  id?: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  repliedAt?: string | null;
  replyBody?: string | null;
  repliedBy?: string | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function usingSupabase(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/* -------------------------- Supabase REST -------------------------- */

function sbHeaders(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sbInsert(
  table: string,
  row: Record<string, unknown>,
  onConflict?: string,
): Promise<{ inserted: boolean }> {
  // onConflict diya ho to upsert-style ignore-duplicates (unique column pe).
  const url = onConflict
    ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`
    : `${SUPABASE_URL}/rest/v1/${table}`;

  const res = await fetch(url, {
    method: "POST",
    headers: sbHeaders({
      Prefer: onConflict
        ? "resolution=ignore-duplicates,return=representation"
        : "return=representation",
    }),
    body: JSON.stringify([row]),
    cache: "no-store",
  });

  // Duplicate (unique violation) — error nahi, bas "pehle se hai".
  if (res.status === 409) {
    return { inserted: false };
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`supabase insert ${table} failed: ${res.status} ${txt}`);
  }
  const data = (await res.json()) as unknown[];
  return { inserted: Array.isArray(data) && data.length > 0 };
}

async function sbCount(table: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
    method: "HEAD",
    headers: sbHeaders({ Prefer: "count=exact" }),
    cache: "no-store",
  });
  const range = res.headers.get("content-range"); // e.g. "*/42"
  const total = range ? Number(range.split("/")[1]) : 0;
  return Number.isFinite(total) ? total : 0;
}

async function sbSelect<T>(query: string): Promise<T[]> {
  const rows = await sbTrySelect<T>(query);
  if (!rows) throw new Error(`supabase select failed: ${query.split("?")[0]}`);
  return rows;
}

/** Wahi select, par fail par `null` — throw nahi. */
async function sbTrySelect<T>(query: string): Promise<T[] | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: sbHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as T[];
}

/* ---------------------------- File store --------------------------- */

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(DATA_DIR, file),
    JSON.stringify(data, null, 2),
    "utf8",
  );
}

/* --------------------------- Public API ---------------------------- */

export async function addContactMessage(entry: ContactEntry): Promise<void> {
  const normalized = entry.email.trim().toLowerCase();

  if (usingSupabase()) {
    await sbInsert("contact_messages", {
      name: entry.name,
      email: normalized,
      message: entry.message,
      created_at: entry.createdAt,
    });
    return;
  }

  const list = await readJson<ContactEntry[]>("contacts.json", []);
  list.push({ ...entry, email: normalized });
  await writeJson("contacts.json", list);
}

/**
 * Admin — saare contact messages, newest pehle.
 *
 * ⚠️ Reply wale teen column (`replied_at` / `reply_body` / `replied_by`) tabhi
 * hote hain jab `supabase/contact-reply.sql` chalayi ja chuki ho. Wo na ho to
 * Supabase poore select ko 400 de deta hai — aur pehle uska matlab tha ki
 * Contacts ki poori screen hi tooti hui dikhti (jabki wo screen mahino se chal
 * rahi thi). Isliye ek baar bina un columns ke bhi maang lete hain: purana
 * panel chalta rehta hai, bas "jawab diya" ka nishaan nahi dikhta.
 */
export async function getContacts(): Promise<ContactEntry[]> {
  if (usingSupabase()) {
    const full = await sbTrySelect<{
      id: string;
      name: string;
      email: string;
      message: string;
      created_at: string;
      replied_at: string | null;
      reply_body: string | null;
      replied_by: string | null;
    }>(
      "contact_messages?select=id,name,email,message,created_at,replied_at,reply_body,replied_by&order=created_at.desc",
    );

    const rows =
      full ??
      (
        await sbSelect<{ id: string; name: string; email: string; message: string; created_at: string }>(
          "contact_messages?select=id,name,email,message,created_at&order=created_at.desc",
        )
      ).map((r) => ({ ...r, replied_at: null, reply_body: null, replied_by: null }));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      message: r.message,
      createdAt: r.created_at,
      repliedAt: r.replied_at,
      replyBody: r.reply_body,
      repliedBy: r.replied_by,
    }));
  }
  const list = await readJson<ContactEntry[]>("contacts.json", []);
  return [...list].reverse();
}

/** Ek message — jawab bhejne se pehle uska asli text yahin se aata hai. */
export async function getContactById(id: string): Promise<ContactEntry | null> {
  if (!usingSupabase()) return null;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return null;
  const rows = await sbTrySelect<{
    id: string;
    name: string;
    email: string;
    message: string;
    created_at: string;
  }>(`contact_messages?select=id,name,email,message,created_at&id=eq.${id}`);
  const r = rows?.[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    message: r.message,
    createdAt: r.created_at,
  };
}

/**
 * Kya `supabase/contact-reply.sql` chal chuki hai?
 *
 * ⚠️ Ye jaanch email BHEJNE SE PEHLE hoti hai. Bina iske hota ye: mail user ke
 * paas chala jaata, aur uske baad "replied" ka nishaan lagane wali query chup
 * chaap fail ho jaati — yaani admin ko wo message hamesha "jawab baaki hai" me
 * dikhta rehta aur wo wahi jawab dobara-tibara bhejta rehta.
 */
export async function contactReplyReady(): Promise<boolean> {
  if (!usingSupabase()) return false;
  return (await sbTrySelect("contact_messages?select=replied_at&limit=1")) !== null;
}

/**
 * Jawab ka nishaan lagao.
 *
 * ⚠️ Ye email BHEJNE ke baad chalta hai, pehle nahi. Ulta karne par SMTP fail
 * hone par message "jawab diya gaya" dikhta rehta aur user ko kuch milta hi
 * nahi — aur admin ko kabhi pata na chalta.
 */
export async function markContactReplied(
  id: string,
  reply: string,
  by: string,
): Promise<boolean> {
  if (!usingSupabase()) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages?id=eq.${id}`, {
    method: "PATCH",
    headers: sbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      replied_at: new Date().toISOString(),
      reply_body: reply,
      replied_by: by,
    }),
    cache: "no-store",
  });
  return res.ok;
}
