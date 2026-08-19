/**
 * Size & Fit — README Section 3B ka dil.
 *
 * **Render contract (Phase 3 isi par bharosa karega):**
 * asset apne *natural pixel size* me, frame ke center me rakha jaata hai. Uske
 * upar do scale lagti hain —
 *   1. `computeFit()` ki base scale (fit mode se aayi), aur
 *   2. `item.transform.scale` (user ka zoom / Ken Burns keyframes).
 * Total scale = fit.scale x transform.scale. Isliye "Fill frame" dabane ke baad
 * bhi zoom keyframes waise ke waise kaam karte hain — dono ladte nahi.
 *
 * Yahi ek helper preview, final render, aur auto-fit buttons teeno chalata hai,
 * warna teen jagah teen alag math ho jaati aur framing kabhi match nahi karti.
 */

export type FitMode = "cover" | "contain" | "fill" | "custom";

export interface FitModeDef {
  id: FitMode;
  label: string;
  hint: string;
  /** true = is mode me aspect toot sakta hai, UI warning dikhaye. */
  breaksAspect: boolean;
  /** true = khaali jagah bachegi, isliye background chunna padega. */
  needsBackground: boolean;
}

export const FIT_MODES: readonly FitModeDef[] = [
  {
    id: "cover",
    label: "Cover (bhar do)",
    hint: "Frame poora bharta hai, kinare crop ho jaate hain",
    breaksAspect: false,
    needsBackground: false,
  },
  {
    id: "contain",
    label: "Contain (poora dikhe)",
    hint: "Poori image dikhti hai, aas-paas khaali jagah bachti hai",
    breaksAspect: false,
    needsBackground: true,
  },
  {
    id: "fill",
    label: "Fill / Stretch",
    hint: "Frame bharta hai par aspect toot jaata hai — chehre khinche hue lagenge",
    breaksAspect: true,
    needsBackground: false,
  },
  {
    id: "custom",
    label: "Custom",
    hint: "Scale aur position tum khud set karo",
    breaksAspect: false,
    needsBackground: true,
  },
] as const;

export const DEFAULT_FIT_MODE: FitMode = "cover";

export function getFitMode(id: string): FitModeDef | undefined {
  return FIT_MODES.find((mode) => mode.id === id);
}

/** contain / custom me jo khaali jagah bachti hai, wo kaise bhare. */
export type ContainBackgroundKind = "color" | "brand" | "blurred-asset" | "gradient";

export interface ContainBackgroundDef {
  id: ContainBackgroundKind;
  label: string;
  hint: string;
  /** value field me kya aayega — UI ko yahi batata hai kaunsa control dikhana hai. */
  valueKind: "hex" | "brand-token" | "none" | "gradient-token";
}

export const CONTAIN_BACKGROUNDS: readonly ContainBackgroundDef[] = [
  {
    id: "color",
    label: "Solid colour",
    hint: "Ek plain rang",
    valueKind: "hex",
  },
  {
    id: "brand",
    label: "Brand colour",
    hint: "Brand token se — brand badlo to poori reel badal jaati hai",
    valueKind: "brand-token",
  },
  {
    id: "blurred-asset",
    label: "Blurred copy",
    hint: "Usi clip ki dhundhli badi copy peeche — 16:9 footage ko 9:16 reel me daalne ka sabse kaam ka option",
    valueKind: "none",
  },
  {
    id: "gradient",
    label: "Gradient",
    hint: "Do rangon ka gradient",
    valueKind: "gradient-token",
  },
] as const;

export const DEFAULT_CONTAIN_BACKGROUND: ContainBackgroundKind = "blurred-asset";

export interface Size {
  width: number;
  height: number;
}

export interface FitResult {
  mode: FitMode;
  /** Uniform base scale (cover/contain/custom). fill me ye scaleX ke barabar hota hai. */
  scale: number;
  scaleX: number;
  scaleY: number;
  /** Frame center se offset, project pixels me. Fit hamesha centered hai, isliye 0. */
  x: number;
  y: number;
  drawWidth: number;
  drawHeight: number;
  /** Frame ke bahar nikal raha hai (crop ho raha hai)? */
  cropped: boolean;
  /** Aspect toota? Sirf fill mode me true. */
  aspectBroken: boolean;
  /** Frame me khaali jagah bachi (contain/custom) — background isi wajah se chahiye. */
  hasEmptySpace: boolean;
}

