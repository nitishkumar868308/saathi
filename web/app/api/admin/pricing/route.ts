import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import {
  getCountryPricing,
  upsertCountryPricing,
  deleteCountryPricing,
  getCountriesList,
  getConfig,
  setConfig,
  RewardsNotConfigured,
  type CountryPricingRow,
} from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Har handler ka pehla pehra — 401/403 ka response, ya null (sab theek). */
async function denied(): Promise<NextResponse | null> {
  const g = await guard("pricing");
  return g.ok ? null : g.res;
}

function errRes(err: unknown) {
  console.error("[admin/pricing]", err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "failed" },
    { status: err instanceof RewardsNotConfigured ? 503 : 500 },
  );
}

export async function GET() {
  const bad = await denied();
  if (bad) return bad;
  try {
    const [rows, config, countries] = await Promise.all([
      getCountryPricing(),
      getConfig(),
      getCountriesList().catch(() => []),
    ]);
    return NextResponse.json({
      rows,
      countries,
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
  const bad = await denied();
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
      // Saare field MANDATORY — koi khaali/invalid ho to poora save reject.
      for (const raw of body.rows as Record<string, unknown>[]) {
        const code = String(raw.country_code ?? "").toUpperCase();
        const name = String(raw.country_name ?? "").trim();
        const currency = String(raw.currency ?? "").trim().toUpperCase();
        const symbol = String(raw.symbol ?? "").trim();
        const rate = Number(raw.conversion_rate);
        const mult = Number(raw.multiplier);
        if (!/^[A-Z]{2,3}$/.test(code) || !name || !currency || !symbol) {
          return NextResponse.json(
            { error: `${code || "?"}: country, currency, symbol — sab bharo` },
            { status: 400 },
          );
        }
        if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(mult) || mult <= 0) {
          return NextResponse.json(
            { error: `${code}: conversion rate aur multiplier 0 se bade hone chahiye` },
            { status: 400 },
          );
        }
        rows.push({
          country_code: code,
          country_name: name,
          currency,
          symbol,
          conversion_rate: rate,
          multiplier: mult,
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
  const bad = await denied();
  if (bad) return bad;
  const code = new URL(request.url).searchParams.get("code") ?? "";
  try {
    await deleteCountryPricing(code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errRes(err);
  }
}
