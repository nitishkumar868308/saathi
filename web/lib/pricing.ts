/**
 * Country-wise price resolver (#11). Base INR (app_config) × multiplier ×
 * conversion_rate → local amount. Web SSR isse price dikhata hai.
 *
 * Charge Play Store account-country se hota hai — VPN/fake-GPS se sirf ye DISPLAY
 * badalta hai, asli charge nahi. Isliye ye purely display hai.
 */
import { getOffers } from "./offers";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type ResolvedPrice = {
  code: string;
  currency: string;
  symbol: string;
  monthly: number;
  yearly: number;
  isIndia: boolean;
};

type Row = {
  country_code: string;
  currency: string;
  symbol: string;
  conversion_rate: number;
  multiplier: number;
};

/** Saaf number: bade amount integer, chhote 1 decimal tak. */
export function roundPrice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 20 ? Math.round(n) : Math.round(n * 10) / 10;
}

export function formatPrice(symbol: string, n: number): string {
  return `${symbol}${n.toLocaleString("en-IN")}`;
}

/** India → Hinglish, baaki duniya → English (web copy). */
export function localeForCountry(code?: string): "hinglish" | "en" {
  return (code || "IN").toUpperCase() === "IN" ? "hinglish" : "en";
}

async function pricingRow(code: string): Promise<Row | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  /**
   * ⚠️ `code` seedha PUBLIC query se aata hai (`/api/pricing?country=…`) aur
   * neeche URL me chipak jaata hai. Bina jaanch ke `&`, `,` ya `.` daal kar
   * PostgREST ke apne filter/parameter jode ja sakte hain — service-role key ke
   * saath, yaani us request ke paas poora DB access hota hai.
   *
   * Country code ki shakal ISO2 hai aur bas. Jo us shakal ka nahi, wo hai hi
   * nahi — `null` lauta dena `resolvePrice` ko apne aap India/base par le jaata
   * hai (wahi jo unknown desh ke liye hota hai).
   */
  if (!/^[A-Z]{2}$/.test(code)) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/country_pricing?country_code=eq.${code}&enabled=eq.true` +
        `&select=country_code,currency,symbol,conversion_rate,multiplier`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        next: { revalidate: 30 },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Country code (IP se) → local price. Row na mile to India/base. */
export async function resolvePrice(countryCode?: string): Promise<ResolvedPrice> {
  const offers = await getOffers();
  const code = (countryCode || "IN").toUpperCase();
  const row = (await pricingRow(code)) ?? (await pricingRow("IN"));
  const mult = row?.multiplier ?? 1;
  const rate = row?.conversion_rate ?? 1;
  const finalCode = row?.country_code ?? "IN";
  return {
    code: finalCode,
    currency: row?.currency ?? "INR",
    symbol: row?.symbol ?? "₹",
    monthly: roundPrice(offers.plusPriceMonthly * mult * rate),
    yearly: roundPrice(offers.plusPriceYearly * mult * rate),
    isIndia: finalCode === "IN",
  };
}
