import { NextResponse } from "next/server";

import {
  GRANTS,
  playBillingEnabled,
  playBillingStatus,
  verifyWebhookAuth,
  parsePlayEvent,
} from "@/lib/play-billing";
import {
  activatePlus,
  deactivatePlus,
  forgetPlayEvent,
  getPlanUser,
  latestGrantEventAt,
  planDbConfigured,
  recordPlayEvent,
  type RevokeResult,
} from "@/lib/plan-server";
import { sendPlusPurchaseEmail } from "@/lib/email";
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

  /**
   * Sandbox (test) kharidari — record ho chuka, par Plus nahi.
   *
   * ⚠️ Pehle SANDBOX event bhi asli Plus de dete the. License tester ya koi bhi
   * jo test card se "kharid" le, use bina paise ke asli account par Plus mil
   * jaata — aur uska revoke bhi asli plan ko chhoota. Testing ke liye chahiye
   * to `ALLOW_SANDBOX_PLUS=1` set karo (sirf staging/preview par).
   */
  const sandbox = (ev.environment ?? "").toUpperCase() === "SANDBOX";
  if (sandbox && process.env.ALLOW_SANDBOX_PLUS !== "1") {
    return NextResponse.json({ ok: true, skipped: "sandbox", type: ev.type, recorded });
  }

  let revoke: RevokeResult | "stale" | undefined;

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

      /**
       * Kharidari ki pusht — user ke apne inbox me.
       *
       * ⚠️ Ye INVOICE nahi hai. Play par bechne wala Google khud hota hai, GST
       * wahi sambhalta hai, aur asli receipt wahi bhejta hai. Par uske mail me
       * Saathi ka naam kahin nahi hota — aur wahi se do sabse aam ticket aati
       * hain: "paisa kat gaya, Plus mila kya?" aur "invoice nahi mila". Ye mail
       * wahi teen baatein kehta hai jo sirf hum keh sakte hain (poori wajah
       * `lib/email.ts` ke `sendPlusPurchaseEmail` par).
       *
       * ⚠️ DO shartein, aur dono zaroori hain:
       *
       *   • `recorded` — yaani ye event pehli baar aaya hai. RevenueCat fail par
       *     dobara bhejta hai, aur `recordPlayEvent` `event_id` par duplicate
       *     chhod deta hai. Is shart ke bina ek hi kharidari par user ko teen-
       *     chaar "Plus chalu ho gaya" mail chale jaate.
       *   • `amount` — paisa sach me kata ho. Free trial ya promo par bhi yahi
       *     event aata hai, aur wahan "aapne itna diya" likhna seedha jhooth hai.
       *
       * Best-effort: email na ja paaye to bhi Plus mil chuka hai. Isliye ye
       * `catch` ke andar hai aur webhook ko kabhi fail nahi karta.
       */
      if (recorded && ev.amount) {
        try {
          const u = await getPlanUser(ev.userId);
          if (u?.email) {
            await sendPlusPurchaseEmail(
              u.email,
              u.name,
              {
                productId: ev.productId,
                amount: ev.amount,
                currency: ev.currency,
                until: ev.until,
              },
              u.language,
              ev.userId,
            );
          }
        } catch (e) {
          void logServerError(e, { where: "play/webhook", action: "purchase-email" });
        }
      }
    } else {
      /**
       * ⚠️ Purana revoke naye grant ke baad pahuncha? To use chhod do.
       *
       * Webhook tarteeb se nahi aate (retry, der). Ek purana EXPIRATION agar
       * abhi-abhi aaye RENEWAL ke baad pahunche, to bina is jaanch ke wo taaza
       * renew hua Plus mita deta. `event_at` na ho to jaanch nahi ho sakti —
       * pehle jaisa revoke.
       */
      const latest = ev.eventAt
        ? await latestGrantEventAt(ev.userId, Array.from(GRANTS), { includeSandbox: sandbox })
        : null;
      if (latest && ev.eventAt && new Date(latest).getTime() > new Date(ev.eventAt).getTime()) {
        revoke = "stale";
      } else {
        revoke = await deactivatePlus(ev.userId, { refund: ev.type === "REFUND" });
      }
    }
  } catch (e) {
    void logServerError(e, { where: "play/webhook", type: ev.type, user: ev.userId });
    // 500 se RevenueCat dobara bhejta hai — paise le liye aur plan na mile,
    // usse behtar hai retry.
    //
    // ⚠️ Retry par record duplicate nahi hoga: `recordPlayEvent` `event_id` par
    // `ignore-duplicates` karta hai (dekho supabase/play-payments.sql).
    //
    // ⚠️ Par ISI call ne row banayi thi to use hata do. Warna retry par
    // `recorded = false` aata, plan to lag jaata par kharidari ka email kabhi
    // na jaata (poori wajah `forgetPlayEvent` par).
    if (recorded && ev.eventId) await forgetPlayEvent(ev.eventId);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: ev.action, recorded, revoke });
}
