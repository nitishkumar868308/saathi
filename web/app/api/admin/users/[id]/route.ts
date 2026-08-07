import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getUserDetail, RewardsNotConfigured } from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard("users");
  if (!g.ok) return g.res;
  try {
    const detail = await getUserDetail(params.id);
    if (!detail) return NextResponse.json({ error: "user not found" }, { status: 404 });
    return NextResponse.json({ detail });
  } catch (err) {
    console.error("[admin/users/:id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
