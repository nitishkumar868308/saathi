import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getUsers, RewardsNotConfigured } from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard("users");
  if (!g.ok) return g.res;
  try {
    const users = await getUsers();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("[admin/users]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
