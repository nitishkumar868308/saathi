import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getErrors } from "@/lib/errors-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await guard("logs");
  if (!g.ok) return g.res;
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 7);
  const source = url.searchParams.get("source") ?? "all";
  const since =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() - days * 86400000).toISOString()
      : undefined;
  try {
    const errors = await getErrors({ since, source });
    return NextResponse.json({ errors });
  } catch (err) {
    console.error("[admin/errors]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}