const EPSILON = 0.001;

function assertSize(size: Size, what: string): void {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new Error(`${what} size galat hai: ${size.width}x${size.height}`);
  }
}

/**
 * Fit mode se base scale + position nikalo.
 *
 * source = asset ka natural pixel size, frame = project ka width/height.
 */
export function computeFit(
  source: Size,
  frame: Size,
  mode: FitMode = DEFAULT_FIT_MODE,
): FitResult {
  assertSize(source, "source");
  assertSize(frame, "frame");

  const scaleX = frame.width / source.width;
  const scaleY = frame.height / source.height;

  let sx: number;
  let sy: number;
  switch (mode) {
    case "cover":
      sx = sy = Math.max(scaleX, scaleY);
      break;
    case "contain":
      sx = sy = Math.min(scaleX, scaleY);
      break;
    case "fill":
      sx = scaleX;
      sy = scaleY;
      break;
    case "custom":
      // Custom me hum kuch decide nahi karte — natural size, baaki user ka transform.
      sx = sy = 1;
      break;
    default: {
      const exhaustive: never = mode;
      throw new Error(`Unknown fit mode: ${String(exhaustive)}`);
    }
  }

  const drawWidth = source.width * sx;
  const drawHeight = source.height * sy;

  return {
    mode,
    scale: sx,
    scaleX: sx,
    scaleY: sy,
    x: 0,
    y: 0,
    drawWidth,
    drawHeight,
    cropped: drawWidth > frame.width + EPSILON || drawHeight > frame.height + EPSILON,
    aspectBroken: Math.abs(sx - sy) > EPSILON,
    hasEmptySpace:
      drawWidth < frame.width - EPSILON || drawHeight < frame.height - EPSILON,
  };
}

/**
 * Upscale check — Section 3A ka non-negotiable rule.
 *
 * Frame bharne ke liye source ke kitne pixel chahiye vs asli me kitne hain.
 * extraScale me user ka transform.scale ya zoom keyframe ka **maximum** daalo,
 * warna Ken Burns ke end par blur aayega aur kisi ko pata bhi nahi chalega.
 */
export interface UpscaleCheck {
  upscaled: boolean;
  /** 1.0 = bilkul theek, 2.0 = source me aadhe hi pixels hain. */
  factor: number;
  requiredSource: Size;
  actualSource: Size;
  message: string | null;
}

export function checkUpscale(
  source: Size,
  frame: Size,
  fit: FitResult,
  extraScale = 1,
): UpscaleCheck {
  assertSize(source, "source");
  assertSize(frame, "frame");

  const totalScaleX = fit.scaleX * extraScale;
  const totalScaleY = fit.scaleY * extraScale;
  const factor = Math.max(totalScaleX, totalScaleY);

  const requiredSource: Size = {
    width: Math.ceil(source.width * Math.max(1, totalScaleX)),
    height: Math.ceil(source.height * Math.max(1, totalScaleY)),
  };

  const upscaled = factor > 1 + EPSILON;
  return {
    upscaled,
    factor,
    requiredSource,
    actualSource: source,
    message: upscaled
      ? `Source ${source.width}x${source.height} ko ${factor.toFixed(2)}x bada kiya ja raha hai — ` +
        `saaf dikhne ke liye kam se kam ${requiredSource.width}x${requiredSource.height} chahiye. Tasveer dhundhli aayegi.`
      : null,
  };
}

/** Auto-fit button ka result — seedha item.transform par lag jaata hai. */
export interface AutoFitPatch {
  mode: FitMode;
  /** NaN = scale ko haath mat lagao (sirf "Center" aisa karta hai). */
  scale: number;
  x: number;
  y: number;
}

export interface AutoFitAction {
  id: string;
  label: string;
  hint: string;
  apply(source: Size, frame: Size): AutoFitPatch;
}

/**
 * README 3B ke "ek click me" wale helpers — ye ek **list** hai, hardcoded
 * buttons nahi. UI isi array par map karta hai, isliye naya helper = yahan ek entry.
 */
