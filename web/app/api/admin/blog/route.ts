import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Blog posts — admin panel se likhi/badli jaati hain.
 *
 *   GET    → saari posts (draft bhi, kyunki ye service_role se padhta hai)
 *   PUT    → ek post save (upsert on slug)
 *   DELETE → ?slug=… post hatao
 *
 * Har badlaav ke baad `revalidateTag("blog")` — website ka blog, sitemap aur
 * post page turant taaza ho jaate hain.
 */

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
  const g = await guard("blog");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  return null;
}

export async function GET() {
  const bad = await denied();
  if (bad) return bad;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_posts?select=*&order=published_at.desc`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return NextResponse.json({ posts: await res.json() });
  } catch (err) {
    console.error("[admin/blog GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}

/** "my post title" -> "my-post-title" (URL me yahi dikhega). */
function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export async function PUT(request: Request) {
  const bad = await denied();
  if (bad) return bad;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const slug = slugify(String(body.slug ?? "") || title);
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  // Sections: [{ h, p: string[] }]. UI se paragraphs ek textarea me aate hain
  // (khaali line = naya paragraph), isliye yahan bhi string chal jaati hai.
  const sections = Array.isArray(body.sections)
    ? (body.sections as { h?: unknown; p?: unknown }[])
        .map((s) => ({
          h: String(s.h ?? "").trim(),
          p: Array.isArray(s.p)
            ? (s.p as unknown[]).map((x) => String(x).trim()).filter(Boolean)
            : String(s.p ?? "")
                .split(/\n{2,}/)
                .map((x) => x.trim())
                .filter(Boolean),
        }))
        .filter((s) => s.h || s.p.length)
    : [];

  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean)
    : [];

  const row = {
    slug,
    title,
    description: String(body.description ?? "").trim(),
    heading: String(body.heading ?? "").trim() || title,
    intro: String(body.intro ?? "").trim(),
    sections,
    tags,
    reading_minutes: Number(body.reading_minutes) || 4,
    is_published: body.is_published !== false,
    published_at:
      String(body.published_at ?? "").trim() || new Date().toISOString().slice(0, 10),
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?on_conflict=slug`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify([row]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const saved = (await res.json()) as unknown[];
    revalidateTag("blog");
    return NextResponse.json({ post: saved[0] ?? row });
  } catch (err) {
    console.error("[admin/blog PUT]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const bad = await denied();
  if (bad) return bad;

  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}`,
      { method: "DELETE", headers: headers({ Prefer: "return=minimal" }), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    revalidateTag("blog");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/blog DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}
