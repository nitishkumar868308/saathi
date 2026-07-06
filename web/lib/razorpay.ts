import { createHmac } from "crypto";

/**
 * Razorpay payment gateway helper (server-side).
 *
 * .env.local:
 *   RAZORPAY_KEY_ID=rzp_live_xxx (ya rzp_test_xxx)
 *   RAZORPAY_KEY_SECRET=xxxxxxxx
 *   RAZORPAY_WEBHOOK_SECRET=xxxx           (Razorpay dashboard > Webhooks)
 *   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_xxx    (client checkout ke liye — key_id public hai)
 *
 * Prices: base + 18% GST (paise mein — Razorpay integer paise leta hai).
 */

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export function razorpayConfigured(): boolean {
  return Boolean(KEY_ID && KEY_SECRET);
}

const GST = 0.18;
const withGst = (base: number) => Math.round(base * (1 + GST) * 100); // paise

export type PlanId = "plus_monthly" | "plus_yearly";

export const PLANS: Record<
  PlanId,
  { label: string; base: number; amount: number; months: number }
> = {
  plus_monthly: {
    label: "Saathi Plus · Monthly",
    base: 99,
    amount: withGst(99), // 11682 paise (₹116.82)
    months: 1,
  },
  plus_yearly: {
    label: "Saathi Plus · Yearly",
    base: 999,
    amount: withGst(999), // 117882 paise (₹1178.82)
    months: 12,
  },
};

/** Razorpay order banao (REST API, bina SDK). */
export async function createOrder(
  plan: PlanId,
  receipt: string,
): Promise<{ id: string; amount: number; currency: string }> {
  const p = PLANS[plan];
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: p.amount,
      currency: "INR",
      receipt,
      notes: { plan },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`razorpay order failed: ${res.status} ${txt}`);
  }
  return res.json();
}

/** Checkout ke baad signature verify karo. */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  if (!KEY_SECRET) return false;
  const expected = createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

/** Webhook signature verify karo. */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}
