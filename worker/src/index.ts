/**
 * Render worker — poll, claim, render, upload (11.7 / 11.8 / 11.9 / 11.12).
 *
 * ```
 * npm run dev:worker
 * ```
 *
 * ⚠️ **Koi Redis / BullMQ nahi.** Queue `reel_render_jobs` table hai aur claim
 * `for update skip locked` se hota hai (`reel_claim_render_job`). Do worker ek
 * saath chalane par bhi ek job do baar nahi uthti. Ek aur service khadi karne ka
 * matlab hota ek aur cheez jo chalu rakhni padti, aur ek aur jagah jo alag se
 * toot sakti — jabki Postgres ye kaam pehle se karta hai.
 *
 * ⚠️ **Worker sirf is machine par chalta hai.** Vercel par ye kabhi nahi jaata:
 * Chrome Headless (~150MB) aur ffmpeg wahan hote hi nahi, aur render minute
 * bhar chalta hai — serverless me wo timeout ho jaata.
 */

import { mkdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { hostname } from "node:os";
import { readFile } from "node:fs/promises";

import {
  requireExportPreset,
  parseDoc,
  storageKey,
  type Doc,
} from "@reel/core";
import {
  audioStream,
  finalizeMp4,
  makeThumbnail,
  measureEbur128,
  probe,
  videoStream,
} from "@reel/media";
import {
  createStorageDriver,
  readStorageConfig,
  resolveAssets,
  type StoredAsset,
} from "@reel/storage";

import { asJob, patch, readDbConn, rows, rpc, select, upsert, type DbConn, type RenderJobRow } from "./db";
import { RemotionRenderEngine } from "./engines/remotion";

/* ------------------------------------------------------------------ config */

/** Queue kitni der me dobara dekhi jaaye. */
const POLL_INTERVAL_MS = Number(process.env.REEL_WORKER_POLL_MS ?? 2000);

/**
 * Progress DB me kitni der me ek baar likhein.
 *
 * ⚠️ Remotion har frame par progress deta hai — 30fps ki 30 second ki reel me
 * wo 900 baar hota hai. Har baar DB likhna matlab 900 request; queue table par
 * itna likhna doosre worker ke claim ko bhi dheema kar deta hai. UI 2 second me
 * ek baar dekhta hai, isliye 2 second me ek baar likhna kaafi hai.
 */
const PROGRESS_INTERVAL_MS = Number(process.env.REEL_WORKER_PROGRESS_MS ?? 2000);

/** Heartbeat kitni der me (11.13). UI isse "worker offline" pehchanta hai. */
const HEARTBEAT_INTERVAL_MS = Number(process.env.REEL_WORKER_HEARTBEAT_MS ?? 5000);

/** Kitni der tak koi job na mile to atki hui jobs dobara queue me daalein. */
const REQUEUE_EVERY_MS = 60_000;
const STALE_MINUTES = Number(process.env.REEL_WORKER_STALE_MINUTES ?? 15);

/**
 * Ek waqt me kitne render (11.12).
 *
 * Default 1 hai aur ye soch kar hai: render CPU ke saare core khaata hai. Do ek
 * saath chalane se dono dheeme ho jaate hain aur kul samay ghatta nahi — sirf
 * pehli video aane me der lag jaati hai.
 */
const MAX_CONCURRENT = Math.max(1, Number(process.env.REEL_WORKER_CONCURRENCY ?? 1));

const WORKER_ID = process.env.REEL_WORKER_ID ?? `${hostname()}-${process.pid}`;

/* ----------------------------------------------------------------- helpers */

function log(message: string): void {
  console.log(`[reel-worker ${WORKER_ID}] ${message}`);
}

function scratchRoot(): string {
  return resolve(readStorageConfig().local.outputDir, "jobs");
}

/** Job ka status DB me likho. */
async function updateJob(
  conn: DbConn,
  jobId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await patch(conn, `/reel_render_jobs?id=eq.${jobId}`, fields);
}

/** Job abhi bhi chalni chahiye? (Cancel UI se aata hai — DB me dikhta hai.) */
async function isStillRunning(conn: DbConn, jobId: string): Promise<boolean> {
  const list = rows(await select(conn, `/reel_render_jobs?id=eq.${jobId}&select=status`));
  const status = list[0]?.status;
  return status === "processing";
}

/* --------------------------------------------------------------- heartbeat */

/**
 * Har kuch second DB me apna waqt likh do (11.13).
 *
 * Iske bina UI ke paas do hi raaste bachte, aur dono jhooth hote: hamesha
 * "worker chal raha hai" dikhana (job atki rehti aur wajah samajh nahi aati),
 * ya job ke queue me hone se andaaza lagana (worker abhi shuru hua ho to wo bhi
 * galat).
 */
async function heartbeat(conn: DbConn, currentJob: string | null): Promise<void> {
  try {
    await upsert(conn, "/reel_workers", {
      id: WORKER_ID,
      last_seen: new Date().toISOString(),
      current_job: currentJob,
      version: "phase-11",
    });
  } catch (error) {
    // Heartbeat fail hona render rokne layak nahi hai — sirf UI ka nishaan hai.
    log(`heartbeat fail: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/* ------------------------------------------------------------- ek job ka kaam */

interface JobOutcome {
  status: "completed" | "failed" | "cancelled";
  error?: string;
}

async function runJob(conn: DbConn, job: RenderJobRow): Promise<JobOutcome> {
  const preset = requireExportPreset(job.preset);
  const storage = createStorageDriver();
  const jobDir = resolve(scratchRoot(), job.id);
  const publicDir = resolve(jobDir, "public");
  const rawPath = resolve(jobDir, "raw.mp4");
  const finalPath = resolve(jobDir, "final.mp4");
  const thumbPath = resolve(jobDir, "thumb.jpg");

  const abort = new AbortController();
  let cancelled = false;

  /*
   * Cancel ka poll (11.9). Render minute bhar chal sakta hai; uske beech me DB
   * dekhte rehna hi ek raasta hai — UI se cancel dabate hi status badal jaata
   * hai aur yahan pata chal jaata hai.
   */
  const cancelTimer = setInterval(() => {
    void (async () => {
      if (await isStillRunning(conn, job.id)) return;
      cancelled = true;
      abort.abort();
    })();
  }, PROGRESS_INTERVAL_MS);

  let lastProgressAt = 0;

  try {
    await mkdir(publicDir, { recursive: true });

    /*
     * ⚠️ Doc **job se** aata hai, `reel_projects` se nahi. Job ke chalte hue
     * editing karna bilkul normal hai; project se padhne par aadhe render ke
     * beech doc badal jaata aur output me aadha purana aadha naya aa jaata —
     * aur wajah kabhi samajh nahi aati. Isliye export ke waqt doc ki copy job
     * me jama ho chuki hoti hai.
     */
    const doc: Doc = parseDoc(job.doc);

    // 1. Assets disk par utaaro.
    await updateJob(conn, job.id, { progress: 2 });
    const assetIds = new Set<string>();
    for (const item of doc.items) if (item.assetId) assetIds.add(item.assetId);

    const stored: StoredAsset[] = [];
    for (const id of assetIds) {
      const list = rows(
        await select(conn, `/reel_assets?id=eq.${id}&select=id,key,filename`),
      );
      const row = list[0];
      if (!row) continue;
      stored.push({
        id: String(row.id),
        key: String(row.key),
        ...(row.filename ? { filename: String(row.filename) } : {}),
      });
    }

    const assets = await resolveAssets(doc, stored, storage, { publicDir });
    if (cancelled) return { status: "cancelled" };

    // 2. Render.
    const engine = new RemotionRenderEngine();
    const result = await engine.render({
      doc,
      assets,
      publicDir,
      outPath: rawPath,
      preset: job.preset,
      abortSignal: abort.signal,
      onProgress: ({ progress, stage }) => {
        const now = Date.now();
        if (now - lastProgressAt < PROGRESS_INTERVAL_MS) return;
        lastProgressAt = now;
        // 0..90 render ka hissa; baaki 10 finalize + upload ke liye.
        void updateJob(conn, job.id, {
          progress: Math.min(90, Math.round(progress * 90)),
          meta: { ...job.meta, stage },
        }).catch(() => {
          // Progress likhna fail hona render rokne layak nahi hai.
        });
      },
    });
    if (cancelled) return { status: "cancelled" };

    // 3. Aakhri FFmpeg pass — faststart + loudness (11.2 / 11.3).
    await updateJob(conn, job.id, { progress: 92 });
    const finalize = await finalizeMp4(rawPath, finalPath, {
      normalizeLoudness: true,
      audioBitrateKbps: preset.audioBitrateKbps,
    });
    if (cancelled) return { status: "cancelled" };

    // 4. Naapo — ye numbers DB me jaate hain, andaaza nahi.
    const probed = await probe(finalPath);
    const video = videoStream(probed);
    const audio = audioStream(probed);
    const loudness = await measureEbur128(finalPath);

    // 5. Thumbnail.
    await makeThumbnail("frame", finalPath, thumbPath, {
      durationMs: Math.round((Number(probed.format.duration ?? 0) || 0) * 1000),
    });

    // 6. Upload.
    await updateJob(conn, job.id, { progress: 95 });
    const outKey = storageKey.reel(job.id);
    const thumbKey = storageKey.thumbnail(job.id);

    await storage.put(outKey, new Uint8Array(await readFile(finalPath)), "video/mp4");
    try {
      await storage.put(thumbKey, new Uint8Array(await readFile(thumbPath)), "image/jpeg");
    } catch {
      // Thumbnail na bane to render phir bhi kaam ka hai — sirf history me
      // tasveer nahi dikhegi.
    }

    const { size } = await stat(finalPath);
    await updateJob(conn, job.id, {
      status: "completed",
      progress: 100,
      output_r2_key: outKey,
      output_thumb_key: thumbKey,
      output_bytes: size,
      duration_ms: result.totalMs,
      finished_at: new Date().toISOString(),
      error: null,
      meta: {
        ...job.meta,
        stage: "done",
        renderMs: result.renderMs,
        frames: result.frames,
        preset: job.preset,
        video: {
          codec: video?.codec_name ?? null,
          profile: video?.profile ?? null,
          pixelFormat: video?.pix_fmt ?? null,
          width: video?.width ?? null,
          height: video?.height ?? null,
          frameRate: video?.r_frame_rate ?? null,
          bitRate: probed.format.bit_rate ?? null,
        },
        audio: {
          codec: audio?.codec_name ?? null,
          sampleRate: audio?.sample_rate ?? null,
          channels: audio?.channels ?? null,
        },
        loudness: {
          integratedLufs: loudness.integratedLufs,
          truePeakDb: loudness.truePeakDb,
          lra: loudness.lra,
          normalized: finalize.normalized,
          skippedReason: finalize.skippedReason,
        },
      },
    });

    log(`job ${job.id} poori — ${(size / 1_000_000).toFixed(1)} MB, ${(result.totalMs / 1000).toFixed(1)}s`);
    return { status: "completed" };
  } catch (error) {
    if (cancelled) return { status: "cancelled" };
    const message = error instanceof Error ? error.message : String(error);
    return { status: "failed", error: message };
  } finally {
    clearInterval(cancelTimer);
    /*
     * Beech ka maal hamesha saaf. Ek job ka scratch ~sau MB ka ho sakta hai
     * (assets ki copy + raw MP4); paanch render ke baad disk bharna shuru ho
     * jaata hai aur wajah kisi ko nahi dikhti.
     */
    await rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

/* --------------------------------------------------------------- main loop */

async function main(): Promise<void> {
  const conn = readDbConn();
  const config = readStorageConfig();

  log(`chalu — storage driver "${config.driver}", concurrency ${MAX_CONCURRENT}`);
  log(`queue har ${POLL_INTERVAL_MS}ms dekhi jaayegi. Rokne ke liye Ctrl+C.`);

  let running = 0;
  let stopping = false;
  let lastRequeueAt = 0;

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    log("band ho raha hai — chal rahi job poori hone do (Ctrl+C dobara = turant).");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const heartbeatTimer = setInterval(() => void heartbeat(conn, null), HEARTBEAT_INTERVAL_MS);
  await heartbeat(conn, null);

  while (!stopping) {
    try {
      /*
       * Atki hui jobs wapas queue me (11.8). Worker crash ho jaaye to uski job
       * `processing` par jam jaati hai aur koi doosra use uthata nahi — ye
       * function unhe `claimed_at` ki umar dekh kar wapas `queued` kar deta hai.
       * `max_attempts` uske baad bhi loop nahi banne deta.
       */
      if (Date.now() - lastRequeueAt > REQUEUE_EVERY_MS) {
        lastRequeueAt = Date.now();
        const requeued = rows(await rpc(conn, "reel_requeue_stale_jobs", { p_minutes: STALE_MINUTES }));
        if (requeued.length > 0) log(`${requeued.length} atki hui job wapas queue me`);
      }

      if (running >= MAX_CONCURRENT) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const job = asJob(await rpc(conn, "reel_claim_render_job", { p_worker: WORKER_ID }));
      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      running += 1;
      log(`job ${job.id} uthayi (preset ${job.preset}, koshish ${job.attempts})`);
      void heartbeat(conn, job.id);

      void runJob(conn, job)
        .then(async (outcome) => {
          if (outcome.status === "completed") return;

          if (outcome.status === "cancelled") {
            log(`job ${job.id} cancel hui`);
            await updateJob(conn, job.id, {
              status: "cancelled",
              finished_at: new Date().toISOString(),
            }).catch(() => {});
            return;
          }

          /*
           * Fail — aur yahi wo jagah hai jahan "infinite retry" ban jaata hai.
           * `attempts` DB me badhta hai (claim function me), isliye teesri
           * koshish ke baad job `failed` par rukti hai aur queue saaf rehti hai.
           */
          const canRetry = job.attempts < job.max_attempts;
          log(`job ${job.id} fail: ${outcome.error} ${canRetry ? "(dobara koshish hogi)" : "(aur koshish nahi)"}`);
          await updateJob(conn, job.id, {
            status: canRetry ? "queued" : "failed",
            error: outcome.error ?? "anjaan error",
            ...(canRetry ? { claimed_at: null, worker_id: null } : { finished_at: new Date().toISOString() }),
          }).catch(() => {});
        })
        .finally(() => {
          running -= 1;
          void heartbeat(conn, null);
        });
    } catch (error) {
      // Loop ko kabhi marne nahi dena — network ek second ke liye gaya ho to
      // worker ko band nahi hona chahiye.
      log(`loop error: ${error instanceof Error ? error.message : String(error)}`);
      await sleep(POLL_INTERVAL_MS * 2);
    }
  }

  clearInterval(heartbeatTimer);
  while (running > 0) await sleep(500);
  log("band.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

void main().catch((error: unknown) => {
  console.error(`[reel-worker] shuru hi nahi ho paaya: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
