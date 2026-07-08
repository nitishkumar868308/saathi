import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import { adminGrantDays, RewardsNotConfigured } from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kisi user ko manually N din Saathi Plus do (email se). */
export async function POST(request: Request) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let email = "";
  let days = 0;
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim();
    days = Math.floor(Number(body?.days));
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  if (!Number.isFinite(days) || days === 0 || Math.abs(days) > 3650) {
    return NextResponse.json({ error: "days must be 1..3650" }, { status: 400 });
  }

  try {
    const result = await adminGrantDays(email, days);
    if (result === "user_not_found") {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[admin/grant]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "grant failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
