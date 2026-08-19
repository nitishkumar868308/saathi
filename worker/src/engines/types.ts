import type { Doc } from "@reel/core";
import type { AssetMap } from "@reel/storage";

/**
 * `RenderEngine` — video kaise banti hai, iska ekmatra contract.
 *
 * ⚠️ Ye interface **jaan-boojhkar** hai, timepass nahi. Remotion ka license
 * company ke size ke saath badalta hai (4+ employees par paid), aur uska
 * upgrade path bhi apna hai. Ek din pure-FFmpeg engine par jaana pade to sirf
 * ek nayi file likhni padegi — worker, studio, aur queue me ek line nahi badlegi.
 *
 * Isliye is file me Remotion ka koi type nahi aata. Jo bhi engine ho, use bas
 * doc, assets aur ek out path milta hai.
 */

export interface RenderProgress {
  /** 0..1 */
  progress: number;
  /** `bundling` | `rendering` | `encoding` | `finalizing` */
  stage: RenderStage;
  renderedFrames?: number;
  totalFrames?: number;
}

export type RenderStage = "bundling" | "rendering" | "encoding" | "finalizing";

export interface RenderRequest {
  /**
   * Font registry — **wahi list jo studio ke panel me dikhti hai** (9.10).
   *
   * Preview studio ke process me chalta hai aur render Remotion ke apne bundle
   * me; do jagah do alag list rakhne par ek din preview me ek font dikhta hai
   * aur MP4 me doosra. Isliye list yahan se `inputProps` me jaati hai — wahi
   * raasta jispar doc aur assets jaate hain.
   *
   * Na di jaaye to sirf system fonts (jo har machine par hain).
   */
  fonts?: readonly import("@reel/core").FontEntry[];
  doc: Doc;
  /** assetId -> publicDir ke andar ka filename (`resolveAssets()` se). */
  assets: AssetMap;
  /** Wahi folder jisme `resolveAssets()` ne files utaari hain. */
  publicDir: string;
  /** Final MP4 yahan banegi. */
  outPath: string;
  /** EXPORT_PRESETS registry ka id — `standard` | `high` | `uhd`. */
  preset: string;
  onProgress?: (progress: RenderProgress) => void;
  /** Kitne frames ek saath — null = engine khud tay kare. */
  concurrency?: number | null;
  /**
   * Cancel ka signal (11.9).
   *
   * ⚠️ Ye interface me hai, engine ke andar nahi — kyunki cancel ka matlab har
   * engine me alag hota hai (Remotion ka apna `cancelSignal`, pure-FFmpeg ka
   * `child.kill()`). Bulane wale ko sirf itna pata hona chahiye ki abort kaise
   * bhejna hai.
   *
   * Iske bina cancel ka matlab sirf "DB me status badal do" reh jaata — aur
   * render peeche chalta rehta, CPU khaata rehta, aur ant me ek anaath file
   * bana kar chhod deta.
   */
  abortSignal?: AbortSignal;
}

export interface RenderResult {
  outPath: string;
  bytes: number;
  /** Sirf render me laga waqt (bundling aur post-process alag). */
  renderMs: number;
  totalMs: number;
  frames: number;
}

export interface RenderEngine {
  readonly name: string;
  render(request: RenderRequest): Promise<RenderResult>;
}
