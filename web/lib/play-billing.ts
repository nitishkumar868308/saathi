import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Google Play Billing — server ki taraf ka hissa. **Abhi BAND hai.**
 *
 * ── Kyun Play Billing ──────────────────────────────────────────────────────
 * Saathi Plus ek digital subscription hai. Play Store ki policy me aise saamaan
 * ke liye Google ke apne billing ke alawa kuch nahi chalta — Razorpay wala
 * website checkout isliye poori tarah hata diya gaya hai (na koi route bacha,
 * na key). Ye niyam ki baat hai, pasand ki nahi: doosra payment system rakhne
 * par app hi Play se hata di jaati hai.
 *
 * ── Abhi kaise chalu hoga ─────────────────────────────────────────────────
 * App ke andar kharidari `react-native-purchases` (RevenueCat) se hoti hai, jo
 * andar-andar Play Billing hi chalata hai. Server ko sirf ek cheez chahiye:
 * jab kisi ka subscription banta/badalta/khatam hota hai to `profiles` me plan
 * update ho jaye. Wo kaam RevenueCat ka webhook karta hai → `/api/play/webhook`.
 *
 * Chalu karne ke liye do env chahiye (dono na hon to endpoint 503 lautata hai):
 *
 *   PLAY_BILLING_ENABLED=1
 *   REVENUECAT_WEBHOOK_SECRET=<RevenueCat dashboard me set kiya hua>
 *
 * Aur app me:
 *   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_…
 *
 * ⚠️ Jaan-boojh ke DEFAULT BAND hai. Aadha-chalu billing sabse khatarnaak
 * haalat hai: user paisa de deta hai aur uska plan kabhi update nahi hota,
 * ya (ulta) bina paise ke Plus mil jaata hai. Isliye jab tak dono taraf poori
 * tarah set na ho, ye kuch nahi karta — chup-chaap fail nahi hota, saaf mana
 * karta hai.
 */

const ENABLED = process.env.PLAY_BILLING_ENABLED === "1";
const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

export function playBillingEnabled(): boolean {
  return ENABLED && !!WEBHOOK_SECRET;
}

/** Chalu kyun nahi hai — admin/logs me saaf dikhne ke liye. */
export function playBillingStatus(): string {
  if (!ENABLED) return "PLAY_BILLING_ENABLED set nahi hai";
  if (!WEBHOOK_SECRET) return "REVENUECAT_WEBHOOK_SECRET set nahi hai";
  return "on";
}

/**
 * Webhook sach me RevenueCat se aaya hai ya nahi.
 *
 * RevenueCat `Authorization` header me wahi value bhejta hai jo dashboard me
 * likhi ho. Seedha `===` se milana yahan galat hota: string compare pehle
 * alag akshar par ruk jaata hai, aur us timing se secret ek-ek akshar karke
 * guess kiya ja sakta hai. `timingSafeEqual` hamesha poora chalta hai.
 */
export function verifyWebhookAuth(header: string | null): boolean {
  if (!WEBHOOK_SECRET || !header) return false;
  const given = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(given);
  const b = Buffer.from(WEBHOOK_SECRET);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Agar aage Google ka apna RTDN (Pub/Sub) laga to signature isse jaanchna. */
export function hmacMatches(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* ------------------------------- events ------------------------------- */

/**
 * RevenueCat ke event jo maayne rakhte hain.
 *
 * Poori list bahut lambi hai; hume sirf itna jaanna hai ki plan **chalu** hua
 * ya **band**. Baaki (BILLING_ISSUE, PRODUCT_CHANGE…) ko chhod dena surakshit
 * hai — unke baad hamesha ek RENEWAL ya EXPIRATION aata hi hai.
 */
const GRANTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
]);
const REVOKES = new Set(["EXPIRATION", "REFUND"]);

