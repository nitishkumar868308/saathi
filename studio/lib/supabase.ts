/**
 * Supabase — **sirf server par**, service role key ke saath.
 *
 * ⚠️ `reel_*` tables par RLS on hai aur ek bhi policy nahi (dekho
 * `supabase/reel-studio.sql` section 8). Matlab anon key ke liye ye tables
 * maujood hi nahi hain. Sirf service_role RLS ko bypass karta hai — isliye har
 * DB call server-side route handler se hi jaati hai.
 *
 * Isi wajah se `SUPABASE_SERVICE_ROLE_KEY` par kabhi `NEXT_PUBLIC_` nahi lagega:
 * wo browser me chali jaayegi aur poori deewar bekaar ho jaayegi. Neeche ka
 * `assertServer()` isi galti ko compile ke baad bhi pakadta hai.
 *
 * `@supabase/supabase-js` jaan-boojhkar nahi liya — repo me server-side ka
 * tarika pehle se seedha PostgREST fetch hai (`web/lib/store.ts`,
 * `worker/scripts/db-verify.ts`). Ek hi tarika, ek hi jagah samajhne layak.
 */

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "lib/supabase.ts sirf server par chalti hai — service role key browser me kabhi nahi jaani chahiye",
    );
  }
}

export function supabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
}

function serviceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && serviceKey());
}

export class SupabaseError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "SupabaseError";
    this.status = status;
    this.body = body;
  }
}

export interface RestOptions {
  /** `Prefer` header — `return=representation`, `count=exact`… */
  prefer?: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * PostgREST par ek call. `path` table + query hota hai, e.g.
 * `reel_projects?select=id,name&order=updated_at.desc`.
 */
export async function rest(path: string, options: RestOptions = {}): Promise<Response> {
  assertServer();
  if (!supabaseConfigured()) {
    throw new SupabaseError(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY set nahi hai (studio/.env.local dekho)",
      500,
      "",
    );
  }

  const key = serviceKey();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (options.prefer) headers.Prefer = options.prefer;

  return fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal ? { signal: options.signal } : {}),
    // Editor ka data kabhi cache se nahi aana chahiye — Next fetch ko default
    // par cache karne ki aadat hai aur wo yahan seedha "purana project" dikhata.
    cache: "no-store",
  });
}

/** `rest()` + JSON parse + saaf error. Rows ki list lautata hai. */
export async function restJson<T>(path: string, options: RestOptions = {}): Promise<T[]> {
  const response = await rest(path, options);
  const text = await response.text();

  if (!response.ok) {
    throw new SupabaseError(
      `Supabase ${options.method ?? "GET"} ${path} -> ${response.status}`,
      response.status,
      text,
    );
  }
  if (!text) return [];
  return JSON.parse(text) as T[];
}

/** Ek hi row chahiye. Na mile to `null` — 404 ka faisla caller karta hai. */
export async function restOne<T>(path: string, options: RestOptions = {}): Promise<T | null> {
  const rows = await restJson<T>(path, options);
  return rows[0] ?? null;
}
