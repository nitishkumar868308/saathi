import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Admin analytics — app aur web dono ka safar.
 *
 * Do modes:
 *   GET /api/admin/analytics?days=14       → rozana ka summary + top screens/pages
 *   GET /api/admin/analytics?user=<uuid>   → us ek user ka poora journey
 *
 * `analytics_events` par koi select policy nahi hai (dekho
 * supabase/devices-analytics.sql), isliye padhna sirf service_role se hota hai —
 * yaani sirf isi server route se. Browser kabhi doosron ke events nahi padh sakta.
 */

function headers() {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function GET(request: Request) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const user = url.searchParams.get("user");
  const days = Number(url.searchParams.get("days") ?? 14);

  try {
    if (user) {
      const journey = await rpc<unknown[]>("admin_user_journey", {
        p_uid: user,
        p_limit: 300,
      });
      return NextResponse.json({ journey });
    }

    const summary = await rpc<Record<string, unknown>>("admin_analytics_summary", {
      p_days: Number.isFinite(days) && days > 0 ? days : 14,
    });
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[admin/analytics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}
