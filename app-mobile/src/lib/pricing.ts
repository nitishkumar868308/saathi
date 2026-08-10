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

/* --------------------------- Play Console ka daam --------------------------- */

/**
 * Play Console ka apna price — `play_prices` table se.
 *
 * ── Ye kyun chahiye jab app Play se seedha price le leti hai ───────────────
 * Play Billing chalu ho to sabse accha price wahi hai jo store khud deta hai
 * (`product.priceString`) — wo user ke apne account-country ka hota hai. Par wo
 * TAB hi milta hai jab RevenueCat ka native module aur key dono maujood hon:
 * Expo Go me nahi, aur `PLAY_BILLING_ENABLED` off ho tab bhi nahi.
 *
 * Un halaton me pehle app purane manual hisaab (base × multiplier × rate) par
 * gir jaati thi — aur wo number Play Console se hamesha thoda alag hota hai.
 * Ye table beech ka sahi kadam hai: daam phir bhi Play Console ka hi rehta hai,
 * bas server ke raaste aata hai. Website bhi bilkul yahi padhti hai, isliye
 * app aur website par ek hi number dikhta hai.
 *
 * Tarteeb: store ka priceString → ye → manual hisaab.
 */
export type PlayPrices = {
  monthly: string | null;
  yearly: string | null;
};

type PlayRow = {
  product_id: string;
  region_currency: string;
  amount_micros: number | string;
  billing_period: string | null;
};

/**
 * micros → "₹99" / "$1.99". Decimal tabhi jab sach me hon.
 *
 * Locale `en-<REGION>` hai, sirf "en-IN" nahi: en-IN 100000 ko "1,00,000"
 * likhta hai (lakh wali ginti) jo India ke liye theek aur America ke liye galat
 * hai. Bhasha English hi rehti hai, bas ginti sahi jagah tootiti hai.
 */
function formatMicros(currency: string, micros: number, region: string): string {
  const amount = micros / 1_000_000;
  const whole = micros % 1_000_000 === 0;
  try {
    return new Intl.NumberFormat(`en-${region}`, {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(amount);
  } catch {
    // Kisi purane device par Intl ka currency hissa na ho to bhi number sahi
    // dikhna chahiye — sirf symbol ki jagah code aa jayega.
    return `${currency} ${amount}`;
  }
}

/** Row monthly hai ya yearly. Play ka apna `billing_period` sabse bharosemand. */
function periodOf(r: PlayRow): "monthly" | "yearly" | null {
  const p = String(r.billing_period ?? "").toUpperCase();
  if (p === "P1Y" || p === "P12M") return "yearly";
  if (p === "P1M") return "monthly";
  if (r.product_id.includes("yearly")) return "yearly";
  if (r.product_id.includes("monthly")) return "monthly";
  return null;
}

/**
 * Ek desh ke Play daam. Table na ho, sync na chala ho, ya us desh ka price na
 * ho to `null` — caller purane hisaab par gir jaata hai.
 */
export async function getPlayPrices(code: string): Promise<PlayPrices | null> {
  const region = code.toUpperCase();
  if (!supabase || !/^[A-Z]{2}$/.test(region)) return null;
  try {
    const { data, error } = await supabase
      .from("play_prices")
      .select("product_id,region_currency,amount_micros,billing_period")
      .eq("region_code", region);
    if (error || !data?.length) return null;

    const out: PlayPrices = { monthly: null, yearly: null };
    for (const raw of data as PlayRow[]) {
      const period = periodOf(raw);
      const micros = Number(raw.amount_micros);
      if (!period || out[period] || !Number.isFinite(micros)) continue;
      out[period] = formatMicros(String(raw.region_currency).toUpperCase(), micros, region);
    }
    return out.monthly || out.yearly ? out : null;
  } catch {
    return null;
  }
}
