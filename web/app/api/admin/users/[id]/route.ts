import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getUserDetail, RewardsNotConfigured } from "@/lib/rewards-server";
import { getDeliveryCheck } from "@/lib/delivery-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await guard("users");
  if (!g.ok) return g.res;
  try {
    const detail = await getUserDetail(params.id);
    if (!detail) return NextResponse.json({ error: "user not found" }, { status: 404 });

    /**
     * Delivery ki jaanch alag se, aur fail hone par bhi detail zinda rahe.
     *
     * ⚠️ Ise `getUserDetail` ke andar nahi rakha ja sakta — wo ek SQL RPC
     * (`admin_user_detail`) hai, yaani us me naya field jodne ke liye migration
     * chahiye. Aur `null` par UI ye block chhupa deta hai, poora panel nahi
     * todta: ek diagnostic ke chakkar me user ka record dikhna band ho jaana
     * ulta sauda hota.
     */
    const delivery = await getDeliveryCheck(params.id).catch(() => null);

    return NextResponse.json({ detail, delivery });
  } catch (err) {
    console.error("[admin/users/:id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
