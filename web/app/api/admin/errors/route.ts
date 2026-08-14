import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getErrors } from "@/lib/errors-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await guard("logs");
  if (!g.ok) return g.res;
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 7);
  const source = url.searchParams.get("source") ?? "all";

  /**
   * Kab se — client ka bheja hua `since` PEHLE.
   *
   * ⚠️ Ye faisla timezone ka hai. "Aaj" ka matlab ADMIN ki aadhi raat hai
   * (India me IST), aur ye server UTC par chalta hai — yahan se sahi aadhi raat
   * nikaali hi nahi ja sakti. Isliye wo hisaab browser karta hai
   * (`components/AdminLogs.tsx` ka `sinceFor`), jise apna timezone pata hai.
   *
   * `days` wala purana raasta fallback ke liye bacha hai (koi seedha URL khole,
   * ya purana cached JS chal raha ho). Wo rolling 24-ghante wala hisaab hai —
   * theek wahi jo "Aaj" ko jhootha bana raha tha, isliye ab wo sirf aakhri
   * sahara hai.
   */
  const raw = url.searchParams.get("since");
  const fromClient = raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : null;
  // Bahut purani/aage ki date na chale — ek galat param poora table utaar leta.
  const sane =
    fromClient &&
    fromClient.getTime() <= Date.now() &&
    Date.now() - fromClient.getTime() <= 400 * 86400000
      ? fromClient
      : null;

  const since = sane
    ? sane.toISOString()
    : Number.isFinite(days) && days > 0
      ? new Date(Date.now() - days * 86400000).toISOString()
      : undefined;
  try {
    const errors = await getErrors({ since, source });
    return NextResponse.json({ errors });
  } catch (err) {
    console.error("[admin/errors]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}
