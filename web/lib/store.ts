import { promises as fs } from "fs";
import path from "path";

/**
 * Data store — Supabase (asli DB) ya local file, dono support.
 *
 * Agar env mein SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set hain to
 * sab kuch Supabase DB mein jaata hai. Warna local `data/*.json` file
 * fallback use hoti hai (dev ke liye).
 *
 * Tables (Supabase SQL Editor mein `supabase/landing.sql` run karo):
 *   waitlist(id, email unique, created_at)
 *   contact_messages(id, name, email, message, created_at)
 */

type WaitlistEntry = { email: string; createdAt: string };
type ContactEntry = {
  name: string;
  email: string;
  message: string;
  createdAt: string;
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: sbHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase select failed: ${res.status}`);
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

/**
 * Waitlist mein email add karo (dedup ke saath).
 * Returns { added, count }. added=false → email pehle se maujood.
 */
export async function addToWaitlist(
  email: string,
  createdAt: string,
): Promise<{ added: boolean; count: number }> {
  const normalized = email.trim().toLowerCase();

  if (usingSupabase()) {
    const { inserted } = await sbInsert(
      "waitlist",
      { email: normalized, created_at: createdAt },
      "email",
    );
    const count = await sbCount("waitlist");
    return { added: inserted, count };
  }

  // File fallback
  const list = await readJson<WaitlistEntry[]>("waitlist.json", []);
  if (list.some((e) => e.email === normalized)) {
    return { added: false, count: list.length };
  }
  list.push({ email: normalized, createdAt });
  await writeJson("waitlist.json", list);
  return { added: true, count: list.length };
}

export async function getWaitlistCount(): Promise<number> {
  if (usingSupabase()) return sbCount("waitlist");
  const list = await readJson<WaitlistEntry[]>("waitlist.json", []);
  return list.length;
}

/** Admin — poori waitlist, newest pehle. */
export async function getWaitlist(): Promise<WaitlistEntry[]> {
  if (usingSupabase()) {
    const rows = await sbSelect<{ email: string; created_at: string }>(
      "waitlist?select=email,created_at&order=created_at.desc",
    );
    return rows.map((r) => ({ email: r.email, createdAt: r.created_at }));
  }
  const list = await readJson<WaitlistEntry[]>("waitlist.json", []);
  return [...list].reverse();
}

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

/** Admin — saare contact messages, newest pehle. */
export async function getContacts(): Promise<ContactEntry[]> {
  if (usingSupabase()) {
    const rows = await sbSelect<{
      name: string;
      email: string;
      message: string;
      created_at: string;
    }>(
      "contact_messages?select=name,email,message,created_at&order=created_at.desc",
    );
    return rows.map((r) => ({
      name: r.name,
      email: r.email,
      message: r.message,
      createdAt: r.created_at,
    }));
  }
  const list = await readJson<ContactEntry[]>("contacts.json", []);
  return [...list].reverse();
}
