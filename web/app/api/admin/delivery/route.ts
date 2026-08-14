import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getDeliveryHealth } from "@/lib/delivery-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "WhatsApp/email chal raha hai ya nahi — aur nahi, to kahan atka hai?"
 *
 * Admin > Logs ke sabse upar wala card isi se banta hai. Poori soch
 * `lib/delivery-health.ts` par likhi hai.
 *
 * ⚠️ `guard("logs")` — koi naya menu nahi banaya. Jis admin ko Logs dikhte hain
 * usi ko ye bhi dikhna chahiye: ye us page ka hissa hai, alag cheez nahi. Naya
 * menu banane ka matlab hota ki har team member ko permission dobara deni padti,
 * aur tab tak ye card unke liye chup-chaap khaali rehta.
 */
export async function GET() {
  const g = await guard("logs");
  if (!g.ok) return g.res;
  try {
    return NextResponse.json(await getDeliveryHealth());
  } catch (err) {
    console.error("[admin/delivery]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}
