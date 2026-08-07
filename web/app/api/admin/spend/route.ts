import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * AI + WhatsApp + email ka istemaal — admin ke "AI & WhatsApp" tab ke liye
 * (item 3).
 *
 * Ye `admin/usage` se alag sawaal hai. Wo batata hai KAUN user kitna active
 * hai; ye batata hai HUMARA kitna kharcha ho raha hai — Gemini ko kitne token
 * gaye, Twilio se kitne WhatsApp nikle, SMTP se kitne email.
 *
 * Data `service_usage` table se aata hai (supabase/service-usage.sql).
 */

export type SpendRow = {
  service: string;
  kind: string;
  calls: number;
  units: number;
  failures: number;
  last_at: string | null;
};

export type SpendDay = {
  day: string;
  service: string;
  calls: number;
  units: number;
};

/** "today" | "yesterday" | "7" | "30" | "all" -> ISO range */
function rangeOf(key: string): { from?: string; to?: string } {
  const day = 86400000;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  switch (key) {
    case "today":
      return { from: start.toISOString() };
    case "yesterday":
      return {
        from: new Date(start.getTime() - day).toISOString(),
        to: start.toISOString(),
      };
    case "7":
      return { from: new Date(start.getTime() - 6 * day).toISOString() };
    case "30":
      return { from: new Date(start.getTime() - 29 * day).toISOString() };
    default:
      return {};
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY as string,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404 || /does not exist|schema cache/i.test(body)) {
      throw new Error(
        `${fn}: function nahi mili. Supabase me 'supabase/service-usage.sql' run kiya?`,
      );
    }
    throw new Error(`${fn} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T[];
}

export async function GET(request: Request) {
  const g = await guard("spend");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const { from, to } = rangeOf(url.searchParams.get("range") ?? "30");

  try {
    const [totals, daily] = await Promise.all([
      rpc<SpendRow>("admin_service_usage", { p_from: from ?? null, p_to: to ?? null }),
      rpc<SpendDay>("admin_service_usage_daily", { p_days: 30 }).catch(() => []),
    ]);
    return NextResponse.json({ totals, daily });
  } catch (err) {
    console.error("[admin/spend]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}
