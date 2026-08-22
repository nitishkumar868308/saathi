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
 * ⚠️ **Ye Vercel par kabhi nahi jaata.** Chrome Headless (~150MB) aur ffmpeg
 * wahan hote hi nahi, aur render minute bhar chalta hai — serverless me wo
 * timeout ho jaata. Isliye worker do hi jagah chalta hai, aur code dono jagah
 * wahi ka wahi hai:
 *
 *   1. **Tumhara PC** — `npm run dev:worker`. Hamesha chalta rehta hai (daemon).
 *   2. **GitHub Actions ka runner** — `npm run start:once --workspace @reel/worker`.
 *      Ek job aane par machine uthti hai, queue khaali hote hi khud band ho
 *      jaati hai. Dekho `.github/workflows/reel-render.yml` aur
 *      `docs/reel-studio/25-cloud-worker.md`.
 *
 * ⚠️ Cloud par `REEL_STORAGE_DRIVER=r2` **zaroori** hai. Runner ki disk run
 * khatam hote hi mit jaati hai — `local` driver par reel ban to jaayegi aur usi
 * lamhe gayab bhi ho jaayegi, aur DB me job "completed" likhi rahegi. Isliye
 * `main()` shuru me hi ye jaanch karta hai aur galat setting par saaf mana kar
 * deta hai.
 */

import { existsSync } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { hostname } from "node:os";
import { readFile } from "node:fs/promises";

import {
  alignWords,
  requireExportPreset,
  parseDoc,
  storageKey,
  type Doc,
  type TranscriptWord,
  validateExportSettings,
} from "@reel/core";
import {
  audioStream,
  detectSpeechSegments,
  finalizeMp4,
  makeThumbnail,
  measureEbur128,
  probe,
  transcribe,
  videoStream,
  whisperAvailable,
  type WhisperModel,
} from "@reel/media";
import {
  createStorageDriver,
  readStorageConfig,
  requireRepoRoot,
  resolveAssets,
  withLocalFile,
  type StoredAsset,
} from "@reel/storage";

import { asJob, patch, readDbConn, rows, rpc, select, upsert, type DbConn, type RenderJobRow } from "./db";
import { stageFontAssets, stageFonts } from "./fonts";
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
/**
 * Remotion ek saath kitne frame banaye (`REEL_RENDER_CONCURRENCY`).
 *
 * ⚠️ Ye job wali concurrency se **alag** hai. `MAX_CONCURRENT` batata hai ki ek
 * waqt me kitni **reel** ban rahi hain (1); ye batata hai ki ek reel ke andar
 * kitne **frame** saath-saath bante hain (Remotion kai Chrome tab kholta hai).
 *
 * ⚠️ **Default jaan-boojhkar khaali hai — aur ye naap ke baad tay hua.** Ek
 * 20-core machine par 375 frame ki reel teen setting par chalayi gayi:
 *
 *     concurrency 1   : render 28.8s
 *     concurrency 8   : render 28.4-28.9s
 *     concurrency 14  : render 22.8s (ek baar), 28s (doosri baar)
 *
 * Yaani **koi bharosemand farak nahi mila** — jitna antar dikha utna to do
 * baar chalane par apne aap aa jaata hai (machine par doosre kaam chal rahe the).
 * Aisi haalat me apna default thopna galat hoga: wo ek aisa number hota jise
 * "tuning" kaha jaata par jiske peeche koi naap na hoti. Isliye Remotion apna
 * hisaab lagata hai, aur ye knob sirf **escape hatch** hai — jab kisi machine
 * par sach me farak dikhe, tab set kar dena.
 */