export type PlayEvent = {
  /** `grant` = Plus do, `revoke` = wapas lo, `ignore` = kuch mat karo. */
  action: "grant" | "revoke" | "ignore";
  /** Supabase user id — app RevenueCat ko yahi `appUserID` deti hai. */
  userId: string | null;
  /**
   * Subscription kab tak (ISO). `null` = expiry ki koi khabar hi nahi aayi.
   *
   * ⚠️ Ise "lifetime" mat maano. Dekho `activatePlus()` ka call neeche
   * (`app/api/play/webhook/route.ts`) — wahan `until` sirf tab bheja jaata hai
   * jab wo sach me aaya ho.
   */
  until: string | null;
  type: string;

  /* ------- neeche sab sirf RECORD ke liye — faisla inpar nahi hota ------- */

  /** Har event ka apna id. Duplicate rokne ka taala isi par hai. */
  eventId: string | null;
  /** Store ka transaction (Play ka orderId) — refund isi se dhoonda jaata hai. */
  transactionId: string | null;
  /** Pehli kharidari ka transaction — poori renewal chain isse judti hai. */
  originalTransactionId: string | null;
  /** 'plus_monthly' / 'plus_yearly'. */
  productId: string | null;
  store: string | null;
  /** ⚠️ Decimal (99.00), paise nahi. Purana `payments.amount` int-paise hai. */
  amount: number | null;
  currency: string | null;
  /** 'NORMAL' | 'TRIAL' | 'INTRO' | 'PROMOTIONAL'. */
  periodType: string | null;
  /** 'PRODUCTION' | 'SANDBOX' — test kharidari kamai me nahi ginni chahiye. */
  environment: string | null;
  /** Event store par kab hua (ISO) — hamne kab likha, usse alag. */
  eventAt: string | null;
};

/** Kaccha value string me — khaali/galat ho to null. */
function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** ms se ISO. 0 / null / bakwaas ho to null. */
function iso(v: unknown): string | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * RevenueCat ke webhook body ko apni bhasha me badlo.
 *
 * ⚠️ Do hisse jaan-boojh ke alag rakhe hain: `action`/`userId`/`until` par
 * FAISLA hota hai (Plus dena ya lena), baaki sab sirf RECORD ke liye hai. Isse
 * ek baat pakki rehti hai — koi naya field jodne se plan dene ka niyam galti se
 * nahi badalta.
 */
export function parsePlayEvent(payload: unknown): PlayEvent {
  const ev = (payload as { event?: Record<string, unknown> })?.event ?? {};
  const type = String(ev.type ?? "");

  // `app_user_id` wahi hai jo app ne `Purchases.configure({ appUserID })` me
  // diya tha — yaani Supabase ka user id. Anonymous id (`$RCAnonymousID:…`)
  // kisi kaam ka nahi: uska koi profile hi nahi hota.
  const raw = ev.app_user_id;
  const userId =
    typeof raw === "string" && raw && !raw.startsWith("$RCAnonymousID") ? raw : null;

  const priceRaw = ev.price_in_purchased_currency ?? ev.price;
  const price = Number(priceRaw);

  const action = GRANTS.has(type) ? "grant" : REVOKES.has(type) ? "revoke" : "ignore";

  return {
    action,
    userId,
    until: iso(ev.expiration_at_ms),
    type,

    eventId: str(ev.id),
    transactionId: str(ev.transaction_id),
    originalTransactionId: str(ev.original_transaction_id),
    // RevenueCat kabhi `product_id` deta hai, kabhi array me `product_ids`.
    productId:
      str(ev.product_id) ??
      (Array.isArray(ev.product_ids) ? str(ev.product_ids[0]) : null),
    store: str(ev.store),
    // ⚠️ 0 bhi ek asli value hai (trial / promotional), isliye `|| null` nahi.
    // Wo poora farak hi mita deta ki "muft tha" aur "pata hi nahi" alag baatein
    // hain — aur kamai ka hisaab usi farak par tika hai.
    amount: Number.isFinite(price) ? price : null,
    currency: str(ev.currency),
    periodType: str(ev.period_type),
    environment: str(ev.environment),
    eventAt: iso(ev.event_timestamp_ms) ?? iso(ev.purchased_at_ms),
  };
}
