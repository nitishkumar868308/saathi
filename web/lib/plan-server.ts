import { logServerError } from "@/lib/errors-server";

/**
 * Server-side plan updates in Supabase (service_role key se).
 *
 * ⚠️ Pehle ye Razorpay ke saath bandha tha: website par checkout chalta tha aur
 * uske success par yahi call hota tha. Wo poora raasta hata diya gaya hai —
 * payment ab **Google Play Billing** se hoga, app ke andar. Wajah niyam ki hai,
 * pasand ki nahi: Play Store apni policy me digital saamaan (Saathi Plus jaisa
 * subscription) ke liye apne alawa koi payment system chalane nahi deta.
 *
 * Play Billing abhi CHALU NAHI hai (`play-billing.ts` dekho). Jab chalu hoga to
 * webhook yahin aakar `activatePlus()` bulaayega — isliye ye file rehne di gayi
 * hai, bas ab kisi ek payment company se bandhi nahi hai.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function planDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/** Kahan se Plus mila — profile me isi naam se darj hota hai. */
export type PlanSource = "google_play" | "admin";

/**
 * Plan badalne ke BAAD access bhi usi hisaab se khol/band karo.
 *
 * ⚠️ Ye alag se bulana ZAROORI hai, aur yahi wo baat thi jo chhoot gayi thi.
 *
 * `profiles.plan` badalna aadha kaam hai. Documents par `is_locked` aur
 * reminders par `is_paused` alag column hain — wo apne aap nahi badalte.
 * `grant_plus_days()` (referral / admin wala raasta) ye hamesha karta aaya hai,
 * aur uske upar likha bhi hai: "kisi bhi tarah Plus milte hi paused reminders
 * aur locked documents turant wapas aa jaayein". Play se kharidne wala raasta
 * wahi ek line bhool gaya tha.
 *
 * Dono taraf ka nuksan asli tha:
 *
 *   • Kharid ke baad — user ne paisa de diya, plan 'plus' ho gaya, par uske
 *     purane documents LOCKED hi pade rahe. App dobara khulne tak. Wahi "paisa
 *     diya par kaam nahi kar raha" wali sabse buri shikayat.
 *   • Khatam hone ke baad — plan 'free' ho gaya par extra documents khule aur
 *     extra reminders chalu hi rahe. Yaani paisa dena band, feature chaalu.
 *
 * Best-effort: ye fail ho to bhi plan to badal hi chuka hai, aur app agli baar
 * khulte hi `enforce_my_limits()` chala kar khud sudhaar leti hai. Isliye ye
 * plan dene/hatane ko kabhi rok nahi sakta.
 */
async function applyPlanLimits(userId: string): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/enforce_plan_limits`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_uid: userId }),
      cache: "no-store",
    });
    /**
     * ⚠️ Fail hua to CHUP mat raho — chahe hum aage badh hi rahe hon.
     *
     * Sabse aasan galti yahan 404 hai: `enforce_plan_limits` par service_role ko
     * grant na ho to PostgREST use dikhata hi nahi. Us haal me sab theek dikhta
     * hai — plan 'plus' ho jaata hai, payment record ban jaata hai — par user ka
     * document Plus lene ke baad bhi nahi khulta. Bina is line ke wo galti
     * mahinon chhupi reh sakti hai. Ilaaj: supabase/plan-limits.sql dobara chalao.
     */
    if (!res.ok) {
      void logServerError(
        new Error(
          `enforce_plan_limits chala nahi — HTTP ${res.status} ` +
            `(supabase/plan-limits.sql dobara run karo: service_role ko grant chahiye)`,
        ),
        { where: "plan-server", action: "enforce-limits", user: userId },
        { level: "warn" },
      );
    }
  } catch {
    /* net ka jhatka — app apne agle session me khud sudhaar legi */
  }
}

/**
 * User ko Plus banao.
 *
 * `until` ho to wahi expiry lagti hai (Play/RevenueCat ki asli expiry). Warna
 * `months` se aage badha dete hain.
 *
 * ⚠️ Expiry kabhi CHHOTI nahi karte. User ke paas referral ya first-N wale din
 * pehle se ho sakte hain jo subscription se aage jaate hain — unhe kaat dena
 * user ke liye chori jaisa lagta hai, aur uska koi nishaan bhi nahi bachta.
 */
export async function activatePlus(
  userId: string,
  opts: { months?: number; until?: string | null; source?: PlanSource } = {},
): Promise<void> {
  if (!planDbConfigured()) return;

  let expires: string | null;
  if (opts.until !== undefined) {
    expires = opts.until; // null = lifetime
  } else {
    const d = new Date();
    d.setMonth(d.getMonth() + (opts.months ?? 1));
    expires = d.toISOString();
  }

  // Pehle se lambi expiry ho to usse chhoti mat karo.
  if (expires) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan_expires_at`,
        { headers: headers(), cache: "no-store" },
      );
      if (res.ok) {
        const [row] = (await res.json()) as { plan_expires_at: string | null }[];
        const current = row?.plan_expires_at;
        if (current && new Date(current) > new Date(expires)) expires = current;
      }
    } catch {
      /* padha na ja sake to naya waqt hi laga do — Plus dena na dene se behtar */
    }
  }

  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      plan: "plus",
      plan_expires_at: expires,
      plan_source: opts.source ?? "google_play",
    }),
    cache: "no-store",
  });

  // Plus mil gaya — locked documents aur paused reminders TURANT wapas.
  await applyPlanLimits(userId);
}

