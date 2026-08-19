import { getAssetKind } from "../registry/assetKinds";

/**
 * Asset ki quality ka imaandaar jawab — "1080p ✓" ya "480p — 1080x1920 me blurry".
 *
 * Ye Section 3A ka wahi rule hai jo Phase 20 me poore project par lagega:
 * **upscale karke "4K" ka label nahi lagana**. Yahan uska sabse chhota roop hai —
 * ek asset, ek target frame. Phase 20 ka validator isi function ko bulayega,
 * bas zoom/scale keyframes milaakar. Isliye ye `@reel/core` me hai, studio me nahi.
 *
 * Faisla dikhne wale pixels par hota hai, file ke naam ya bitrate par nahi:
 * 4K ka naam rakhkar 480p ka video bhejna aam baat hai.
 */

export type QualityLevel = "good" | "ok" | "low" | "unknown";

export interface AssetQualityInput {
  kind: string;
  width?: number | null;
  height?: number | null;
}

export interface TargetFrame {
  width: number;
  height: number;
}

export interface QualityVerdict {
  level: QualityLevel;
  /** Chhota badge — `"1080p"`, `"480p"`, `"—"`. */
  badge: string;
  /** Ek line me poori baat, UI me tooltip/detail ke liye. */
  detail: string;
  /**
   * Asset ke pixels target ke kitne guna hain (1 = bilkul bharpoor).
   * Phase 20 isi number ko zoom ke saath milakar upscale pakadta hai.
   */
  coverage: number | null;
}

/** Standard heights — inhi ke naam log pehchante hain. */
const HEIGHT_NAMES: readonly { minHeight: number; name: string }[] = [
  { minHeight: 2160, name: "4K" },
  { minHeight: 1440, name: "1440p" },
  { minHeight: 1080, name: "1080p" },
  { minHeight: 720, name: "720p" },
  { minHeight: 480, name: "480p" },
  { minHeight: 360, name: "360p" },
  { minHeight: 0, name: "chhota" },
];

/**
 * `1920x1080` -> `"1080p"`. Chhoti taraf par naam diya jaata hai, kyunki
 * 1080x1920 (reel) bhi "1080p" hi hai — usko "1920p" kehna galat hoga.
 */
export function resolutionName(width: number, height: number): string {
  const shortSide = Math.min(width, height);
  return (HEIGHT_NAMES.find((entry) => shortSide >= entry.minHeight) as { name: string }).name;
}

/** Coverage se level — hadd ek jagah, taaki UI aur validator ek hi baat kahein. */
export const QUALITY_THRESHOLDS = {
  /** Isse upar = poora bharta hai. */
  good: 1,
  /** Isse upar = thoda khinchega par chalega. */
  ok: 0.75,
} as const;

export function assetQuality(
  asset: AssetQualityInput,
  target?: TargetFrame | null,
): QualityVerdict {
  const kind = getAssetKind(asset.kind);

  // Audio/font me pixel hote hi nahi — inka "quality badge" dikhana jhooth hoga.
  if (kind && !kind.hasPixels) {
    return {
      level: "unknown",
      badge: "—",
      detail: `${kind.label} me resolution nahi hoti`,
      coverage: null,
    };
  }

  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  if (!width || !height) {
    return {
      level: "unknown",
      badge: "?",
      // Chupchaap "theek hai" dikhane se behtar hai maan lena ki abhi naapa nahi gaya.
      detail: "Resolution abhi naapi nahi gayi (probe nahi chala)",
      coverage: null,
    };
  }

  const name = resolutionName(width, height);
  if (!target) {
    return { level: "unknown", badge: name, detail: `${width}x${height}`, coverage: null };
  }

  /*
   * Coverage = dono taraf me se **kamzor** taraf. Sirf area dekhna dhoka deta
   * hai: 3840x480 ka "bahut pixel" wala video 1080x1920 ke frame me phir bhi
   * upar-neeche khaali chhodta hai ya kheenchna padta hai.
   */
  const coverage = Math.min(width / target.width, height / target.height);

  if (coverage >= QUALITY_THRESHOLDS.good) {
    return {
      level: "good",
      badge: name,
      detail: `${width}x${height} — ${target.width}x${target.height} ke liye poora hai`,
      coverage,
    };
  }
  if (coverage >= QUALITY_THRESHOLDS.ok) {
    return {
      level: "ok",
      badge: name,
      detail:
        `${width}x${height} — ${target.width}x${target.height} me ${Math.round((1 / coverage) * 100 - 100)}% ` +
        `kheenchna padega, halka sa soft dikhega`,
      coverage,
    };
  }
  return {
    level: "low",
    badge: name,
    detail: `${width}x${height} — ${target.width}x${target.height} me blurry dikhega (${Math.round(coverage * 100)}% pixels hi hain)`,
    coverage,
  };
}