const RENDER_CONCURRENCY = (() => {
  const raw = Number(process.env.REEL_RENDER_CONCURRENCY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : null;
})();

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

/**
 * Heartbeat me kaunsa nishaan jaaye. Cloud runner apne aap ko `cloud` likhta
 * hai, taaki "kis machine ne banayi thi" ka jawab andaaze se na dena pade.
 */
const WORKER_VERSION = process.env.REEL_WORKER_VERSION?.trim() || "phase-11";

/* ------------------------------------------------------------- drain mode */

/**
 * **Drain mode** — queue khaali hote hi worker khud nikal jaata hai (`--once`).
 *
 * Ye ek hi jagah ke liye bana hai: GitHub Actions ka runner. Wahan worker hamesha
 * ke liye nahi chalta — ek job aayi, uske liye machine uthi, kaam hua, machine
 * band. Anant loop wahan do tarah se galat hai: ya to 6 ghante ka timeout aata
 * hai (aur run "failed" dikhta hai jabki reel ban chuki hoti hai), ya minute
 * khaali baithe hue kat'te rehte hain.
 *
 * ⚠️ Exit **turant nahi** hota — `IDLE_EXIT_MS` ka sabra rakha jaata hai. Wajah
 * asli hai: user aksar ek ke baad ek do-teen reel export karta hai. Pehli poori
 * hote hi nikal jaane par doosri ke liye poora runner dobara khada hota (checkout
 * + npm ci + Chrome), yaani 2-3 minute sirf shuruaat me. 20 second ruk jaana us
 * poore setup se sasta hai.
 *
 * ⚠️ Aur ye default me **band** hai. Tumhare PC par worker ka rukna galat hoga —
 * wahan wo daemon hai, ek baar ka kaam nahi.
 */
const RUN_ONCE =
  process.argv.includes("--once") || /^(1|true|yes|on)$/i.test(process.env.REEL_WORKER_ONCE ?? "");

/** Drain mode me: itni der queue khaali rahi to nikal jao. */
const IDLE_EXIT_MS = Number(process.env.REEL_WORKER_IDLE_EXIT_MS ?? 20_000);

/**
 * Drain mode me kul zyada se zyada itni der.
 *
 * ⚠️ GitHub Actions ek job ko 6 ghante par khud maar deta hai, aur us maut ka
 * koi shaistagi wala roop nahi hota: chal rahi job `processing` par jam jaati
 * hai aur `reel_requeue_stale_jobs` ke 15 minute baad hi wapas queue me aati
 * hai. Isliye hum uss hadd se pehle khud rukte hain — chal rahi job poori karke,
 * saaf-saaf.
 */
const MAX_RUN_MS = Number(process.env.REEL_WORKER_MAX_RUN_MS ?? 5 * 60 * 60 * 1000);

/**
 * Drain mode: lagataar itni baar DB se baat na ho paayi to run **fail** karo.
 *
 * 10 × (poll × 2) ≈ 40 second — network ka ek jhatka isme aaram se sambhal jaata
 * hai, par galat secret 40 second me pakda jaata hai, 80 minute me nahi.
 */
const MAX_CONSECUTIVE_FAILURES = Number(process.env.REEL_WORKER_MAX_FAILURES ?? 10);

/**
 * Ye worker kis tarah ki job uthaayega (`REEL_WORKER_KINDS=render,transcribe`).
 *
 * ⚠️ Ye knob cloud ki wajah se hai. `render` ko ffmpeg + Chrome chahiye — dono
 * GitHub runner me pehle se hote hain. `transcribe` ko faster-whisper chahiye,
 * jo nahi hota: pip install + model download (~150MB) har run me lagta hai.
 *
 * Isliye runner default me sirf `render` uthata hai. Bina is filter ke ek
 * transcribe job us runner par ja girti jahan whisper hai hi nahi, aur "faster-
 * whisper is machine par nahi hai" keh kar fail hoti — jabki wo job tumhare PC
 * par bilkul chal jaati. Job **uthni hi nahi chahiye** thi.
 *
 * Khaali chhod do (default) to dono uthte hain — tumhare PC wale worker ke liye
 * yahi sahi hai.
 */
const WORKER_KINDS = (() => {
  const raw = (process.env.REEL_WORKER_KINDS ?? "").trim();
  if (!raw) return null;
  const kinds = raw
    .split(",")
    .map((kind) => kind.trim())
    .filter(Boolean);
  return kinds.length > 0 ? kinds : null;
})();

/* ----------------------------------------------------------------- helpers */

/** Lambi galti ki sirf pehli line — baaki stack UI me kaam ka nahi hota. */
function firstLine(text: string): string {
  return (text.split(/\r?\n/)[0] ?? text).trim();
}

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
      version: WORKER_VERSION,
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
        await select(conn, `/reel_assets?id=eq.${id}&select=id,key:r2_key,filename`),
      );
      const row = list[0];
      if (!row) continue;
      stored.push({
        id: String(row.id),
        key: String(row.key),
        ...(row.filename ? { filename: String(row.filename) } : {}),
      });
    }

    const assetsStartedAt = Date.now();
    const assets = await resolveAssets(doc, stored, storage, { publicDir });
    log(`  assets: ${stored.length} file ${Date.now() - assetsStartedAt}ms me utri`);

    /*
     * Fonts bhi wahin utarte hain jahan assets — aur unki list render me jaati hai.
     *
     * ⚠️ Ye pehle **hota hi nahi tha**, aur wo ek chup-chaap chalne wala bug tha:
     * preview me `fonts.json` wala font dikhta tha aur MP4 me system font nikalta
     * tha. Dekho `src/fonts.ts` ka note.
     */
    const staged = await stageFonts(publicDir);

    /*
     * Upload kiye hue font bhi — inhe `resolveAssets()` kabhi nahi utaarta,
     * kyunki wo item par `assetId` se nahi lagte, `text.fontFamily` me naam se
     * aate hain. Isi wajah se upload kiya hua font MP4 me nahi pahunchta tha.
     */
    const fontRows = rows(
      await select(conn, `/reel_assets?kind=eq.font&select=id,key:r2_key,filename`),
    ).map((row) => ({
      id: String(row.id),
      key: String(row.key),
      filename: String(row.filename ?? ""),
    }));
    const stagedAssets = await stageFontAssets(publicDir, doc, fontRows, async (key) => {
      try {
        return await storage.get(key);
      } catch {
        return null;
      }
    });

    const allFonts = [...staged.fonts, ...stagedAssets.fonts];
    const copiedCount = staged.copied.length + stagedAssets.copied.length;
    if (copiedCount > 0) {
      log(`  fonts: ${copiedCount} file utri (${allFonts.length} entry)`);
    }
    for (const reason of [...staged.skipped, ...stagedAssets.skipped]) log(`  ⚠️ font: ${reason}`);
    if (cancelled) return { status: "cancelled" };

    /*
     * 1b. Dobara validation (20.7).
     *
     * ⚠️ UI me bhi jaanch hoti hai, par wo kaafi nahi hai. Job ka doc **jama
     * hua** hota hai (queue me pada rehta hai), aur us beech me asset delete ho
     * sakti hai, expire ho sakti hai, ya user doosre tab se kuch badal sakta
     * hai. Yahan dobara jaanchne se ek toota hua render 30 second ki jagah
     * turant ruk jaata hai.
     *
     * **Wahi function** chalta hai jo UI chalati hai — do jagah do list rakhne
     * par ek din UI kuch kehti aur worker kuch aur.
     */
    const validation = validateExportSettings({
      doc,
      presetId: job.preset,
      assets: Object.fromEntries(
        stored.map((asset) => [asset.id, { width: null, height: null, durationMs: null }]),
      ),
    });
    if (!validation.valid) {
      const reasons = validation.errors.map((issue) => issue.message).join(" | ");
      throw new Error(`Render se pehle ki jaanch fail hui: ${reasons}`);
    }

    // 2. Render.
    const engine = new RemotionRenderEngine();
    const renderCallStartedAt = Date.now();
    const result = await engine.render({
      doc,
      assets,
      publicDir,
      ...(RENDER_CONCURRENCY ? { concurrency: RENDER_CONCURRENCY } : {}),
      ...(allFonts.length > 0 ? { fonts: allFonts } : {}),
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
      // Master section jo chuna hai wahi (15.6) — do jagah volume ka ganit nahi.
      targetLufs: doc.project.audio.loudnessLufs,
      limiter: doc.project.audio.limiter,
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

    log(`  render ke baad ka kaam (faststart + loudness + thumbnail + upload): ${Date.now() - renderCallStartedAt - result.renderMs - result.bundleMs}ms`);
    const { size } = await stat(finalPath);

    /*
     * Bani hui reel media library me bhi (26.17).
     *
     * ⚠️ Ye pehle nahi hota tha, aur us kami ki shakl seedhi thi: reel ban jaati,
     * R2 par chadh jaati, Renders panel me dikhti — par **library me kahin nahi**
     * hoti. Yaani use kisi doosre project me daalna, ya kisi aur reel me ek clip
     * ki tarah use karna, mumkin hi nahi tha. File maujood thi aur pahunch nahi
     * thi.
     *
     * ⚠️ `id` job ki id hi hai, aur ye jaan-boojhkar hai: ek job ki ek hi reel
     * hoti hai. Nayi id har baar banane par dobara render (retry) par do row ban
     * jaati aur library me ek hi reel do baar dikhti — dono ki file bhi ek hi.
     * Isi wajah se `upsert` hai, `insert` nahi.
     *
     * ⚠️ Ye fail hone par render ko rokna nahi hai. Reel ban chuki hai aur R2 par
     * hai; library me na dikhna asuvidha hai, nuksaan nahi.
     */
    try {
      await upsert(conn, "/reel_assets", {
        id: job.id,
        kind: "video",
        r2_key: outKey,
        filename: `reel-${job.id.slice(0, 8)}.mp4`,
        mime: "video/mp4",
        bytes: size,
        width: video?.width ?? null,
        height: video?.height ?? null,
        duration_ms: Math.round((Number(probed.format.duration ?? 0) || 0) * 1000),
        fps: null,
        lifecycle: "permanent",
        expires_at: null,
        checksum: null,
        cache_key: null,
        tags: [],
        meta: { fromRenderJob: job.id, preset: job.preset },
      });
      log(`  library me bhi jud gayi (asset ${job.id.slice(0, 8)})`);
    } catch (error) {
      log(`  ⚠️ library me nahi jud paayi: ${error instanceof Error ? error.message : String(error)}`);
    }
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
        /*
         * Bundling ka waqt alag se — "render dheema hai" ka jawab andaaze se
         * dena band. Cache lagne par ye 0 ke aas-paas rehta hai; naya bundle
         * banne par 10-15s. Dono ka farak isi line se dikhta hai.
         */
        bundleMs: result.bundleMs,
        bundleCached: result.bundleCached,
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

/* ------------------------------------------------- transcribe job (23.10) */

/**
 * Awaaz se shabd — ek normal job, usi queue me (23.10).
 *
 * ⚠️ Ye job **doc ko haath nahi lagati**. Shabd `result` column me rakh kar
 * chhod deti hai; cues doc me studio daalti hai, usi `setCues` op se jo haath ki
 * editing bhi chalati hai.
 *
 * Kyun: job chalte waqt user editing kar raha hota hai. Worker seedha doc likhe
 * to user ka abhi kiya hua kaam chup-chaap mit jaata hai — aur undo bhi nahi
 * chalta, kyunki undo studio ke andar hai, DB me nahi.
 */
async function runTranscribeJob(conn: DbConn, job: RenderJobRow): Promise<JobOutcome> {
  const input = (job.input ?? {}) as {
    assetId?: string;
    language?: string;
    model?: string;
    /** Text pata ho to whisper ki zaroorat hi nahi (23.5). */
    text?: string;
  };

  const assetId = input.assetId;
  if (!assetId) return { status: "failed", error: "transcribe job me assetId nahi hai" };

  const storage = createStorageDriver();
  const scratchDir = resolve(scratchRoot(), job.id);

  try {
    await mkdir(scratchDir, { recursive: true });

    const list = rows(await select(conn, `/reel_assets?id=eq.${assetId}&select=id,key:r2_key,filename`));
    const row = list[0];
    if (!row) return { status: "failed", error: `asset ${assetId} nahi mili` };

    const key = String(row.key);
    const extension = key.includes(".") ? (key.split(".").pop() as string) : "wav";

    await updateJob(conn, job.id, { progress: 5 });

    const outcome = await withLocalFile(storage, key, { extension, scratchDir }, async (path) => {
      const knownText = (input.text ?? "").trim();

      /*
       * ⚠️ Text pehle se pata ho (TTS se bani awaaz) to whisper chalana bekaar
       * hai — apni hi likhi line ko machine se dobara padhwana. CPU bhi jaata
       * hai aur galti aane ka mauka bhi banta hai (23.5).
       */
      if (knownText.length > 0) {
        await updateJob(conn, job.id, { progress: 30 });
        const detected = await detectSpeechSegments(path);
        const words: TranscriptWord[] = alignWords({
          text: knownText,
          durationSeconds: detected.durationSeconds,
          segments: detected.segments,
        });
        return {
          words,
          language: input.language ?? null,
          durationSeconds: detected.durationSeconds,
          source: "aligned" as const,
          model: null as string | null,
          elapsedMs: 0,
        };
      }

      const available = await whisperAvailable();
      if (!available.ok) {
        // Saaf wajah — "transcribe fail" jaisa kuch nahi, jisse pata hi na chale
        // ki sirf ek pip install baaki hai.
        throw new Error(
          `faster-whisper is machine par nahi hai. ` +
            `Install: pip install faster-whisper (${firstLine(available.detail)})`,
        );
      }

      await updateJob(conn, job.id, { progress: 20 });
      const result = await transcribe({
        audioPath: path,
        ...(input.language ? { language: input.language } : {}),
        ...(input.model ? { model: input.model as WhisperModel } : {}),
        scratchDir,
      });
      return {
        words: result.words as TranscriptWord[],
        language: result.language,
        durationSeconds: result.durationSeconds,
        source: "whisper" as const,
        model: result.model as string | null,
        elapsedMs: result.elapsedMs,
      };
    });

    await updateJob(conn, job.id, {
      status: "completed",
      progress: 100,
      finished_at: new Date().toISOString(),
      error: null,
      result: outcome,
      meta: { ...job.meta, stage: "done", source: outcome.source, words: outcome.words.length },
    });

    log(`transcribe ${job.id} poori — ${outcome.words.length} shabd (${outcome.source})`);
    return { status: "completed" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  } finally {
    await rm(scratchDir, { recursive: true, force: true }).catch(() => {});
  }
}

/* --------------------------------------------------------------- main loop */

/**
 * Repo root se `worker/.env` uthao — bilkul waise hi jaise har smoke script uthata hai.
 *
 * ⚠️ Ye is file me hona chahiye tha aur nahi tha, aur wo khaami sabse buri shakl
 * me chhupi rahi: `worker/scripts/*` sab apna env khud load karte hain, isliye
 * `db-verify`, `render:sample`, `cleanup` — sab chalte the aur sab pass hote the.
 * Sirf **asli worker** (`npm run dev:worker`) shuru hote hi mar jaata tha, ye keh
 * kar ki SUPABASE_URL nahi hai — jabki wo `worker/.env` me saamne likha tha.
 *
 * Isliye env yahin, `readDbConn()` se pehle. Ambient env (CI, systemd) pehle se
 * set ho to `loadEnvFile` usko nahi girata — file sirf jo missing hai wahi bharti hai.
 */
function loadWorkerEnv(): void {
  const root = requireRepoRoot();
  for (const candidate of ["worker/.env", ".env"]) {
    const path = resolve(root, candidate);
    if (existsSync(path)) {
      process.loadEnvFile(path);
      return;
    }
  }
}

async function main(): Promise<void> {
  loadWorkerEnv();
  const conn = readDbConn();
  const config = readStorageConfig();

  /*
   * ⚠️ Cloud par `local` driver chup-chaap sab kuch barbaad kar deta hai, aur
   * wo barbaadi kahin **dikhti nahi**: reel banti hai, `finalizeMp4` chalta hai,
   * job "completed" ho jaati hai, progress 100 par pahunchta hai — aur file
   * runner ki us disk par hoti hai jo run khatam hote hi mit jaati hai. User ko
   * history me poori hui job dikhti hai jiska download 404 deta hai.
   *
   * Isliye ye shart yahan hai, render ke baad nahi: 5 minute ka render karke
   * "kahan rakhun" poochhna sabse mehngi jagah hai galti pakadne ki.
   */
  if (RUN_ONCE && config.driver !== "r2") {
    throw new Error(
      `Drain mode (--once) me REEL_STORAGE_DRIVER="r2" hona chahiye, "${config.driver}" nahi. ` +
        `Runner ki disk run ke saath mit jaati hai — local driver par reel ban kar usi ` +
        `lamhe gayab ho jaayegi, aur DB me job "completed" likhi rahegi.`,
    );
  }

  log(
    `chalu — storage driver "${config.driver}", ek waqt me ${MAX_CONCURRENT} reel, ` +
      `frame concurrency: ${RENDER_CONCURRENCY ?? "Remotion ka apna hisaab"}, ` +
      `job kinds: ${WORKER_KINDS?.join(" + ") ?? "sab"}`,
  );
  log(
    RUN_ONCE
      ? `drain mode — queue ${IDLE_EXIT_MS}ms tak khaali rahi to worker khud band ho jaayega ` +
          `(zyada se zyada ${Math.round(MAX_RUN_MS / 60_000)} minute).`
      : `queue har ${POLL_INTERVAL_MS}ms dekhi jaayegi. Rokne ke liye Ctrl+C.`,
  );

  const startedAt = Date.now();
  let running = 0;
  let stopping = false;
  let lastRequeueAt = 0;
  /** Drain mode: kab se queue khaali hai. `null` = abhi-abhi kaam mila tha. */
  let idleSince: number | null = null;
  /** Lagataar kitni baar DB se baat nahi ho paayi (drain mode ki hadd). */
  let failures = 0;
  /** Jo jobs aakhirkaar fail hui (retry bhi khatam). Drain mode ka exit code isi par hai. */
  const deadJobs: string[] = [];

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

      /*
       * Drain mode ki upari hadd. Ye check yahan hai (claim se **pehle**), taaki
       * hadd ke aakhri lamhe me ek nayi job na uth jaaye — wo job poori hone se
       * pehle GitHub runner mar jaata aur wo 15 minute `processing` par atki
       * rehti. Chal rahi jobs neeche wala loop poori karta hai.
       */
      if (RUN_ONCE && Date.now() - startedAt > MAX_RUN_MS) {
        log(`${Math.round(MAX_RUN_MS / 60_000)} minute ki hadd — nayi job nahi uthayenge.`);
        stopping = true;
        continue;
      }

      if (running >= MAX_CONCURRENT) {
        // Kaam chal raha hai — ye khaali baithna nahi hai.
        idleSince = null;
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const job = asJob(
        await rpc(conn, "reel_claim_render_job", {
          p_worker: WORKER_ID,
          // Kuch na bhejo to SQL ka apna default lagta hai — render + transcribe dono.
          ...(WORKER_KINDS ? { p_kinds: WORKER_KINDS } : {}),
        }),
      );

      /*
       * ⚠️ Ginti yahan reset hoti hai, loop ke ant me nahi — aur ye farak matlab
       * rakhta hai. Loop ke ant tak to `if (!job) continue` pahunchta hi nahi,
       * isliye khaali queue par ginti kabhi sifar hoti hi na. Aur wahi ek asli
       * DB round-trip hai jo abhi-abhi kaamyaab hua: yahi "DB se baat ho rahi
       * hai" ka saboot hai. Warna hafte bhar ke ek-ek chhote network jhatke
       * mil-jul kar hadd paar kar dete aur worker bina wajah ruk jaata.
       */
      failures = 0;
      if (!job) {
        /*
         * Queue khaali. Normal worker ke liye ye kuch nahi — wo intezaar karta
         * hai. Drain mode me yahi wo lamha hai jiska hisaab rakhna hai.
         *
         * ⚠️ `running > 0` par ghadi shuru **nahi** hoti: ek reel render ho rahi
         * ho aur queue us beech khaali ho (bilkul aam baat), to worker apni hi
         * chal rahi job ke beech me nikal jaata.
         */
        if (RUN_ONCE && running === 0) {
          idleSince ??= Date.now();
          if (Date.now() - idleSince >= IDLE_EXIT_MS) {
            log("queue khaali hai — drain poora, band ho raha hai.");
            stopping = true;
            continue;
          }
        }
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      idleSince = null;
      running += 1;
      log(`job ${job.id} uthayi (${job.kind ?? "render"}, preset ${job.preset}, koshish ${job.attempts})`);
      void heartbeat(conn, job.id);

      // Kaun sa kaam — `kind` se. Purane rows me column nahi hoga, wahan render.
      const work = (job.kind ?? "render") === "transcribe" ? runTranscribeJob : runJob;

      /*
       * ⚠️ **Ye `.catch()` ek asli crash ke baad aaya, aur wo crash ek test me
       * pakda gaya jo kisi aur cheez ke liye likha gaya tha.**
       *
       * `runJob` apni har galti khud sambhalti hai — par uske `try` se **pehle**
       * do line hain: `requireExportPreset()` aur `createStorageDriver()`. Dono
       * throw kar sakti hain (anjaan preset, ya R2 ki keys adhoori). Wo throw
       * `try` ke bahar hota hai, isliye seedha is promise tak aata tha — aur
       * yahan koi `.catch()` tha hi nahi.
       *
       * Nateeja: **poora worker mar jaata tha** (Node unhandled rejection par
       * process band kar deta hai), aur job `processing` par jam jaati — 15
       * minute baad `reel_requeue_stale_jobs` ke aane tak. Cloud par ye aur bura
       * hai: runner marta hai, us run me queue ki baaki jobs bhi chhoot jaati
       * hain, aur Actions me sirf ek adhoora log bachta hai.
       *
       * Ab har galti wahi shakl le leti hai jo normal fail ki hai — job `failed`
       * hoti hai apni wajah ke saath, aur worker agli job par chala jaata hai.
       */
      const outcomeOf = work(conn, job).catch(
        (error: unknown): JobOutcome => ({
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );

      void outcomeOf
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
          if (!canRetry) deadJobs.push(`${job.id}: ${outcome.error ?? "anjaan error"}`);
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
      failures += 1;

      /*
       * ⚠️ Par drain mode me "kabhi mat maro" ulta pad jaata hai, aur ye stub ke
       * saath chalate hue saamne aaya: SUPABASE_URL galat ho ya key expire ho
       * chuki ho, to har chakkar `fetch failed` deta hai aur worker chupchaap
       * loop karta rehta hai — jab tak `MAX_RUN_MS` ki 80 minute ki hadd na aa
       * jaaye. GitHub par uska matlab hai ek galat secret ke badle **80 Actions
       * minute** jal jaana, aur run ke ant me bhi wo "successful" dikhna.
       *
       * Ek-do fail ho jaana normal hai (network ek lamhe ke liye gaya). Lagataar
       * fail hona alag baat hai: wo setup ki galti hai, aur wo jitni jaldi dikhe
       * utna accha. Isliye yahan run **fail** hota hai — chup-chaap nahi rukta.
       *
       * Tumhare PC wale worker par ye laagu nahi: wahan Wi-Fi ka aana-jaana aam
       * hai aur worker ka bane rehna hi sahi hai.
       */
      if (RUN_ONCE && failures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(
          `lagataar ${failures} baar DB se baat nahi ho paayi — ruk rahe hain. ` +
            `SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY dekho (GitHub repo Settings > Secrets).`,
        );
      }
      await sleep(POLL_INTERVAL_MS * 2);
    }
  }

  /*
   * ⚠️ Heartbeat **pehle band nahi hota** — pehle chal rahi job poori hone do.
   *
   * Ulta karne par (jaise pehle tha) shutdown ke doran dhadkan ruk jaati hai
   * jabki render abhi chal raha hota hai, aur UI 20 second baad "worker offline"
   * dikhane lagti hai — jabki reel bilkul ban rahi hoti hai. Cloud runner me ye
   * aur bhi bura hai: `MAX_RUN_MS` ki hadd par aakhri render kai minute aur chal
   * sakta hai, aur us poore waqt studio jhooth bolti.
   */
  while (running > 0) await sleep(500);
  clearInterval(heartbeatTimer);
  await heartbeat(conn, null).catch(() => {});
  log("band.");

  /*
   * ⚠️ **Drain mode me fail hui jobs poore run ko fail karti hain — aur ye ek
   * asli, mehngi galti ke baad aaya.**
   *
   * Pehla asli cloud run "Success" dikha raha tha, 4 minute 40 second chala, aur
   * usme **dono** reel `spawn ffmpeg ENOENT` par mar chuki thi. Worker ke liye ye
   * bilkul theek vyavhaar tha — job fail hui, DB me likh diya, queue saaf ki,
   * shanti se nikal gaya. Par GitHub ke paas dekhne ko sirf exit code hota hai,
   * aur wo 0 tha. Actions me hara nishaan, aur ek bhi reel nahi bani.
   *
   * Yahi wo shakl hai jo sabse mehngi padti hai: koi error kahin nahi dikhta,
   * kyunki har parat ne apna kaam "theek" kiya. Sach sirf DB ke ek column me
   * pada rehta hai jise koi nahi dekhta.
   *
   * ⚠️ Ginti sirf un jobs ki hai jinki **retry bhi khatam** ho chuki hai. Beech
   * ki fail koshish par run ko laal karna galat hoga — wo job usi run me dobara
   * uthti hai aur aksar ban bhi jaati hai.
   *
   * Normal (daemon) worker par ye laagu nahi: wahan exit code kisi ke kaam ka
   * nahi, aur ek fail job par worker ka marna bilkul galat hoga.
   */
  if (RUN_ONCE && deadJobs.length > 0) {
    log(`${deadJobs.length} job aakhir tak fail rahi — run ko fail kar rahe hain:`);
    for (const line of deadJobs) log(`  ${line}`);
    process.exitCode = 1;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

void main().catch((error: unknown) => {
  console.error(`[reel-worker] shuru hi nahi ho paaya: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
