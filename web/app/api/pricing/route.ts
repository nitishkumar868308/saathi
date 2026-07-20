import { NextResponse } from "next/server";
import { resolvePrice } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public — user ke IP-country ka local price. Vercel `x-vercel-ip-country`
 * header se country; `?country=XX` override (testing/mismatch) se bhi.
 */
export async function GET(request: Request) {
  const override = new URL(request.url).searchParams.get("country");
  const ipCountry = request.headers.get("x-vercel-ip-country");
  const code = (override || ipCountry || "IN").toUpperCase();
  const price = await resolvePrice(code);
  return NextResponse.json(price);
}
