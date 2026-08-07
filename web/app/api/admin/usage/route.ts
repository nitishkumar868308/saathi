import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getUsage, getActivity, RewardsNotConfigured } from "@/lib/rewards-server";

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
  const g = await guard("usage");
  if (!g.ok) return g.res;
  const url = new URL(request.url);
  const range = rangeOf(url.searchParams.get("range") ?? "all");
  const uid = url.searchParams.get("uid") ?? undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 300, 1), 1000);
  // Ek user ka detail chahiye (See all modal) — usage table dobara laane ki zaroorat nahi.
  const activityOnly = url.searchParams.get("activityOnly") === "1";

  try {
    const [usage, activity] = await Promise.all([
      activityOnly ? Promise.resolve([]) : getUsage(range),
      getActivity({ ...range, uid, limit }).catch(() => []),
    ]);
    return NextResponse.json({ usage, activity });
  } catch (err) {
    console.error("[admin/usage]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
