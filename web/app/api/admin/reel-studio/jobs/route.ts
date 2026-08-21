import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Jo video ban chuki hai — aur jo abhi ban rahi hai.
 *
 * ⚠️ Yahan **queue wali** jobs bhi aati hain, sirf ban chuki nahi. Bani hui
 * reel dekhna aadhi baat hai; asli sawaal aksar ulta hota hai — "wo wali kahan
 * atki hai?". Sirf `completed` dikhane par ruki hui job screen par hoti hi
 * nahi, aur uska rukna kisi ko dikhta hi nahi.
 *
 * ⚠️ `error` bhi bheja jaata hai, chhupaya nahi. Fail hui render ka sirf laal
 * badge dikhana matlab har baar server ke log tak jaana — jabki wajah row me
 * likhi hui padi hai.
 */

export type ReelJob = {
  id: string;
  name: string;
  status: string;
  progress: number;
  preset: string;
  bytes: number | null;
  durationMs: number | null;
  /** Storage key — video isi se paros'i jaati hai (`../video`). */
  key: string | null;
  thumbKey: string | null;
  error: string | null;
  workerId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

type Row = {
  id: string;
  status: string;
  progress: number;
  preset: string;
  output_bytes: number | null;
  output_r2_key: string | null;
  output_thumb_key: string | null;
  duration_ms: number | null;
  error: string | null;
  worker_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  project: { name: string } | { name: string }[] | null;
};

/** PostgREST embed ek object bhi de sakta hai aur array bhi — dono sambhalo. */
function projectName(project: Row["project"]): string {
  if (!project) return "—";
  const one = Array.isArray(project) ? project[0] : project;
  return one?.name ?? "—";
}

export async function GET(request: Request) {
  const gate = await guard("reelStudio");
  if (!gate.ok) return gate.res;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Supabase set nahi hai" }, { status: 500 });
  }

  const asked = Number(new URL(request.url).searchParams.get("limit") ?? 40);
  const limit = Number.isFinite(asked) && asked > 0 ? Math.min(200, asked) : 40;

  const select =
    "id,status,progress,preset,output_bytes,output_r2_key,output_thumb_key," +
    "duration_ms,error,worker_id,created_at,started_at,finished_at,project:reel_projects(name)";

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/reel_render_jobs?select=${select}&order=created_at.desc&limit=${limit}`,
    {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json(
      { error: "render jobs padhi nahi ja saki", detail: detail.slice(0, 300) },
      { status: 502 },
    );
  }

  const rows = (await response.json()) as Row[];
  const jobs: ReelJob[] = rows.map((row) => ({
    id: row.id,
    name: projectName(row.project),
    status: row.status,
    progress: row.progress,
    preset: row.preset,
    bytes: row.output_bytes,
    durationMs: row.duration_ms,
    key: row.output_r2_key,
    thumbKey: row.output_thumb_key,
    error: row.error,
    workerId: row.worker_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }));

  return NextResponse.json({ jobs });
}
