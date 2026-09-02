import { parseDoc, readWizardMemory, type Doc } from "@reel/core";

import { rest, restJson, restOne } from "@/lib/supabase";

/**
 * `reel_render_jobs` ka data layer — server side (11.6 / 11.10 / 11.11).
 *
 * ⚠️ **Doc job ke saath jama hota hai** (frozen snapshot). Ye Phase 2 ka faisla
 * hai aur uski wajah har render me dikhti hai: job chalte hue editing karna
 * bilkul normal hai. Worker agar `reel_projects` se doc padhta to aadhe render
 * ke beech doc badal jaata aur output me aadha purana aadha naya aa jaata — aur
 * wajah kabhi samajh nahi aati.
 */

export interface RenderJobRow {
  id: string;
  project_id: string;
  preset: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  error: string | null;
  output_r2_key: string | null;
  output_thumb_key: string | null;
  output_bytes: number | null;
  duration_ms: number | null;
  worker_id: string | null;
  attempts: number;
  max_attempts: number;
  meta: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface RenderJob {
  id: string;
  projectId: string;
  preset: string;
  status: RenderJobRow["status"];
  progress: number;
  error: string | null;
  outputKey: string | null;
  thumbKey: string | null;
  bytes: number | null;
  durationMs: number | null;
  workerId: string | null;
  attempts: number;
  maxAttempts: number;
  /** Worker ka naapa hua data — codec, loudness, waqt. `{}` jab tak render na ho. */
  meta: Record<string, unknown>;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Job ki list me `doc` kabhi nahi jaata — wo 100KB+ ka ho sakta hai. */
const JOB_FIELDS =
  "id,project_id,preset,status,progress,error,output_r2_key,output_thumb_key," +
  "output_bytes,duration_ms,worker_id,attempts,max_attempts,meta,created_at,started_at,finished_at";

function toJob(row: RenderJobRow): RenderJob {
  return {
    id: row.id,
    projectId: row.project_id,
    preset: row.preset,
    status: row.status,
    progress: row.progress,
    error: row.error,
    outputKey: row.output_r2_key,
    thumbKey: row.output_thumb_key,
    bytes: row.output_bytes,
    durationMs: row.duration_ms,
    workerId: row.worker_id,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    meta: row.meta ?? {},
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export interface CreateRenderJobInput {
  projectId: string;
  preset: string;
  /** Export ke waqt ka doc — yahi jama hota hai. */
  doc: Doc;
}

export async function createRenderJob(input: CreateRenderJobInput): Promise<RenderJob> {
  const row = await restOne<RenderJobRow>("/reel_render_jobs", {
    method: "POST",
    body: {
      project_id: input.projectId,
      preset: input.preset,
      // Schema se guzaar kar — aadha-adhoora doc job me jama ho jaaye to render
      // ke waqt phat'ta hai, aur tab tak user ja chuka hota hai.
      doc: parseDoc(input.doc),
      /*
       * ⚠️ Ek sasta nishaan, taaki "Wizard me kholo" dikhane ke liye poora doc na
       * padhna pade. Job ki list me `doc` jaan-boojhkar nahi aata (upar dekho),
       * aur har row par ek doc padhna matlab renders panel kholte hi kai sau KB.
       *
       * ⚠️ Worker apna `meta` likhte waqt `...job.meta` phailata hai, isliye ye
       * render poora hone ke baad bhi bacha rehta hai — aur zaroorat theek usi
       * waqt padti hai.
       */
      meta: { hasWizard: readWizardMemory(input.doc.meta.wizard) !== null },
    },
    prefer: "return=representation",
  });
  if (!row) throw new Error("Render job ban to gayi par DB ne wapas kuch nahi bheja");
  return toJob(row);
}

export async function getRenderJob(jobId: string): Promise<RenderJob | null> {
  const rows = await restJson<RenderJobRow>(
    `/reel_render_jobs?id=eq.${jobId}&select=${JOB_FIELDS}`,
  );
  const row = rows[0];
  return row ? toJob(row) : null;
}

export async function listRenderJobs(projectId: string, limit = 25): Promise<RenderJob[]> {
  const rows = await restJson<RenderJobRow>(
    `/reel_render_jobs?project_id=eq.${projectId}&select=${JOB_FIELDS}` +
      `&order=created_at.desc&limit=${limit}`,
  );
  return rows.map(toJob);
}

/**
 * Cancel (11.9).
 *
 * ⚠️ Sirf `queued` aur `processing` cancel hoti hain, aur ye shart **query me**
 * hai (`status=in.(...)`) — pehle padho-phir-likho karne se ek race bacha reh
 * jaata: job us beech me poori ho jaaye to hum ek poori ho chuki job ko
 * "cancelled" likh dete, aur user ki ban chuki video gayab ho jaati.
 *
 * Worker ko batane ke liye koi alag channel nahi chahiye — wo har do second me
 * DB dekhta hai aur status badalte hi ruk jaata hai.
 */
export async function cancelRenderJob(jobId: string): Promise<RenderJob | null> {
  const rows = await restJson<RenderJobRow>(
    `/reel_render_jobs?id=eq.${jobId}&status=in.(queued,processing)&select=${JOB_FIELDS}`,
    {
      method: "PATCH",
      body: { status: "cancelled", finished_at: new Date().toISOString() },
      prefer: "return=representation",
    },
  );
  const row = rows[0];
  return row ? toJob(row) : null;
}

/* ------------------------------------------------------------- worker ka haal */

export interface WorkerStatus {
  /** Koi worker pichhle kuch second me bola? */
  online: boolean;
  workerId: string | null;
  lastSeen: string | null;
  currentJob: string | null;
  /** Kitne second se chup hai. */
  secondsAgo: number | null;
}

/**
 * Worker zinda hai ya nahi — **heartbeat se** (11.13).
 *
 * ⚠️ Ye number thoda udaar hai (20 second), aur jaan-boojhkar: worker har 5
 * second me likhta hai, par render ke beech ek bhari frame par wo thoda late ho
 * sakta hai. Sakht hadd rakhne par UI beech-beech me "offline" jhalkata rehta —
 * jo galat alarm se bhi bura hai, kyunki phir koi use dekhta hi nahi.
 */
export const WORKER_OFFLINE_AFTER_SECONDS = 20;

export async function workerStatus(): Promise<WorkerStatus> {
  const rows = await restJson<{ id: string; last_seen: string; current_job: string | null }>(
    "/reel_workers?select=id,last_seen,current_job&order=last_seen.desc&limit=1",
  );

  const row = rows[0];
  if (!row) {
    return { online: false, workerId: null, lastSeen: null, currentJob: null, secondsAgo: null };
  }

  const secondsAgo = Math.round((Date.now() - new Date(row.last_seen).getTime()) / 1000);
  return {
    online: secondsAgo <= WORKER_OFFLINE_AFTER_SECONDS,
    workerId: row.id,
    lastSeen: row.last_seen,
    currentJob: row.current_job,
    secondsAgo,
  };
}

/** Job ka frozen doc — sirf tab jab sach me chahiye (bada hota hai). */
export async function getRenderJobDoc(jobId: string): Promise<Doc | null> {
  const rows = await restJson<{ doc: unknown }>(`/reel_render_jobs?id=eq.${jobId}&select=doc`);
  const row = rows[0];
  return row ? parseDoc(row.doc) : null;
}

/** Purane render ki file hata do (history se delete par). */
export async function deleteRenderJob(jobId: string): Promise<void> {
  await rest(`/reel_render_jobs?id=eq.${jobId}`, { method: "DELETE" });
}
