/**
 * Server-side plan updates in Supabase (service_role key se).
 * Razorpay payment success hone par yahi call hota hai.
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

/** User ko Plus banao — plan_expires_at ko `months` aage badha do. */
export async function activatePlus(
  userId: string,
  months: number,
): Promise<void> {
  if (!planDbConfigured()) return;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);

  await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        plan: "plus",
        plan_expires_at: expires.toISOString(),
        plan_source: "razorpay",
      }),
      cache: "no-store",
    },
  );
}

export async function recordPayment(entry: {
  userId?: string;
  plan: string;
  amount: number;
  orderId: string;
  paymentId?: string;
  status: string;
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
