import { NextResponse } from "next/server";

import {
  playBillingEnabled,
  playBillingStatus,
  verifyWebhookAuth,
  parsePlayEvent,
} from "@/lib/play-billing";
import {
  activatePlus,
  deactivatePlus,
  planDbConfigured,
  recordPlayEvent,
} from "@/lib/plan-server";
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

  /**
   * Record PEHLE, plan BAAD me — aur HAR event ka, chahe hum uspar kuch karein
   * ya nahi.
   *
   * ⚠️ Pehle yahan koi record banta hi nahi tha: webhook `profiles.plan` badal
   * ke aage badh jaata tha. Iska matlab tha ki "kisne, kab, kitna diya" ka jawab
   * sirf Play Console me tha, aur "maine paisa diya par Plus nahi mila" wali
   * ticket par hamare paas dekhne ko kuch bhi nahi hota tha.
   *
   * Tarteeb maayne rakhti hai. `ignore` wale event (BILLING_ISSUE,
   * CANCELLATION, PRODUCT_CHANGE) neeche pehle hi return ho jaate hain — agar
   * record baad me likhte to theek WAHI events kabhi darj hi na hote, jo ek
   * user ka Plus chup-chaap khatam hone ki poori kahani batate hain.
   *
   * Ye best-effort hai (`recordPlayEvent` kabhi throw nahi karta): hisaab na
   * ban paane par plan dena nahi rukna chahiye.
   */
  const recorded = await recordPlayEvent({
    userId: ev.userId,
    eventId: ev.eventId,
    eventType: ev.type,
    transactionId: ev.transactionId,
    originalTransactionId: ev.originalTransactionId,
    productId: ev.productId,
    store: ev.store,
    amount: ev.amount,
    currency: ev.currency,
    periodType: ev.periodType,
    environment: ev.environment,
    expiresAt: ev.until,
    eventAt: ev.eventAt,
    raw: payload,
  });

  // Bina user ke kuch nahi kar sakte. Ye fail nahi hai (anonymous purchase ho
  // sakti hai) — isliye 200, warna RevenueCat isse hamesha retry karta rahega.
  if (!ev.userId || ev.action === "ignore") {
    return NextResponse.json({ ok: true, skipped: ev.type, recorded });
  }

  try {
    if (ev.action === "grant") {
      /**
       * ⚠️ `until` sirf tab bhejte hain jab wo sach me aaya ho.
       *
       * `activatePlus` me `until: null` ka matlab **lifetime** hai. Par
       * `parsePlayEvent` bhi `null` hi deta hai jab `expiration_at_ms` payload
       * me tha hi nahi. Dono ko ek jaisa bhej dene ka matlab hota: ek RENEWAL
       * event jisme wo field kisi wajah se gayab ho, user ko HAMESHA ke liye
       * Plus de deta — bina kisi nishaan ke, aur wo galti kabhi apne aap theek
       * nahi hoti.
       *
       * `until` chhod dene par `activatePlus` apna default (1 mahina) lagata
       * hai. Ek mahina kam dena galti se sudhaara ja sakta hai; hamesha ke liye
       * de dena nahi.
       */
      await activatePlus(
        ev.userId,
        ev.until
          ? { until: ev.until, source: "google_play" }
          : { source: "google_play" },
      );
    } else {
      await deactivatePlus(ev.userId);
    }
  } catch (e) {
    void logServerError(e, { where: "play/webhook", type: ev.type, user: ev.userId });
    // 500 se RevenueCat dobara bhejta hai — paise le liye aur plan na mile,
    // usse behtar hai retry.
    //
    // ⚠️ Retry par record duplicate nahi hoga: `recordPlayEvent` `event_id` par
    // `ignore-duplicates` karta hai (dekho supabase/play-payments.sql).
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: ev.action, recorded });
}
