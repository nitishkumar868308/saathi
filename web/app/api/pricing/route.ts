import { NextResponse } from "next/server";
import { resolvePrice } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Visitor ke IP-country ka price — website isse hi daam dikhati hai.
 *
 * Country kahan se: hosting khud batati hai (header me), hum khud IP dekh kar
 * andaaza nahi lagate. Ek se zyada header isliye ki site Vercel par bhi chal
 * sakti hai aur Cloudflare ke peeche bhi — jo mile wahi le lo:
 *
 *   x-vercel-ip-country   Vercel
 *   cf-ipcountry          Cloudflare
 *
 * `?country=XX` sabse upar hai — testing ke liye, aur app ke us modal ke liye
 * jahan user khud chunta hai ki kaunse desh ka daam dekhna hai.
 *
 * ⚠️ Ye sirf DISPLAY hai. Paisa Play user ke ACCOUNT wale desh se kaatta hai,
 *    IP se nahi — isliye VPN se yahan sasta daam "dikh" to sakta hai, mil nahi
 *    sakta. Yahi wajah hai ki IP par bharosa karna yahan surakshit hai.
 */
export async function GET(request: Request) {
  const override = new URL(request.url).searchParams.get("country");
  const ipCountry =
    request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry");
  const code = (override || ipCountry || "IN").toUpperCase();
  const price = await resolvePrice(code);
  return NextResponse.json(price);
}
