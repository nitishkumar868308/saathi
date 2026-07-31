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