/** Subscription khatam/cancel — wapas free. */
export async function deactivatePlus(userId: string): Promise<void> {
  if (!planDbConfigured()) return;
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ plan: "free" }),
    cache: "no-store",
  });

  // Plus khatam — free ki hadd dobara lagao, warna paid feature chalte rehte.
  await applyPlanLimits(userId);
}

/**
 * Ek payment ka nishaan.
 *
 * `payments` table ke column abhi bhi `razorpay_*` naam ke hain (purani rows
 * unme padi hain). Naam badalne ke liye migration chahiye; abhi Play ka order
 * id usi khaane me jaata hai. Ye jaan-boojh ke likha hai taaki koi ye na soche
 * ki Razorpay wapas aa gaya.
 */
export async function recordPayment(entry: {
  userId?: string;
  plan: string;
  amount: number;
  orderId: string;
  paymentId?: string;
  status: string;
  source?: PlanSource;
}): Promise<void> {
  if (!planDbConfigured()) return;
  await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify([
      {
        user_id: entry.userId ?? null,
        plan: entry.plan,
        amount: entry.amount,
        razorpay_order_id: entry.orderId,
        razorpay_payment_id: entry.paymentId ?? null,
        status: entry.status,
      },
    ]),
    cache: "no-store",
  });
}

/* ------------------------- Play / RevenueCat record ------------------------ */

/** Ek RevenueCat event ka poora nishaan — `supabase/play-payments.sql` dekho. */
export type PlayPaymentRecord = {
  userId: string | null;
  eventId: string | null;
  eventType: string;
  transactionId: string | null;
  originalTransactionId: string | null;
  productId: string | null;
  store: string | null;
  amount: number | null;
  currency: string | null;
  periodType: string | null;
  environment: string | null;
  expiresAt: string | null;
  eventAt: string | null;
  /** Poora kaccha payload — naye field kal kaam aa sakte hain. */
  raw: unknown;
};

/**
 * Har webhook event `payments` me likho — grant, revoke, aur wo bhi jo hum
 * anadekha karte hain.
 *
 * ⚠️ **Har** event, sirf paise wale nahi.** BILLING_ISSUE, CANCELLATION,
 * PRODUCT_CHANGE — inpar plan nahi badalta, par jab koi user likhta hai "maine
 * paisa diya tha, ab Plus nahi hai", to jawab theek inhi rows me hota hai. Sirf
 * kharidari likhne par woh poori kahani aadhi reh jaati hai.
 *
 * ⚠️ Ye best-effort hai aur JAAN-BOOJH KE throw nahi karta. Record na ban paane
 * par plan dena nahi rukna chahiye: user ne paisa de diya hai, aur uske liye
 * "Plus mila" sabse zaroori baat hai — hisaab uske baad ki cheez hai.
 *
 * @returns `true` = nayi row bani. `false` = pehle se thi (duplicate webhook)
 *          ya likhi nahi ja saki.
 */
export async function recordPlayEvent(entry: PlayPaymentRecord): Promise<boolean> {
  if (!planDbConfigured()) return false;
  try {
    const res = await fetch(
      // ⚠️ `on_conflict=event_id` + `ignore-duplicates` — RevenueCat webhook ko
      // "at least once" bhejta hai (hamara 500, hamari der, ya Vercel ka function
      // beech me marna — teenon retry karate hain). Bina is do-line ke ek hi
      // kharidari do-teen rows banati aur kamai ka number hamesha bada dikhta.
      `${SUPABASE_URL}/rest/v1/payments?on_conflict=event_id`,
      {
        method: "POST",
        headers: headers({ Prefer: "resolution=ignore-duplicates,return=representation" }),
        body: JSON.stringify([
          {
            user_id: entry.userId,
            plan: entry.productId?.includes("yearly") ? "plus_yearly" : "plus_monthly",
            event_id: entry.eventId,
            event_type: entry.eventType,
            transaction_id: entry.transactionId,
            original_transaction_id: entry.originalTransactionId,
            product_id: entry.productId,
            store: entry.store,
            amount_decimal: entry.amount,
            currency: entry.currency,
            period_type: entry.periodType,
            environment: entry.environment,
            expires_at: entry.expiresAt,
            event_at: entry.eventAt,
            // `status` purana column hai — usme wahi shabd rakhte hain jo
            // Razorpay ke zamane me the, taaki purani rows ke saath padha ja sake.
            status: entry.eventType === "REFUND" ? "refunded" : "paid",
            raw: entry.raw ?? null,
          },
        ]),
        cache: "no-store",
      },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as unknown[];
    // ignore-duplicates me pehle se maujood row par khaali array aata hai.
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}
