import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { playPricesConfigured, playPricesStatus, syncPlayPrices } from "@/lib/play-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin ka "Sync now" — Play Console se price abhi ke abhi utaro.
 *
 * Cron roz chalta hai, par price badalne ka pal hamesha admin ke haath me hota
 * hai: Console me daam badla, yahan aaya, button dabaya, website par live.
 * Uske liye kal tak intezar karwana bewajah hai.
 *
 * ⚠️ Ye Google ki API par jaata hai, isliye `guard` yahan sirf rasm nahi hai.
 *    Bina pehre ke ye ek khula endpoint hota jise koi bhi bar-bar maar kar
 *    hamara Play API quota khatam kar sakta tha.
 *
 * Yahan sync fail hone par 502 lautate hain (cron se ulta, jo 200 deta hai) —
 * kyunki insaan button daba kar saamne baitha hai aur use turant pata chalna
 * chahiye ki nahi hua, aur kyun nahi hua.
 */
export async function POST() {
  const g = await guard("pricing");
  if (!g.ok) return g.res;

  if (!playPricesConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: `Play API chalu nahi hai — ${playPricesStatus()}. Setup: docs/play-prices.md`,
      },
      { status: 503 },
    );
  }

  try {
    const result = await syncPlayPrices();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    console.error("[admin/pricing/sync]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 },
    );
  }
}
