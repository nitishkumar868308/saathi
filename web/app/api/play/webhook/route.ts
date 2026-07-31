import { NextResponse } from "next/server";

import {
  playBillingEnabled,
  playBillingStatus,
  verifyWebhookAuth,
  parsePlayEvent,
} from "@/lib/play-billing";
import { activatePlus, deactivatePlus, planDbConfigured } from "@/lib/plan-server";
import { logServerError } from "@/lib/errors-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Google Play Billing ka webhook (RevenueCat ke zariye). **Abhi BAND hai.**
 *
 * Chalu karne ke liye `PLAY_BILLING_ENABLED=1` aur `REVENUECAT_WEBHOOK_SECRET`
 * set karo — poori baat `lib/play-billing.ts` ke upar likhi hai.
 *
 * ⚠️ Band hone par ye 503 lautata hai, 200 nahi. Farq bada hai: 200 par
 * RevenueCat samajhta hai ki event pahunch gaya aur usse hamesha ke liye bhool
 * jaata hai — yaani chalu karne se pehle wali saari kharidariyan chup-chaap gum
 * ho jaatin. 503 par wo dobara koshish karta rehta hai.
 */
export async function POST(request: Request) {
  if (!playBillingEnabled()) {
    return NextResponse.json(
      { error: "play billing off", detail: playBillingStatus() },
      { status: 503 },
    );
  }
  if (!planDbConfigured()) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  if (!verifyWebhookAuth(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const ev = parsePlayEvent(payload);

  // Bina user ke kuch nahi kar sakte. Ye fail nahi hai (anonymous purchase ho
  // sakti hai) — isliye 200, warna RevenueCat isse hamesha retry karta rahega.
  if (!ev.userId || ev.action === "ignore") {
    return NextResponse.json({ ok: true, skipped: ev.type });
  }

  try {
    if (ev.action === "grant") {
      await activatePlus(ev.userId, { until: ev.until, source: "google_play" });
    } else {
      await deactivatePlus(ev.userId);
    }
  } catch (e) {
    void logServerError(e, { where: "play/webhook", type: ev.type, user: ev.userId });
    // 500 se RevenueCat dobara bhejta hai — paise le liye aur plan na mile,
    // usse behtar hai retry.
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: ev.action });
}
