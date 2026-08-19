import { DEFAULT_EASING } from "../config/easing";
import {
  DEFAULT_FIT_MODE,
  checkUpscale,
  computeFit,
  type FitMode,
  type UpscaleCheck,
} from "../config/fit";

/**
 * Zoom-pan tool (18.6 / 18.7 / 18.8).
 *
 * ⚠️ Yahan koi naya "zoom feature" nahi banta. User preview par ek chaukor
 * kheenchta hai, aur ye function usse **`transform.scale` aur `transform.x/y` ke
 * keyframes** bana deta hai — wahi keyframes jo user haath se laga sakta tha.
 *
 * Yahi is poore product ka niyam hai (Dynamic rule): zoom ko apna field banane
 * par uspar undo, curve editor, copy-paste aur AI patch — kuch bhi apne aap kaam
 * nahi karta, aur har ek ke liye alag code likhna padta.
 */

/** Frame ke andar ek chaukor, 0..1 me (frame ki chaudai/oonchai ka hissa). */
export interface ZoomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoomStep {
  /** Item ke apne start se frame. */
  frame: number;
  /** Kahan zoom karna hai. Poora frame (`0,0,1,1`) = koi zoom nahi. */
  rect: ZoomRect;
  easing?: string;
}

export interface ZoomPanInput {
  steps: readonly ZoomStep[];
  /** Project ka frame — position pixels me nikalti hai. */
  frame: { width: number; height: number };
  /** Item ka apna base scale (jo pehle se laga hai). */
  baseScale?: number;
}

export interface KeyframePatch {
  path: string;
  frame: number;
  value: number;
  easing: string;
}

/**
 * Chaukor ko scale + position me badlo.
 *
 * Zoom ka matlab: chuna hua chaukor frame me poora dikhe.
 *
 * Chaudai ke liye `1 / rect.width` chahiye aur oonchai ke liye `1 / rect.height`.
 * In dono me se **chhoti** li jaati hai — badi lene par chaukor ka ek kinara
 * frame se bahar nikal jaata, yaani user ne jo chuna wo poora dikhta hi nahi.
 *
 * Aur position: chaukor ka beech frame ke beech par aana chahiye.
 */
function rectToTransform(
  rect: ZoomRect,
  frame: { width: number; height: number },
  baseScale: number,
): { scale: number; x: number; y: number } {
  const width = Math.max(0.02, Math.min(1, rect.width));
  const height = Math.max(0.02, Math.min(1, rect.height));

  // Dono taraf poora bharne ke liye jo chahiye, usme se chhoti — taaki chuna
  // hua poora hissa frame ke andar rahe.
  const scale = Math.min(1 / width, 1 / height);

  const centerX = rect.x + width / 2;
  const centerY = rect.y + height / 2;

  /*
   * Position ka ganit: item pehle scale hota hai (frame ke beech se), phir
   * translate. Chaukor ka beech (0..1 me) frame ke beech par laane ke liye use
   * ulti disha me utna khiskana padta hai jitna wo beech se door hai — aur wo
   * doori scale se guna hoti hai, kyunki khiskaana scale ke **baad** dikhta hai.
   */
  return {
    scale: baseScale * scale,
    x: -(centerX - 0.5) * frame.width * scale,
    y: -(centerY - 0.5) * frame.height * scale,
  };
}

/**
 * Zoom steps se keyframes banao.
 *
 * Lautaye gaye patches seedha `addKeyframe` op me jaate hain — yahan doc ko
 * haath nahi lagta, taaki ye function pure rahe aur test se guzar sake.
 */
export function zoomPanKeyframes(input: ZoomPanInput): KeyframePatch[] {
  const baseScale = input.baseScale ?? 1;
  const patches: KeyframePatch[] = [];

  const steps = [...input.steps].sort((a, b) => a.frame - b.frame);
  for (const step of steps) {
    const { scale, x, y } = rectToTransform(step.rect, input.frame, baseScale);
    const easing = step.easing ?? DEFAULT_EASING;
    const frame = Math.max(0, Math.round(step.frame));

    patches.push({ path: "transform.scale", frame, value: scale, easing });
    patches.push({ path: "transform.x", frame, value: x, easing });
    patches.push({ path: "transform.y", frame, value: y, easing });
  }
  return patches;
}

/* ------------------------------------------------------------- presets */

export interface ZoomPreset {
  id: string;
  label: string;
  hint: string;
  /** Steps me frame **seconds** me hai — clip ki apni lambai par map hota hai. */
  steps: readonly { atSeconds: number; rect: ZoomRect }[];
}

/**
 * Zoom presets (18.7) — **sirf param sets**, koi code nahi.
 *
 * Har preset ek chhoti kahani hai: kahan se shuru, kahan rukna, kahan wapas.
 */
