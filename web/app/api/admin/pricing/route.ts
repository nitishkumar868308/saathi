import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import {
  getCountryPricing,
  upsertCountryPricing,
  deleteCountryPricing,
  getConfig,
  setConfig,
  RewardsNotConfigured,
  type CountryPricingRow,
} from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guard() {
  return isAuthed() ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function errRes(err: unknown) {
  console.error("[admin/pricing]", err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "failed" },
    { status: err instanceof RewardsNotConfigured ? 503 : 500 },
  );
}

export async function GET() {
  const bad = guard();
  if (bad) return bad;
  try {
    const [rows, config] = await Promise.all([getCountryPricing(), getConfig()]);
    return NextResponse.json({
      rows,
      base: {
        monthly: Number(config.plus_price_monthly ?? 99),
        yearly: Number(config.plus_price_yearly ?? 999),
      },
    });
  } catch (err) {
    return errRes(err);
  }
}

/** Rows upsert + optional base price update. */
export async function PUT(request: Request) {
  const bad = guard();
  if (bad) return bad;

  let body: { rows?: unknown; base?: { monthly?: unknown; yearly?: unknown } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    if (body.base) {
      const patch: Record<string, number> = {};
      const m = Number(body.base.monthly);
      const y = Number(body.base.yearly);
      if (Number.isFinite(m) && m > 0) patch.plus_price_monthly = Math.floor(m);
      if (Number.isFinite(y) && y > 0) patch.plus_price_yearly = Math.floor(y);
      if (Object.keys(patch).length) await setConfig(patch);
    }

    if (Array.isArray(body.rows)) {
      const rows: CountryPricingRow[] = [];
      for (const raw of body.rows as Record<string, unknown>[]) {
        const code = String(raw.country_code ?? "").toUpperCase();
        if (!/^[A-Z]{2}$/.test(code)) continue;
        rows.push({
          country_code: code,
          country_name: String(raw.country_name ?? code),
          currency: String(raw.currency ?? "INR"),
          symbol: String(raw.symbol ?? "₹"),
          conversion_rate: Math.max(0, Number(raw.conversion_rate ?? 1)) || 1,
          multiplier: Math.max(0, Number(raw.multiplier ?? 1)) || 1,
          enabled: Boolean(raw.enabled),
        });
      }
      if (rows.length) await upsertCountryPricing(rows);
    }

    const rows = await getCountryPricing();
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return errRes(err);
  }
}

export async function DELETE(request: Request) {
  const bad = guard();
  if (bad) return bad;
  const code = new URL(request.url).searchParams.get("code") ?? "";
  try {
    await deleteCountryPricing(code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errRes(err);
  }
}
