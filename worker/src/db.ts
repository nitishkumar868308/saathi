/**
 * Supabase se baat karne ka ekmatra raasta (worker ke liye).
 *
 * ⚠️ `@supabase/supabase-js` jaan-boojhkar nahi liya — poore repo me server-side
 * ka tarika seedha PostgREST fetch hai (`web/lib/store.ts`, `studio/lib/supabase.ts`,
 * `worker/scripts/db-verify.ts`). Ek hi tarika, ek hi jagah samajhne layak.
 *
 * Yahan service-role key chalti hai. Worker tumhare PC par chalta hai aur kabhi
 * browser me nahi jaata, isliye ye surakshit hai — par isi wajah se is file ka
 * koi bhi hissa studio ke client bundle me kabhi nahi jaana chahiye.
 */

export interface DbConn {
  url: string;
  serviceKey: string;
}

export class DbError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    context: string,
  ) {
    super(`${context}: HTTP ${status} ${body.slice(0, 300)}`);
    this.name = "DbError";
  }
}

export function readDbConn(): DbConn {
  const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL aur SUPABASE_SERVICE_ROLE_KEY dono chahiye. " +
        "worker/.env me bharo (dekho studio/.env.local.example).",
    );
  }
  return { url, serviceKey };
}

async function request(
  conn: DbConn,
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<unknown> {
  const headers: Record<string, string> = {
    apikey: conn.serviceKey,
    authorization: `Bearer ${conn.serviceKey}`,
    "content-type": "application/json",
  };
  if (init.prefer) headers.prefer = init.prefer;

  const response = await fetch(`${conn.url}/rest/v1${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const text = await response.text();
  if (!response.ok) throw new DbError(response.status, text, `${init.method ?? "GET"} ${path}`);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function select(conn: DbConn, path: string): Promise<unknown> {
  return request(conn, path);
}

export function patch(conn: DbConn, path: string, body: unknown): Promise<unknown> {
  return request(conn, path, { method: "PATCH", body, prefer: "return=representation" });
}

export function upsert(conn: DbConn, path: string, body: unknown): Promise<unknown> {
  return request(conn, path, {
    method: "POST",
    body,
    prefer: "resolution=merge-duplicates,return=representation",
  });
}

/** `reel_claim_render_job` jaisi SQL function bulao. */
export function rpc(conn: DbConn, name: string, args: unknown = {}): Promise<unknown> {
  return request(conn, `/rpc/${name}`, { method: "POST", body: args });
}

export function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

/* --------------------------------------------------------------- job row */

export interface RenderJobRow {
  id: string;
  project_id: string;
  doc: unknown;
  preset: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  error: string | null;
  output_r2_key: string | null;
  output_thumb_key: string | null;
  output_bytes: number | null;
  duration_ms: number | null;
  worker_id: string | null;
  attempts: number;
  max_attempts: number;
  meta: Record<string, unknown>;
}

export function asJob(value: unknown): RenderJobRow | null {
  const list = rows(value);
  const first = list[0];
  return first ? (first as unknown as RenderJobRow) : null;
}
