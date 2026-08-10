import { supabase } from "./supabase";

/**
 * Daam dikhane ka app-side hissa.
 *
 * ── Ek hi source ───────────────────────────────────────────────────────────
 * Google Play Console. Store se seedha (`product.priceString`) ya server ke
 * `play_prices` table se — dono me daam wahi ek hai.
 *
 * ⚠️ Yahan pehle ek doosra raasta bhi tha: `country_pricing` table se
 *    base_INR × multiplier × conversion_rate. Wo poora hata diya gaya. Wo
 *    number admin haath se bharta tha aur Play se hamesha thoda alag ho jaata
 *    — yaani screen ek daam dikhati aur Play doosra kaat leta. Ye sirf bharosa
 *    todne wali baat nahi, Play ki policy bhi yahi maangti hai ki jo dikhe
 *    wahi kate.
 *
 * Ye sab sirf DISPLAY hai. Asli charge Play user ke ACCOUNT wale desh se karta
 * hai — VPN/fake-GPS se sirf display badalta hai, paisa nahi (fraud-safe).
 */

/**
 * Aakhri sahara — jab store bhi na mile aur `play_prices` bhi khaali ho
 * (yaani sync ek baar bhi na chala ho). Admin se editable NAHI, jaan-boojh ke:
 * editable hote hi daam ke do maalik ban jaate hain.
 */
export const DEFAULT_PRICE = {
  monthlyLabel: "₹99",
  yearlyLabel: "₹999",
} as const;

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

/* --------------------------- Play Console ka daam --------------------------- */

/**
 * Play Console ka apna price — server ke `play_prices` table se.
 *
 * ── Ye kyun chahiye jab app Play se seedha price le leti hai ───────────────
 * Play Billing chalu ho to sabse accha price wahi hai jo store khud deta hai
 * (`product.priceString`) — wo user ke apne account-country ka hota hai. Par wo
 * TAB hi milta hai jab RevenueCat ka native module aur key dono maujood hon:
 * Expo Go me nahi, aur `PLAY_BILLING_ENABLED` off ho tab bhi nahi.
 *
 * Un halaton me daam phir bhi Play Console ka hi rehna chahiye, bas server ke
 * raaste. Website bhi bilkul yahi table padhti hai, isliye app aur website par
 * hamesha ek hi number dikhta hai.
 *
 * Tarteeb: store ka priceString → ye → DEFAULT_PRICE.
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
