import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getDocuments, RewardsNotConfigured } from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const g = await guard("documents");
  if (!g.ok) return g.res;
  const url = new URL(request.url);
  const range = rangeOf(url.searchParams.get("range") ?? "all");

  try {
    const data = await getDocuments(range);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/documents]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
