import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import {
  getConfig,
  setConfig,
  getRewardStats,
  RewardsNotConfigured,
  CONFIG_KEYS,
  type ConfigMap,
} from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const [config, stats] = await Promise.all([getConfig(), getRewardStats()]);
    return NextResponse.json({ config, stats });
  } catch (err) {
    console.error("[admin/config] GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}

export async function PUT(request: Request) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Sirf known keys, sahi type ke saath.
  const patch: Partial<ConfigMap> = {};
  for (const key of CONFIG_KEYS) {
    const v = body[key];
    if (v === undefined) continue;
    if (key.endsWith("_enabled")) {
      patch[key] = Boolean(v);
    } else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `invalid ${key}` }, { status: 400 });
      }
      patch[key] = Math.floor(n);
    }
  }

  try {
    await setConfig(patch);
    const config = await getConfig();
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    console.error("[admin/config] PUT", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "write failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
