/**
 * "Is visitor ko kaunsa daam dikhana hai" — ek hi jagah ka jawab.
 *
 * ── Ek hi source ───────────────────────────────────────────────────────────
 * Google Play Console. Bas. `play_prices` table me uski nakal padi rehti hai
 * (server roz sync karta hai — `lib/play-prices.ts`), aur website wahin se
 * padhti hai. Wahi daam app me kata bhi jaata hai.
 *
 * Pehle yahan ek doosra raasta bhi tha: admin ka apna base price × per-country
 * multiplier × conversion rate. Wo poora hata diya gaya. Wo number haath se
 * bharna padta tha aur Play se hamesha thoda alag ho jaata — yaani website ek
 * daam dikhati aur Play doosra kaat leta. Ye sirf bharosa todne wali baat nahi,
 * Play ki policy bhi yahi maangti hai ki jo dikhe wahi kate.
 *
 * ── Girne ki tarteeb ───────────────────────────────────────────────────────
 * 1. Us desh ka Play price.
 * 2. India ka Play price — Play 173 desh cover karta hai; bache hue desh ke
 *    visitor ko "₹99" dikhana ek bane-banaye anuman se behtar hai.
 * 3. `DEFAULT_PRICE` — sirf tab jab sync ek baar bhi na chala ho.
 *
 * Ye poora hissa sirf DISPLAY ke liye hai. Asli charge Play user ke ACCOUNT wale
 * desh se karta hai — VPN se sirf ye display badalta hai, paisa nahi. Isliye IP
 * par bharosa karna yahan surakshit hai.
 */
import { DEFAULT_PRICE } from "./price-default";
import {
  formatMicros,
  getPlayPricesForRegion,
  microsToAmount,
  symbolFor,
} from "./play-prices";

/** 'play' = Play Console ka daam. 'default' = sync abhi chala hi nahi. */
export type PriceSource = "play" | "default";

export type ResolvedPrice = {
  code: string;
  currency: string;
  symbol: string;
  monthly: number;
  yearly: number;
  isIndia: boolean;
  /**
   * UI isse kuch badalta nahi — ye debug ke liye hai. `default` dikhe to iska
   * matlab ek hi hai: Play sync abhi tak nahi chala.
   */
  source: PriceSource;
  /**
   * Bana-banaya label — "₹99", "$0.99", "99 kr".
   *
   * ⚠️ `symbol + number` khud mat jodna. Har currency apne niyam se chalti hai
   *    (symbol aage, peeche, space ke saath ya bina), aur wo jodna India-America
   *    ke liye chal jaata hai par baaki aadhi duniya ke liye galat dikhta hai.
   */
  monthlyLabel: string;
  yearlyLabel: string;
};

/**
 * Play Console ka daam us desh ke liye.
 *
 * DONO (monthly + yearly) chahiye. Ek hi mila to aadha Play ka daam aur aadha
 * kisi aur jagah ka mil jaata — ek plan ka number sach aur doosre ka nahi. Aisa
 * aadha-sach poore fallback se zyada confusing hai.
 */
async function playPrice(code: string): Promise<ResolvedPrice | null> {
  const region = code.toUpperCase();
  const found = await getPlayPricesForRegion(region);
  const monthly = found?.monthly;
  const yearly = found?.yearly;
  if (!monthly || !yearly) return null;
  // Ek desh me do currency nahi ho sakti — aisa dikhe to data hi shak ke laayak
  // hai, aur mila-jula label dikhane se behtar hai aage gir jana.
  if (monthly.currency !== yearly.currency) return null;

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

/** Country code (IP se) → dikhane wala price. */
export async function resolvePrice(countryCode?: string): Promise<ResolvedPrice> {
  const code = (countryCode || "IN").toUpperCase();
  const fromPlay = (await playPrice(code)) ?? (code === "IN" ? null : await playPrice("IN"));
  if (fromPlay) return fromPlay;
  return { ...DEFAULT_PRICE, isIndia: true, source: "default" };
}
