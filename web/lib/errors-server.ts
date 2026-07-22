/**
 * Web/server errors ko Supabase `app_errors` me daalta hai + admin ke liye
 * padhta hai. `supabase/error-logs.sql` chal chuka hona chahiye.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Server-side error record karo. Best-effort — kabhi throw nahi karta. */
export async function logServerError(
  err: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const e = err instanceof Error ? err : new Error(String(err));
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_errors`, {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        source: "web",
        level: "error",
        message: e.message.slice(0, 2000),
        stack: e.stack?.slice(0, 8000) ?? null,
        context,
        platform: "web",
      }),
      cache: "no-store",
    });
  } catch {
    /* best-effort */
  }
}

export type AppError = {
  id: string;
  source: string;
  level: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  platform: string | null;
  appVersion: string | null;
  createdAt: string;
  email: string | null;
  name: string | null;
};

/** Admin Logs list. */
export async function getErrors(opts: {
  since?: string;
  source?: string;
  limit?: number;
} = {}): Promise<AppError[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase env missing");
  const parts = [
    "select=id,user_id,source,level,message,stack,context,platform,app_version,created_at",
    "order=created_at.desc",
    `limit=${Math.min(opts.limit ?? 300, 1000)}`,
  ];
  if (opts.since) parts.push(`created_at=gte.${opts.since}`);
  if (opts.source && opts.source !== "all") parts.push(`source=eq.${opts.source}`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_errors?${parts.join("&")}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      /does not exist|schema cache/i.test(body)
        ? "app_errors table nahi mila — supabase/error-logs.sql run karo"
        : `errors read: ${res.status}`,
    );
  }
  const rows = (await res.json()) as Record<string, unknown>[];

  // user ka email/naam alag se (FK embed declared nahi).
  const ids = Array.from(
    new Set(rows.map((r) => String(r.user_id ?? "")).filter((x) => x && x !== "null")),
  );
  const prof = new Map<string, { email: string | null; name: string | null }>();
  if (ids.length) {
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,email,full_name&id=in.(${ids
        .map((i) => `"${i}"`)
        .join(",")})`,
      { headers: headers(), cache: "no-store" },
    );
    if (pr.ok) {
      for (const p of (await pr.json()) as Record<string, unknown>[]) {
        prof.set(String(p.id), {
          email: (p.email as string) ?? null,
          name: (p.full_name as string) ?? null,
        });
      }
    }
  }

  return rows.map((r) => {
    const p = prof.get(String(r.user_id ?? ""));
    return {
      id: String(r.id),
      source: String(r.source ?? "app"),
      level: String(r.level ?? "error"),
      message: String(r.message ?? ""),
      stack: (r.stack as string) ?? null,
      context: (r.context as Record<string, unknown>) ?? null,
      platform: (r.platform as string) ?? null,
      appVersion: (r.app_version as string) ?? null,
      createdAt: String(r.created_at),
      email: p?.email ?? null,
      name: p?.name ?? null,
    };
  });
}

/** Jo abhi tak mail nahi hue — digest ke liye. */
export async function getUnmailedErrors(limit = 50): Promise<AppError[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/app_errors?mailed_at=is.null&order=created_at.desc&limit=${limit}` +
      `&select=id,source,level,message,stack,context,platform,app_version,created_at`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    source: String(r.source ?? "app"),
    level: String(r.level ?? "error"),
    message: String(r.message ?? ""),
    stack: (r.stack as string) ?? null,
    context: (r.context as Record<string, unknown>) ?? null,
    platform: (r.platform as string) ?? null,
    appVersion: (r.app_version as string) ?? null,
    createdAt: String(r.created_at),
    email: null,
    name: null,
  }));
}

/** Mail ho gaya — dobara na jaye. */
export async function markErrorsMailed(ids: string[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY || !ids.length) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/app_errors?id=in.(${ids.map((i) => `"${i}"`).join(",")})`,
    {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ mailed_at: new Date().toISOString() }),
      cache: "no-store",
    },
  ).catch(() => {});
}
