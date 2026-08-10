import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getCountriesList, RewardsNotConfigured } from "@/lib/rewards-server";
import {
  PLAY_PRODUCTS,
  formatMicros,
  getAllPlayPrices,
  getPlaySyncMeta,
  periodOf,
} from "@/lib/play-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin ka Pricing tab — sirf PADHNE ke liye.
 *
 * ⚠️ Yahan pehle PUT aur DELETE bhi the: admin base price (₹99/₹999) aur har
 *    desh ka multiplier + conversion rate likhta tha. Wo poora raasta hata diya
 *    gaya. Plus ka daam ab sirf Google Play Console me set hota hai; ye endpoint
 *    bas dikhata hai ki wahan abhi kya laga hua hai.
 *
 *    Ek bhi write yahan wapas jodne ka matlab hoga daam ke do maalik, aur wahi
 *    purana bug: website ek number dikhaye, Play doosra kaate. Daam badalna ho
 *    to Play Console → phir POST /api/admin/pricing/sync.
 */

function errRes(err: unknown) {
  console.error("[admin/pricing]", err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "failed" },
    { status: err instanceof RewardsNotConfigured ? 503 : 500 },
  );
}

type PlayRegionRow = {
  region: string;
  currency: string;
  monthly: number | null;
  yearly: number | null;
  monthlyLabel: string | null;
  yearlyLabel: string | null;
};

/**
 * Play ki flat rows ko ek desh = ek line me samet do.
 *
 * DB me har (product, base plan, region) ki apni row hoti hai — yaani ek desh
 * ki do rows (monthly + yearly). Admin ko table me ek hi line chahiye jisme
 * dono daam hon.
 */
function groupPlayRows(rows: Awaited<ReturnType<typeof getAllPlayPrices>>): PlayRegionRow[] {
  const byRegion = new Map<string, PlayRegionRow>();
  for (const row of rows) {
    const period = periodOf(row);
    if (!period) continue;
    const entry = byRegion.get(row.region) ?? {
      region: row.region,
      currency: row.currency,
      monthly: null,
      yearly: null,
      monthlyLabel: null,
      yearlyLabel: null,
    };
    entry.currency = row.currency;
    if (period === "monthly") {
      entry.monthly = row.micros;
      entry.monthlyLabel = formatMicros(row.currency, row.micros, `en-${row.region}`);
    } else {
      entry.yearly = row.micros;
      entry.yearlyLabel = formatMicros(row.currency, row.micros, `en-${row.region}`);
    }
    byRegion.set(row.region, entry);
  }
  // India pehle (base market), baaki alphabetical.
  // (`Array.from` — tsconfig ka target ES5 hai, spread yahan chalta nahi.)
  return Array.from(byRegion.values()).sort((a, b) =>
    a.region === "IN" ? -1 : b.region === "IN" ? 1 : a.region.localeCompare(b.region),
  );
}

export async function GET() {
  const g = await guard("pricing");
  if (!g.ok) return g.res;

  try {
    const [countries, playRows, playMeta] = await Promise.all([
      // Sirf desh ke NAAM ke liye (Play "IN" deta hai, "India" nahi).
      getCountriesList().catch(() => []),
      // Play ka hissa poore page ko na girae — table na bani ho to baaki screen
      // (status, "Sync now") phir bhi kaam karni chahiye. Wahi to setup ke waqt
      // sabse zyada chahiye hoti hai.
      getAllPlayPrices().catch(() => []),
      getPlaySyncMeta(),
    ]);

    return NextResponse.json({
      countries,
      play: {
        ...playMeta,
        products: [PLAY_PRODUCTS.monthly, PLAY_PRODUCTS.yearly],
        regions: groupPlayRows(playRows),
      },
    });
  } catch (err) {
    return errRes(err);
  }
}
