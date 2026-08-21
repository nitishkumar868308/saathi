import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { COLOR_SPACE, GOP_SECONDS, requireExportPreset } from "@reel/core";
import { requireRepoRoot } from "@reel/storage";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  makeCancelSignal,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";

import type { RenderEngine, RenderRequest, RenderResult } from "./types";
import { cachedBundle, rememberBundle, sourceFingerprint } from "./bundleCache";

/**
 * Remotion se render.
 *
 * ⚠️ **Section 3A ka single-encode rule yahan bandha hua hai.** Remotion se
 * seedha final H.264 nikalta hai — CRF, x264 preset, pixel format, aur audio sab
 * yahin tay hote hain. Baad me FFmpeg sirf remux karta hai (`-c copy`). Video ko
 * dobara encode karne se quality girti hai bina kisi faayde ke.
 *
 * `bundle()` har render par chalta hai. Ye thoda kharcha hai (~5-15s) par
 * imaandaar hai: code badal gaya ho to purana bundle chupchaap chalte rehna
 * "maine to theek kar diya tha, video me kyun nahi aaya" wali sabse chidhane
 * wali cheez banta hai.
 *
 * ⚠️ **Ab wo har baar nahi chalta — par wo dar ab bhi sahi hai.** Cache ki
 * chaabi source ke fingerprint se banti hai (`bundleCache.ts`): ek line badalte
 * hi chaabi badal jaati hai aur naya bundle banta hai. Yaani tezi mili, par
 * "purana bundle chup-chaap chalta raha" wali halat ban nahi sakti.
 * Naapa hua: bundling ~13.6s se 0s (cache lagne par).
 */

/** Remotion ka entry file — repo root se, cwd se nahi. */
function entryPoint(): string {
  return resolve(requireRepoRoot(), "packages/reel-remotion/src/entry.ts");
}

export class RemotionRenderEngine implements RenderEngine {
  readonly name = "remotion";

  async render(request: RenderRequest): Promise<RenderResult> {
    const startedAt = Date.now();
    const preset = requireExportPreset(request.preset);

    /*
     * Pehli baar chalane par Remotion Chrome Headless Shell utaarta hai (~150MB).
     * Ye Remotion ka apna hissa hai, koi alag service nahi — par bina bataye 150MB
     * kheenchna bura hota hai, isliye pehle hi saaf bol dete hain.
     */
    request.onProgress?.({ stage: "bundling", progress: 0 });
    await ensureBrowser();

    /*
     * Bundle ka cache — naapa hua faayda: 12.5s ki reel me bundling ~13.6s leti
     * thi, har baar. Chaabi source ke fingerprint se banti hai, isliye ek line
     * badalte hi naya bundle banta hai — "maine theek kiya tha, video me kyun
     * nahi aaya" wali halat ban hi nahi sakti. Dekho `bundleCache.ts`.
     */
    const bundleStartedAt = Date.now();
    const fingerprint = sourceFingerprint(requireRepoRoot(), entryPoint());
    let serveUrl = cachedBundle(fingerprint);
    const fromCache = serveUrl !== null;

    if (!serveUrl) {
      serveUrl = await bundle({
        entryPoint: entryPoint(),
        // Assets isi folder me utari gayi hain — `staticFile()` yahin se padhta hai.
        publicDir: request.publicDir,
        onProgress: (percent) => {
          request.onProgress?.({ stage: "bundling", progress: 0.05 + (percent / 100) * 0.1 });
        },
      });
      rememberBundle(fingerprint, serveUrl);
    }
    const bundleMs = Date.now() - bundleStartedAt;

    const inputProps = {
      doc: request.doc,
      assets: request.assets,
      ...(request.fonts ? { fonts: request.fonts } : {}),
    };

    /*
     * Composition ki width/height/fps/duration `calculateMetadata` se aati hain,
     * aur wo doc padhta hai. Isliye 1080x1920@30 aur 1920x1080@24 ke liye do alag
     * composition nahi banti — sirf doc badalta hai (Dynamic rule 4).
     */
    const composition = await selectComposition({
      serveUrl,
      id: "Reel",
      inputProps,
    });

    const renderStartedAt = Date.now();

    /*
     * Cancel (11.9) — Remotion ka apna signal.
     *
     * `AbortSignal` ko seedha Remotion ko nahi de sakte; uska apna
     * `makeCancelSignal()` hai. Isliye yahan do sire jode jaate hain: bahar
     * wala standard `AbortSignal`, andar Remotion wala. Iske bina cancel sirf
     * DB me status badalta aur render peeche chalta rehta — CPU khaata hua,
     * aur ant me ek anaath file bana kar.
     */
    const cancel = request.abortSignal ? makeCancelSignal() : null;
    if (cancel && request.abortSignal) {
      if (request.abortSignal.aborted) cancel.cancel();
      else request.abortSignal.addEventListener("abort", () => cancel.cancel(), { once: true });
    }

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: request.outPath,
      inputProps,

      // --- Section 3A: quality bar, poora ka poora ---
      // Har number EXPORT_PRESETS registry se aata hai — yahan koi magic value nahi.
      crf: preset.crf,
      x264Preset: preset.x264Preset,
      // yuv420p ke bina video kai players (aur WhatsApp) me chalti hi nahi.
      pixelFormat: "yuv420p",
      /*
       * GOP ~2 second. Chhota GOP = seek tez aur social platforms ka re-encode
       * saaf, par file thodi badi. Frames me isliye ki fps kuch bhi ho sakta hai.
       */
      gopSize: Math.max(1, Math.round(composition.fps * GOP_SECONDS)),
      /*
       * Colour space ke tags. Bina inke player apna andaza lagata hai aur wahi
       * video kisi phone par thodi alag rang ki dikhti hai.
       */
      colorSpace: COLOR_SPACE,
      audioCodec: "aac",
      audioBitrate: `${preset.audioBitrateKbps}k`,
      /*
       * Audio track hamesha rahe — chahe project me abhi koi audio na ho.
       * Bina audio track wali MP4 kai jagah (Instagram, kuch Android players)
       * ya to reject hoti hai ya chalte-chalte atak jaati hai.
       */
      enforceAudioTrack: true,

      ...(request.concurrency ? { concurrency: request.concurrency } : {}),
      ...(cancel ? { cancelSignal: cancel.cancelSignal } : {}),

      onProgress: ({ progress, renderedFrames, encodedFrames, stitchStage }) => {
        request.onProgress?.({
          // 0.15 tak bundling ho chuki hai; baaki 0.85 render ka hissa.
          progress: 0.15 + progress * 0.85,
          stage: stitchStage === "muxing" ? "encoding" : "rendering",
          renderedFrames: renderedFrames ?? encodedFrames,
          totalFrames: composition.durationInFrames,
        });
      },
    });

    const finishedAt = Date.now();
    const { size } = await stat(request.outPath);

    return {
      outPath: request.outPath,
      bytes: size,
      renderMs: finishedAt - renderStartedAt,
      // Naap meta me jaati hai taaki "dheema kyun hai" ka jawab andaaze se na
      // dena pade — admin aur Renders panel dono yahi padhte hain.
      bundleMs,
      bundleCached: fromCache,
      totalMs: finishedAt - startedAt,
      frames: composition.durationInFrames,
    };
  }
}