export const ZOOM_PRESETS: readonly ZoomPreset[] = [
  {
    id: "zoom-center",
    label: "Beech me zoom",
    hint: "Poore se beech ke aadhe hisse tak — sabse aam",
    steps: [
      { atSeconds: 0, rect: { x: 0, y: 0, width: 1, height: 1 } },
      { atSeconds: 1.5, rect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } },
    ],
  },
  {
    id: "zoom-top",
    label: "Upar wale hisse par",
    hint: "Screen ke upar ka hissa — header, title bar",
    steps: [
      { atSeconds: 0, rect: { x: 0, y: 0, width: 1, height: 1 } },
      { atSeconds: 1.2, rect: { x: 0.1, y: 0.05, width: 0.8, height: 0.35 } },
    ],
  },
  {
    id: "pan-down",
    label: "Neeche pan karo",
    hint: "List scroll dikhane ke liye — zoom wahi rehta hai, sirf jagah badalti hai",
    steps: [
      { atSeconds: 0, rect: { x: 0.1, y: 0.05, width: 0.8, height: 0.45 } },
      { atSeconds: 2.5, rect: { x: 0.1, y: 0.5, width: 0.8, height: 0.45 } },
    ],
  },
  {
    id: "highlight-button",
    label: "Button par jao aur wapas",
    hint: "Zoom in, ek pal ruko, phir poora dikhao",
    steps: [
      { atSeconds: 0, rect: { x: 0, y: 0, width: 1, height: 1 } },
      { atSeconds: 1, rect: { x: 0.2, y: 0.6, width: 0.6, height: 0.25 } },
      { atSeconds: 2.2, rect: { x: 0.2, y: 0.6, width: 0.6, height: 0.25 } },
      { atSeconds: 3.2, rect: { x: 0, y: 0, width: 1, height: 1 } },
    ],
  },
];

export function findZoomPreset(id: string): ZoomPreset | undefined {
  return ZOOM_PRESETS.find((preset) => preset.id === id);
}

/* ------------------------------------------------- upscale ki chetavni (18.8) */

/**
 * Zoom ke baad resolution ka jawab (18.8).
 *
 * ⚠️ Asli ganit `config/fit.ts` ke `checkUpscale()` me hai aur wahi chalta hai —
 * yahan dobara nahi likha gaya. Do jagah ek hi hisaab rakhne par ek din fit wala
 * check kuch aur kehta aur zoom wala kuch aur, aur user dono me se kisi par
 * bharosa nahi karta.
 *
 * Yahan sirf do cheezein judti hain: zoom steps se **sabse bada scale** nikalna,
 * aur jawab ke saath ek kaam ki salah dena.
 */
export interface ZoomUpscaleCheck {
  /** Sabse zyada scale jo lagega. */
  maxScale: number;
  /** `checkUpscale()` ka poora jawab — required vs actual pixels. */
  upscale: UpscaleCheck;
  level: "ok" | "warning" | "error";
  /** Kya karna chahiye — exact numbers ke saath. `null` = kuch nahi. */
  advice: string | null;
}

/**
 * Zoom se resolution kam to nahi pad rahi? (18.8)
 *
 * ⚠️ Sirf "blurry lagega" likhna bekaar hota — usse user kuch nahi kar sakta.
 * Yahan exact number aata hai ("2160p chahiye, source 1080p"), aur uske saath ek
 * seedha kaam: recording kitni chaudi dobara leni hai.
 *
 * Hadd:
 *  - 1.0x tak         — theek
 *  - 1.0x se 1.15x    — chetavni (itna upscale aankh ko lagbhag nahi dikhta)
 *  - 1.15x se upar    — galti (yahan blur saaf dikhta hai)
 */
export function checkZoomUpscale(args: {
  steps: readonly ZoomStep[];
  source: { width: number; height: number };
  frame: { width: number; height: number };
  fitMode?: FitMode;
  baseScale?: number;
}): ZoomUpscaleCheck {
  const baseScale = args.baseScale ?? 1;

  let maxScale = baseScale;
  for (const step of args.steps) {
    const width = Math.max(0.02, Math.min(1, step.rect.width));
    const height = Math.max(0.02, Math.min(1, step.rect.height));
    maxScale = Math.max(maxScale, baseScale * Math.min(1 / width, 1 / height));
  }

  const fit = computeFit(args.source, args.frame, args.fitMode ?? DEFAULT_FIT_MODE);
  const upscale = checkUpscale(args.source, args.frame, fit, maxScale);

  if (!upscale.upscaled) {
    return { maxScale, upscale, level: "ok", advice: null };
  }

  const level = upscale.factor <= 1.15 ? "warning" : "error";
  const neededWidth = upscale.requiredSource.width;

  return {
    maxScale,
    upscale,
    level,
    advice:
      level === "error"
        ? `Recording kam se kam ${neededWidth}px chaudi dobara lo, ya zoom ${(maxScale / upscale.factor).toFixed(2)}x tak rakho.`
        : `Thoda blur aayega — chalega, par ${neededWidth}px par dobara lena behtar hai.`,
  };
}
