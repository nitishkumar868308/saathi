import { supabase } from "./supabase";

/**
 * Country-wise pricing (#11) — app side.
 * IP se country pata karo, uska pricing row (public read) lo, aur local price
 * banao: base_INR × multiplier × conversion_rate.
 *
 * Ye sirf DISPLAY hai. Actual charge Google Play user ke account-country se hota
 * hai — VPN/fake-GPS se sirf display badalta hai, asli paisa nahi (fraud-safe).
 */

export type LocalPricing = {
  code: string;
  currency: string;
  symbol: string;
  multiplier: number;
  rate: number;
};

const IP_API = "https://ipapi.co/json/";

/** IP se ISO2 country code (jaise "IN"). Fail ho to null. */
export async function detectCountry(): Promise<string | null> {
  try {
    const res = await fetch(IP_API);
    if (!res.ok) return null;
    const j = (await res.json()) as { country_code?: string; country?: string };
    const code = String(j.country_code || j.country || "").toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** Ek country ka pricing row (enabled). Na mile to null. */
export async function getPricingRow(code: string): Promise<LocalPricing | null> {
  if (!supabase || !code) return null;
  try {
    const { data, error } = await supabase
      .from("country_pricing")
      .select("country_code,currency,symbol,conversion_rate,multiplier")
      .eq("country_code", code.toUpperCase())
      .eq("enabled", true)
      .maybeSingle();
    if (error || !data) return null;
    return {
      code: data.country_code,
      currency: data.currency,
      symbol: data.symbol,
      multiplier: Number(data.multiplier) || 1,
      rate: Number(data.conversion_rate) || 1,
    };
  } catch {
    return null;
  }
}

/** base (INR) → local amount. Row na ho to base hi (₹). */
export function localAmount(baseInr: number, p: LocalPricing | null): number {
  if (!p) return Math.round(baseInr);
  const n = baseInr * p.multiplier * p.rate;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 20 ? Math.round(n) : Math.round(n * 10) / 10;
}
