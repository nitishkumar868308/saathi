import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { estimateAiCost, parseAiRates } from "@/lib/reel-cost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * AI Reel Studio ka haal — admin ke "Reel Studio" tab ke liye (21.11).
 *
 * Chaar sawaal ek jagah:
 *   1. **AI aur voice par kitna laga** — `service_usage` me `service='reel-studio'`
 *   2. **Kitni reel bani, kitni giri** — `reel_render_jobs`
 *   3. **Storage kitna bhara** — `reel_assets`
 *   4. **Render wala worker zinda hai ya nahi** — `reel_workers`
 *
 * ⚠️ Ye `spend` se **alag** menu hai aur alag hi rehna chahiye. `spend` poore
 * product ka bill hai (Gemini chat, Twilio, email); ye sirf reel banane ka
 * hisaab hai. Dono ek jagah daalne par "reel me kitna laga" ka jawab kabhi alag
 * se milta hi nahi.
 *
 * ⚠️ Kharcha yahan **padhte waqt** gina jaata hai (`lib/reel-cost.ts` dekho),
 * likhte waqt nahi. DB me sirf tokens jaate hain — jo sach me naape gaye hain.
 * Rate `REEL_AI_RATES` me set ho to rupya banta hai, warna `null` jaata hai aur
 * UI saaf-saaf "rate set nahi" likhti hai.
 *
 * ⚠️ Har table alag se fail ho sakti hai aur ye jaan-boojh ke hai (`sb()` khaali
 * array lautati hai). Jab tak koi ek SQL file chalayi nahi gayi, us hisse ka
 * jawab khaali aayega — par baaki teen dikhte rahenge. Poora panel 500 dena
 * yahan sabse bekaar jawab hota: aadhi jaankari bhi kuch na hone se behtar hai.
 */

export type ReelUsageRow = {
  kind: string;
  calls: number;
  units: number;
  failures: number;
  /** Cache se aayi calls — TTS me ye seedha bacha hua paisa hai. */
  cached: number;
  /** Rupya, agar rate pata ho. `null` = "pata nahi" — `0` se alag cheez. */
  cost: number | null;
  /** Kitni calls ka kharcha gina hi nahi ja saka. UI isi se imaandaar rehti hai. */
  costUnknownCalls: number;
  avgMs: number | null;
  last_at: string | null;
};

export type ReelStudioData = {
  usage: ReelUsageRow[];
  renders: { status: string; count: number; bytes: number }[];
  assets: { lifecycle: string; count: number; bytes: number }[];
  workers: { id: string; last_seen: string; current_job: string | null; version: string | null }[];
  /** Roz ke tokens — chart ke liye, purane se naye. */
  daily: { day: string; kind: string; units: number; calls: number }[];
  /** `REEL_AI_RATES` set hai ya nahi — UI ko yahi batata hai ki kharcha kyun gayab hai. */
  ratesConfigured: boolean;
};

type UsageMeta = {
  model?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  ms?: number;
  cached?: boolean;
};

