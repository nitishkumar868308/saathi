import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * Razorpay webhook (backup — agar client verify miss ho jaye).
 * Dashboard > Settings > Webhooks mein URL add karo:
 *   https://<domain>/api/razorpay/webhook   (event: payment.captured)
 * aur RAZORPAY_WEBHOOK_SECRET env set karo.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const body = await request.text();

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    const event = JSON.parse(body);
    console.log("[razorpay/webhook]", event?.event);
    // payment.captured yahan handle kar sakte ho (order notes se plan/user nikaal ke).
    // Abhi client-side verify primary hai; ye sirf logging/backup.
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true });
}