export const AUTO_FIT_ACTIONS: readonly AutoFitAction[] = [
  {
    id: "fit-frame",
    label: "Fit to frame",
    hint: "Poora dikhe (contain)",
    apply: (source, frame) => {
      const fit = computeFit(source, frame, "contain");
      return { mode: "contain", scale: fit.scale, x: fit.x, y: fit.y };
    },
  },
  {
    id: "fill-frame",
    label: "Fill frame",
    hint: "Frame bhar do, kinare crop (cover)",
    apply: (source, frame) => {
      const fit = computeFit(source, frame, "cover");
      return { mode: "cover", scale: fit.scale, x: fit.x, y: fit.y };
    },
  },
  {
    id: "fit-width",
    label: "Fit width",
    hint: "Chaudai frame ke barabar, upar-neeche jo ho so ho",
    apply: (source, frame) => {
      assertSize(source, "source");
      assertSize(frame, "frame");
      return { mode: "custom", scale: frame.width / source.width, x: 0, y: 0 };
    },
  },
  {
    id: "fit-height",
    label: "Fit height",
    hint: "Oonchai frame ke barabar, daayen-baayen jo ho so ho",
    apply: (source, frame) => {
      assertSize(source, "source");
      assertSize(frame, "frame");
      return { mode: "custom", scale: frame.height / source.height, x: 0, y: 0 };
    },
  },
  {
    id: "center",
    label: "Center",
    hint: "Sirf beech me le aao, scale waisi hi",
    apply: () => ({ mode: "custom", scale: Number.NaN, x: 0, y: 0 }),
  },
  {
    id: "reset",
    label: "Reset",
    hint: "Natural size, beech me",
    apply: () => ({ mode: "custom", scale: 1, x: 0, y: 0 }),
  },
] as const;

export function isScaleUnchanged(patch: AutoFitPatch): boolean {
  return Number.isNaN(patch.scale);
}

export function getAutoFitAction(id: string): AutoFitAction | undefined {
  return AUTO_FIT_ACTIONS.find((action) => action.id === id);
}

/**
 * Aspect mismatch par UI ko kya suggest karna hai — README 3B ka
 * "16:9 video ko 9:16 me daalne pe UI khud bataye" wala hissa.
 *
 * Ye sirf **salah** deta hai, apne aap kuch badalta nahi (silent mutation mana hai).
 */
export interface FitSuggestion {
  mismatch: boolean;
  /** 1.0 = bilkul same aspect. */
  ratio: number;
  recommendedMode: FitMode;
  recommendedBackground: ContainBackgroundKind | null;
  reason: string;
}

export function suggestFit(source: Size, frame: Size): FitSuggestion {
  assertSize(source, "source");
  assertSize(frame, "frame");

  const sourceAspect = source.width / source.height;
  const frameAspect = frame.width / frame.height;
  const ratio = sourceAspect / frameAspect;

  if (Math.abs(ratio - 1) <= 0.02) {
    return {
      mismatch: false,
      ratio,
      recommendedMode: "cover",
      recommendedBackground: null,
      reason: "Aspect frame se mil raha hai — Cover se kuch bhi crop nahi hoga.",
    };
  }

  const cover = computeFit(source, frame, "cover");
  const lostFraction = 1 - (frame.width * frame.height) / (cover.drawWidth * cover.drawHeight);

  // Bahut zyada crop ho raha ho to Cover me tasveer ka aadha hissa gayab ho
  // jaata hai — us haalat me Contain + blurred background hi imaandaar jawaab hai.
  if (lostFraction > 0.35) {
    return {
      mismatch: true,
      ratio,
      recommendedMode: "contain",
      recommendedBackground: "blurred-asset",
      reason:
        `Cover karne par tasveer ka ~${Math.round(lostFraction * 100)}% crop ho jaayega. ` +
        `Contain + blurred copy background behtar rahega.`,
    };
  }

  return {
    mismatch: true,
    ratio,
    recommendedMode: "cover",
    recommendedBackground: null,
    reason:
      `Thoda crop hoga (~${Math.round(lostFraction * 100)}%). Cover theek hai; ` +
      `poora frame chahiye to Contain + blurred copy chuno.`,
  };
}
