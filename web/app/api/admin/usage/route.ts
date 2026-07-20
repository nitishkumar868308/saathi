import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import { getUsage, RewardsNotConfigured } from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const usage = await getUsage();
    return NextResponse.json({ usage });
  } catch (err) {
    console.error("[admin/usage]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
