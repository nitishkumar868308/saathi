/**
 * Project size + fps presets — README Section 3B ki poori list, **data** ke roop me.
 *
 * Code me kahin bhi 1080 / 1920 / 30 nahi likha jaata. Editor, renderer aur worker
 * teeno `doc.project.width/height/fps` padhte hain, aur UI ye list dikhata hai.
 * Nayi size add karni ho to yahan ek entry — poore codebase me kahin edit nahi.
 */

/** yuv420p ko even width/height chahiye, warna encoder chroma plane par rota hai. */
export const DIMENSION_STEP = 2;
export const MIN_DIMENSION = 16;
export const MAX_DIMENSION = 7680;

export type SizePresetGroup = "social" | "wide" | "other" | "custom";

export interface SizePreset {
  id: string;
  label: string;
  /** `custom` ke liye null — user khud width/height deta hai. */
  width: number | null;
  height: number | null;
  aspectLabel: string;
  group: SizePresetGroup;
  /** UI me chhoti madad-line. */
  hint: string;
}

export const SIZE_PRESETS: readonly SizePreset[] = [
  {
    id: "reel",
    label: "Reel / Shorts / Status",
    width: 1080,
    height: 1920,
    aspectLabel: "9:16",
    group: "social",
    hint: "Instagram Reels, YouTube Shorts, WhatsApp Status",
  },
  {
    id: "square",
    label: "Square",
    width: 1080,
    height: 1080,
    aspectLabel: "1:1",
    group: "social",
    hint: "Feed post",
  },
  {
    id: "portrait",
    label: "Portrait",
    width: 1080,
    height: 1350,
    aspectLabel: "4:5",
    group: "social",
    hint: "Instagram feed — feed me sabse zyada jagah gherta hai",
  },
  {
    id: "landscape",
    label: "Landscape",
    width: 1920,
    height: 1080,
    aspectLabel: "16:9",
    group: "wide",
    hint: "YouTube, website",
  },
  {
    id: "landscape-1440",
    label: "Landscape HD+ (1440p)",
    width: 2560,
    height: 1440,
    aspectLabel: "16:9",
    group: "wide",
    hint: "Zaroorat ho tabhi — render kaafi dheema ho jaata hai",
  },
  {
    id: "landscape-2160",
    label: "Landscape 4K (2160p)",
    width: 3840,
    height: 2160,
    aspectLabel: "16:9",
    group: "wide",
    hint: "Zaroorat ho tabhi — 1080p se 4-8x dheema, aur social sab re-encode kar deta hai",
  },
  {
    id: "classic",
    label: "Classic",
    width: 1440,
    height: 1080,
    aspectLabel: "4:3",
    group: "other",
    hint: "Kabhi-kabhaar",
  },
  {
    id: "custom",
    label: "Custom",
    width: null,
    height: null,
    aspectLabel: "—",
    group: "custom",
    hint: "Apni width x height do (even numbers)",
  },
] as const;

export const CUSTOM_SIZE_PRESET_ID = "custom";
export const DEFAULT_SIZE_PRESET_ID = "reel";

export const FPS_CHOICES: readonly number[] = [24, 25, 30, 50, 60] as const;
export const DEFAULT_FPS = 30;

/** Naya khaali project kitna lamba shuru ho (seconds). */
export const DEFAULT_PROJECT_DURATION_SECONDS = 15;

export const DEFAULT_BACKGROUND = "#000000";

export function listSizePresets(): readonly SizePreset[] {
  return SIZE_PRESETS;
}

export function getSizePreset(id: string): SizePreset | undefined {
  return SIZE_PRESETS.find((preset) => preset.id === id);
}

export function requireSizePreset(id: string): SizePreset {
  const preset = getSizePreset(id);
  if (!preset) {
    throw new Error(
      `Unknown size preset "${id}". Available: ${SIZE_PRESETS.map((p) => p.id).join(", ")}`,
    );
  }
  return preset;
}

export function isValidDimension(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_DIMENSION &&
    value <= MAX_DIMENSION &&
    value % DIMENSION_STEP === 0
  );
}

/** User ki di hui value ko sabse nazdeek legal dimension par le aao. */
export function normalizeDimension(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`normalizeDimension: "${value}" number nahi hai`);
  }
  const rounded = Math.round(value / DIMENSION_STEP) * DIMENSION_STEP;
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, rounded));
}

export function isValidFps(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 240;
}

export interface ResolveSizeInput {
  presetId?: string;
  width?: number;
  height?: number;
}

/**
 * Preset id (+ custom ke liye width/height) se asli pixels nikalo.
 * Har jagah yahi ek raasta hai — isliye "custom size" kabhi special-case nahi banta.
 */
export function resolveSize(input: ResolveSizeInput = {}): { width: number; height: number } {
  const presetId = input.presetId ?? DEFAULT_SIZE_PRESET_ID;
  const preset = requireSizePreset(presetId);

  if (preset.width !== null && preset.height !== null) {
    return { width: preset.width, height: preset.height };
  }

  if (input.width === undefined || input.height === undefined) {
    throw new Error(`Size preset "${presetId}" ke liye width aur height dono chahiye`);
  }
  return {
    width: normalizeDimension(input.width),
    height: normalizeDimension(input.height),
  };
}

/** `1080x1920` -> `"9:16"`. UI aur warnings dono isse use karte hain. */
export function aspectRatioLabel(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.abs(Math.round(width)), Math.abs(Math.round(height))) || 1;
  return `${Math.round(width) / divisor}:${Math.round(height) / divisor}`;
}

export function aspectRatio(width: number, height: number): number {
  if (height === 0) throw new Error("aspectRatio: height 0 nahi ho sakti");
  return width / height;
}
