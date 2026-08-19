import { restJson, restOne } from "@/lib/supabase";

/**
 * Transcribe job ka data layer (23.10).
 *
 * ⚠️ Ye usi `reel_render_jobs` table me `kind = 'transcribe'` ke saath baithti
 * hai — alag table nahi. Wajah `supabase/reel-studio-jobs.sql` me poori likhi
 * hai: queue, claim, progress, cancel, retry, requeue aur heartbeat — ye sab
 * transcription ko bhi bilkul waise hi chahiye. Doosri table matlab ye poora
 * saamaan dobara likhna, aur ek din wo do jagah alag ho jaata.
 */

export interface TranscribeJobRow {
  id: string;
  project_id: string;
  kind: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  error: string | null;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
}

const FIELDS = "id,project_id,kind,status,progress,error,input,result,created_at,finished_at";

export interface CreateTranscribeJobInput {
  projectId: string;
  assetId: string;
  /** `auto` ya `hi` / `en` — whisper ko wahi jaata hai. */
  language: string;
  model: string;
  /**
   * Text pehle se pata ho (TTS se bani awaaz) to yahan bhejo — tab whisper
   * chalta hi nahi, sirf timing nikalti hai (23.5).
   */
  text?: string;
}

export async function createTranscribeJob(
  input: CreateTranscribeJobInput,
): Promise<TranscribeJobRow> {
  const row = await restOne<TranscribeJobRow>("/reel_render_jobs", {
    method: "POST",
    body: {
      project_id: input.projectId,
      kind: "transcribe",
      /*
       * ⚠️ `doc` yahan nahi jaata — transcribe job ko uska koi kaam nahi (usse
       * ek audio file chahiye), aur poora doc 100KB+ ka hota hai. DB me shart
       * lagi hai ki `doc` sirf render jobs me zaroori hai.
       */
      preset: "draft",
      input: {
        assetId: input.assetId,
        language: input.language,
        model: input.model,
        ...(input.text ? { text: input.text } : {}),
      },
    },
    prefer: "return=representation",
  });
  if (!row) throw new Error("Transcribe job ban to gayi par DB ne wapas kuch nahi bheja");
  return row;
}

export async function getTranscribeJob(jobId: string): Promise<TranscribeJobRow | null> {
  const rows = await restJson<TranscribeJobRow>(
    `/reel_render_jobs?id=eq.${jobId}&select=${FIELDS}`,
  );
  return rows[0] ?? null;
}
