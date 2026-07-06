import { NextResponse } from "next/server";
import { PLANS, verifyPaymentSignature, type PlanId } from "@/lib/razorpay";
import { activatePlus, recordPayment } from "@/lib/plan-server";

export const runtime = "nodejs";

/**
 * Checkout success ke baad client yahan payment verify karata hai.
 * Signature sahi ho to user ko Plus bana dete hain.
 */
export async function POST(request: Request) {
  let orderId = "";
  let paymentId = "";
  let signature = "";
  let plan: PlanId | undefined;
  let userId: string | undefined;
  try {
    const b = await request.json();
    orderId = String(b?.razorpay_order_id ?? "");
    paymentId = String(b?.razorpay_payment_id ?? "");
    signature = String(b?.razorpay_signature ?? "");
    plan = b?.plan;
    userId = b?.userId ? String(b.userId) : undefined;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!orderId || !paymentId || !signature || !plan || !PLANS[plan]) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const ok = verifyPaymentSignature(orderId, paymentId, signature);
  if (!ok) {
    await recordPayment({
      userId,
      plan,
      amount: PLANS[plan].amount,
      orderId,
      paymentId,
      status: "failed",
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  await recordPayment({
    userId,
    plan,
    amount: PLANS[plan].amount,
    orderId,
    paymentId,
    status: "paid",
  });

  if (userId) {
    await activatePlus(userId, PLANS[plan].months);
  }

  return NextResponse.json({ ok: true });
}