function rangeFrom(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function sb<T>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY as string,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const gate = await guard("reelStudio");
  if (!gate.ok) return gate.res;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Supabase set nahi hai" }, { status: 500 });
  }

  const asked = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = Number.isFinite(asked) && asked > 0 ? Math.min(365, asked) : 30;
  const from = rangeFrom(days);
  const rates = parseAiRates(process.env.REEL_AI_RATES);

  /*
   * Raw rows aate hain, jod yahan hota hai. PostgREST me group-by karne ke liye
   * ek view banani padti; ek local studio ke itne chhote data par wo bojh faayde
   * se zyada hai. Aur kharcha waise bhi row-dar-row hi ginna padta — har row ka
   * model alag ho sakta hai.
   */
  const usageRows = await sb<{
    kind: string;
    units: number;
    ok: boolean;
    meta: UsageMeta | null;
    created_at: string;
  }>(
    `service_usage?select=kind,units,ok,meta,created_at&service=eq.reel-studio` +
      `&created_at=gte.${from}&order=created_at.desc&limit=5000`,
  );

  const byKind = new Map<string, ReelUsageRow & { msSum: number; msCount: number }>();
  const byDay = new Map<string, { day: string; kind: string; units: number; calls: number }>();

  for (const row of usageRows) {
    const entry = byKind.get(row.kind) ?? {
      kind: row.kind,
      calls: 0,
      units: 0,
      failures: 0,
      cached: 0,
      cost: null as number | null,
      costUnknownCalls: 0,
      avgMs: null as number | null,
      last_at: null as string | null,
      msSum: 0,
      msCount: 0,
    };

    entry.calls += 1;
    entry.units += Number(row.units ?? 0);
    if (!row.ok) entry.failures += 1;
    if (row.meta?.cached === true) entry.cached += 1;
    if (typeof row.meta?.ms === "number") {
      entry.msSum += row.meta.ms;
      entry.msCount += 1;
    }
    if (!entry.last_at || row.created_at > entry.last_at) entry.last_at = row.created_at;

    const cost = estimateAiCost(
      {
        inputTokens: row.meta?.inputTokens ?? null,
        outputTokens: row.meta?.outputTokens ?? null,
      },
      rates,
      row.meta?.model,
    );
    // ⚠️ `null` ko 0 maan kar jod dena hi wo galti hai jise ye poora hissa rok
    // raha hai — jinka kharcha pata nahi wo alag se gine jaate hain, jod me
    // milaye nahi jaate. Warna "2 rupya" wahan bhi dikhta jahan sach me 200 lage hon.
    if (cost === null) entry.costUnknownCalls += 1;
    else entry.cost = (entry.cost ?? 0) + cost;

    byKind.set(row.kind, entry);

    const day = row.created_at.slice(0, 10);
    const key = `${day}:${row.kind}`;
    const d = byDay.get(key) ?? { day, kind: row.kind, units: 0, calls: 0 };
    d.units += Number(row.units ?? 0);
    d.calls += 1;
    byDay.set(key, d);
  }

  const usage: ReelUsageRow[] = Array.from(byKind.values())
    .map(({ msSum, msCount, ...rest }) => ({
      ...rest,
      avgMs: msCount > 0 ? Math.round(msSum / msCount) : null,
    }))
    .sort((a, b) => b.units - a.units);

  const renderRows = await sb<{ status: string; output_bytes: number | null }>(
    `reel_render_jobs?select=status,output_bytes&created_at=gte.${from}&limit=5000`,
  );
  const byStatus = new Map<string, { status: string; count: number; bytes: number }>();
  for (const row of renderRows) {
    const entry = byStatus.get(row.status) ?? { status: row.status, count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += Number(row.output_bytes ?? 0);
    byStatus.set(row.status, entry);
  }

  // ⚠️ Assets par date ki rok jaan-boojh ke nahi hai. Sawaal "is hafte kitna
  // bana" nahi, "abhi kitna bhara hua hai" hai — aur purani permanent file usi
  // jagah ghere baithi hai jitni kal wali.
  const assetRows = await sb<{ lifecycle: string; bytes: number | null }>(
    `reel_assets?select=lifecycle,bytes&limit=5000`,
  );
  const byLifecycle = new Map<string, { lifecycle: string; count: number; bytes: number }>();
  for (const row of assetRows) {
    const entry = byLifecycle.get(row.lifecycle) ?? { lifecycle: row.lifecycle, count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += Number(row.bytes ?? 0);
    byLifecycle.set(row.lifecycle, entry);
  }

  const workers = await sb<{
    id: string;
    last_seen: string;
    current_job: string | null;
    version: string | null;
  // ⚠️ Sirf 5. Worker ka id har baar naya banta hai (process ke saath), isliye
  // ye table sirf badhti jaati hai — purani rows "toote hue worker" nahi, bas
  // itihaas hain. 20 dikhane par wo itihaas 5 laal cards jaisa padha jaata.
  }>(`reel_workers?select=id,last_seen,current_job,version&order=last_seen.desc&limit=5`);

  const data: ReelStudioData = {
    usage,
    renders: Array.from(byStatus.values()).sort((a, b) => b.count - a.count),
    assets: Array.from(byLifecycle.values()).sort((a, b) => b.bytes - a.bytes),
    workers,
    daily: Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day)),
    ratesConfigured: Object.keys(rates).length > 0,
  };

  return NextResponse.json(data);
}
