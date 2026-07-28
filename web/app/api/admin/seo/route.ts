import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAuthed } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * SEO settings — admin panel se.
 *
 *   GET  → saare pages ki rows
 *   PUT  → ek page ki row save (upsert)
 *
 * Save hote hi `revalidateTag("seo")` chalta hai, isliye website ka meta turant
 * badal jaata hai — deploy ka intezaar nahi.
 */

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function guard() {
  if (!isAuthed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  return null;
}

export async function GET() {
  const bad = guard();
  if (bad) return bad;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/seo_pages?select=*&order=path.asc`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return NextResponse.json({ pages: await res.json() });
  } catch (err) {
    console.error("[admin/seo GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const bad = guard();
  if (bad) return bad;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const path = String(body.path ?? "").trim();
  if (!path.startsWith("/")) {
    return NextResponse.json({ error: "path must start with /" }, { status: 400 });
  }

  const str = (v: unknown) => {
    const t = typeof v === "string" ? v.trim() : "";
    return t ? t : null;
  };
  // Keywords comma-separated aate hain; khaali entries hata do.
  const keywords = Array.isArray(body.keywords)
    ? (body.keywords as unknown[]).map((k) => String(k).trim()).filter(Boolean)
    : null;

  const row = {
    path,
    title: str(body.title),
    description: str(body.description),
    keywords: keywords && keywords.length ? keywords : null,
    og_title: str(body.og_title),
    og_description: str(body.og_description),
    noindex: Boolean(body.noindex),
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/seo_pages?on_conflict=path`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify([row]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const saved = (await res.json()) as unknown[];

    // Website ka cached meta turant girao.
    revalidateTag("seo");

    return NextResponse.json({ page: saved[0] ?? row });
  } catch (err) {
    console.error("[admin/seo PUT]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}
