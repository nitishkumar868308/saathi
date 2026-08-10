import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { playBillingEnabled, playBillingStatus } from "@/lib/play-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Admin > Payments — har Play / RevenueCat event, aur upar ke totals.
 *
 * `payments` par koi public policy nahi hai (RLS on, policy zero), isliye ye
 * data sirf service_role se aata hai — yaani sirf isi route se, aur wo bhi
 * `guard("payments")` ke peeche. Kisi user ko doosre ka transaction kabhi nahi
 * dikhna chahiye.
 *
 * ⚠️ Ye screen Play Console live hone se PEHLE hi taiyaar hai. Live hote hi
 * pehla event isme dikhega — kuch aur karne ki zaroorat nahi. `playBilling`
 * wala flag response me isliye jaata hai ki khaali screen ki wajah saaf rahe:
 * "abhi koi payment nahi hua" aur "webhook abhi chalu hi nahi hai" do bilkul
 * alag baatein hain, aur unhe ek jaisa dikhana wo galti hai jisme sabse zyada
 * waqt jaata hai.
 */

/** "today" | "7" | "30" | "90" | "all" -> ISO range */
function rangeOf(key: string): { from?: string; to?: string } {
  const day = 86400000;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  switch (key) {
    case "today":
      return { from: start.toISOString() };
    case "7":
      return { from: new Date(start.getTime() - 6 * day).toISOString() };
    case "30":
      return { from: new Date(start.getTime() - 29 * day).toISOString() };
    case "90":
      return { from: new Date(start.getTime() - 89 * day).toISOString() };
    default:
      return {};
  }
}

export type PaymentRow = {
  id: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  eventType: string | null;
  productId: string | null;
  store: string | null;
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  periodType: string | null;
  environment: string | null;
  status: string | null;
  expiresAt: string | null;
  at: string;
};

export type PaymentTotals = {
  events: number;
  payers: number;
  refunds: number;
  trials: number;
  sandbox: number;
  /** Currency ke hisaab se alag — ₹ aur $ ko jodna jhooth hota. */
  revenue: Record<string, number>;
};

export async function GET(request: Request) {
  const g = await guard("payments");
  if (!g.ok) return g.res;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const range = rangeOf(url.searchParams.get("range") ?? "30");

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_payments`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_from: range.from ?? null,
        p_to: range.to ?? null,
        p_limit: 500,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text();
      // 404 ka matlab lagbhag hamesha ek hi hota hai: migration chali hi nahi.
      // Use aam "load failed" me chhupa dena wo ek din bekaar kar deta hai jo
      // wajah dhoondhne me jaata hai.
      const missing =
        res.status === 404 || /does not exist|PGRST202|schema cache/i.test(detail);
      return NextResponse.json(
        {
          error: missing ? "migration_missing" : "read failed",
          detail: missing ? "supabase/play-payments.sql chalao" : detail.slice(0, 300),
        },
        { status: missing ? 503 : 500 },
      );
    }

    const body = (await res.json()) as {
      rows?: PaymentRow[];
      totals?: PaymentTotals;
    };

    return NextResponse.json({
      rows: body.rows ?? [],
      totals: body.totals ?? {
        events: 0,
        payers: 0,
        refunds: 0,
        trials: 0,
        sandbox: 0,
        revenue: {},
      },
      // Khaali screen ki wajah — upar wala doc-comment dekho.
      playBilling: { on: playBillingEnabled(), status: playBillingStatus() },
    });
  } catch (err) {
    console.error("[admin/payments]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}
