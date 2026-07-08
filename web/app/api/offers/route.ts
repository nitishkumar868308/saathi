import { NextResponse } from "next/server";
import { getOffers } from "@/lib/offers";

export const runtime = "nodejs";

/** Public — landing/pricing ka copy live offer numbers se banta hai. */
export async function GET() {
  const offers = await getOffers();
  return NextResponse.json(offers, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" },
  });
}
