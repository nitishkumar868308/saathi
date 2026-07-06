import { NextResponse } from "next/server";
import { PLANS, createOrder, razorpayConfigured, type PlanId } from "@/lib/razorpay";
import { recordPayment } from "@/lib/plan-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!razorpayConfigured()) {
    return NextResponse.json(
      { error: "payment gateway not configured" },
      { status: 503 },
    );
  }

  let plan: PlanId;
  let userId: string | undefined;
  try {
    const body = await request.json();
    plan = body?.plan;
    userId = body?.userId ? String(body.userId) : undefined;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!plan || !PLANS[plan]) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  try {
    const receipt = `saathi_${Date.now()}`;
    const order = await createOrder(plan, receipt);
    await recordPayment({
      userId,
      plan,
      amount: order.amount,
      orderId: order.id,
      status: "created",
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      label: PLANS[plan].label,
    });
  } catch (err) {
    console.error("[razorpay/order]", err);
    return NextResponse.json({ error: "order failed" }, { status: 500 });
  }
}
