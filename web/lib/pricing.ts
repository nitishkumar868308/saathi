/**
 * "Is user ko kaunsa daam dikhana hai" — ek hi jagah ka jawab.
 *
 * ── Do source, saaf tarteeb ────────────────────────────────────────────────
 * 1. **Play** (`play_prices`) — Google Play Console ka apna price, us desh ka.
 *    Yahi asli sach hai, kyunki paisa Play hi kaatta hai.
 * 2. **Manual** (`country_pricing`) — purana base × multiplier × conversion_rate
 *    wala hisaab, FALLBACK ke taur par. Ye tab kaam aata hai jab Play API set
 *    na ho, sync abhi chala na ho, ya us desh ka price Play par na ho.
 *
 * ⚠️ Tarteeb kabhi ulti mat karna. Manual number admin haath se bharta hai aur
 *    wo Play se hamesha thoda alag ho jaata hai (conversion rate roz badalti
 *    hai). Us halat me website ek daam dikhaati hai aur Play doosra kaatta hai
 *    — user ka bharosa to jaata hi hai, Play ki policy bhi yahi maangti hai ki
 *    jo dikhe wahi kate.
 *
 * Ye poora hissa sirf DISPLAY ke liye hai. Asli charge Play user ke ACCOUNT wale
 * desh se karta hai — VPN se sirf ye display badalta hai, paisa nahi (isliye
 * IP par bharosa karna yahan surakshit hai).
 */
import { getOffers } from "./offers";
import {
  formatMicros,
  getPlayPricesForRegion,
  microsToAmount,
  symbolFor,
} from "./play-prices";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type PriceSource = "play" | "manual";

export type ResolvedPrice = {
  code: string;
  currency: string;
  symbol: string;
  monthly: number;
  yearly: number;
  isIndia: boolean;
  /**
   * Daam kahan se aaya. UI isse badalta kuch nahi — ye admin/debug ke liye hai,
   * taaki "website ₹99 kyun dikha rahi hai" ka jawab dhoondhna na pade.
   */
  source: PriceSource;
  /**
   * Poora bana-banaya label ("₹99", "$1.99", "99 kr").
   *
   * Har currency apne niyam se chalti hai — symbol aage, peeche, space ke saath,
   * bina space ke. `symbol + number` jodna angrezi-hindi ke liye chal jaata hai
   * aur baaki aadhi duniya ke liye galat dikhta hai. Jahan ho sake, ye label
   * seedha dikhao.
   */
  monthlyLabel: string;
  yearlyLabel: string;
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

/**
 * Play Console ka price us desh ke liye.
 *
 * DONO (monthly + yearly) chahiye. Ek hi mila to Play par gir jaana thoda-sa
 * sach aur thoda-sa purana hisaab mila dega — ek plan Play ka daam dikhayega
 * aur doosra admin ka. Aadha-sach yahan poore jhooth se zyada confusing hai,
 * isliye aisi halat me poora fallback lete hain.
 */
async function playPrice(code: string): Promise<ResolvedPrice | null> {
  const found = await getPlayPricesForRegion(code);
  const monthly = found?.monthly;
  const yearly = found?.yearly;
  if (!monthly || !yearly) return null;
  // Ek hi desh me do currency nahi ho sakti — aisa dikhe to data hi shak ke
  // laayak hai, aur mila-jula label dikhane se behtar hai fallback.
  if (monthly.currency !== yearly.currency) return null;

  const region = code.toUpperCase();
  const currency = monthly.currency;
  /**
   * Number grouping us desh ke hisaab se.
   *
   * Har jagah "en-IN" laga dena chhota-sa lagta hai par ek asli galti hai:
   * en-IN 100000 ko "1,00,000" likhta hai (lakh wali ginti), jo India ke liye
   * theek hai aur America ke liye bilkul galat. `en-<REGION>` se ginti sahi
   * jagah tootiti hai, aur bhasha wahi English rehti hai jo website ki hai.
   */
  const locale = `en-${region}`;
  return {
    code: region,
    currency,
    symbol: symbolFor(currency, locale),
    monthly: microsToAmount(monthly.micros),
    yearly: microsToAmount(yearly.micros),
    isIndia: region === "IN",
    source: "play",
    monthlyLabel: formatMicros(currency, monthly.micros, locale),
    yearlyLabel: formatMicros(currency, yearly.micros, locale),
  };
}

/** Purana hisaab — base (INR) × multiplier × conversion_rate. */
async function manualPrice(code: string): Promise<ResolvedPrice> {
  const offers = await getOffers();
  const row = (await pricingRow(code)) ?? (await pricingRow("IN"));
  const mult = row?.multiplier ?? 1;
  const rate = row?.conversion_rate ?? 1;
  const finalCode = row?.country_code ?? "IN";
  const symbol = row?.symbol ?? "₹";
  const monthly = roundPrice(offers.plusPriceMonthly * mult * rate);
  const yearly = roundPrice(offers.plusPriceYearly * mult * rate);
  return {
    code: finalCode,
    currency: row?.currency ?? "INR",
    symbol,
    monthly,
    yearly,
    isIndia: finalCode === "IN",
    source: "manual",
    monthlyLabel: formatPrice(symbol, monthly),
    yearlyLabel: formatPrice(symbol, yearly),
  };
}

/**
 * Country code (IP se) → dikhane wala price.
 *
 * Play pehle. Us desh ka Play price na mile to India ka Play price bhi dekh
 * lete hain — website duniya bhar se khulti hai, aur "₹99 (India ka daam)"
 * dikhana ek haath se banaye hue anuman se behtar hai. Wo bhi na ho tabhi
 * purana manual hisaab.
 */
export async function resolvePrice(countryCode?: string): Promise<ResolvedPrice> {
  const code = (countryCode || "IN").toUpperCase();
  const fromPlay = (await playPrice(code)) ?? (code === "IN" ? null : await playPrice("IN"));
  return fromPlay ?? (await manualPrice(code));
}
