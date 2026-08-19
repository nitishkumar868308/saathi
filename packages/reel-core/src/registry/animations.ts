import { z } from "zod";

import { EASING_IDS } from "../config/easing";
import { clamp01, getEasingFunction } from "../keyframes/easing";
import type { Item } from "../schema/project";
import { createRegistry, type ControlDescriptor, type Registry } from "./types";

/**
 * ANIMATIONS — animation ek **plugin** hai, feature nahi (10.1).
 *
 * Naya animation add karna do cheezon ka kaam hai: yahan ek entry, aur bas.
 * Renderer, properties panel, aur validator teeno isi list se chalte hain —
 * kisi bhi doosri file me `if (type === "kenburns")` likhna mana hai.
 *
 * ⚠️ **Animation item ke transform ke upar compose hota hai, use badalta nahi**
 * (10.1). Ye sabse zaroori niyam hai: agar animation `transform.scale` ko
 * overwrite kar de, to user ka apna zoom aur uske keyframes chup-chaap gayab ho
 * jaate hain. Isliye har animation ek **delta** deta hai — scale gunaa hoti hai,
 * position judti hai — aur `composeAnimations()` unhe milata hai.
 */

/** Animation kis frame par kya de raha hai. Sab optional; jo na de wo "koi badlav nahi". */
export interface AnimationOutput {
  /** Guna hota hai (1 = koi badlav nahi). */
  scale?: number;
  /** Judta hai (project pixels me). */
  x?: number;
  y?: number;
  /** Judta hai (degrees). */
  rotation?: number;
  /** Guna hota hai (1 = poora dikhe). */
  opacity?: number;
  /** Judta hai (px). CSS filter me jaata hai. */
  blur?: number;
}

export interface AnimationContext {
  /** Item ke andar kitna aage — 0 se 1. */
  progress: number;
  localFrame: number;
  durationInFrames: number;
  params: Record<string, unknown>;
  /** Project ka frame — pan/slide ki doori isi ke percent me hoti hai. */
  frame: { width: number; height: number };
}

export interface AnimationEntry {
  id: string;
  label: string;
  icon: string;
  /** UI grouping — "Motion" / "Entry" / "Exit". */
  kind: "motion" | "entry" | "exit";
  hint: string;
  schema: z.ZodTypeAny;
  defaults: Record<string, unknown>;
  controls: readonly ControlDescriptor[];
  apply(context: AnimationContext): AnimationOutput;
  /**
   * Ye animation zyada se zyada kitni scale maang sakta hai (10.11).
   *
   * Upscale ki chetavni ke liye **sabse bada** scale chahiye, chalte hue wala
   * nahi — Ken Burns me blur clip ke *aakhir* me aata hai, aur sirf shuruaati
   * scale dekhne se sab theek lagta hai.
   */
  maxScale(params: Record<string, unknown>): number;
}

const EASING_CONTROL: ControlDescriptor = {
  path: "easing",
  control: "select",
  label: "Easing",
  group: "Animation",
  options: EASING_IDS.map((id) => ({ value: id, label: id })),
};

const EASING_FIELD = z.string().default("ease-in-out");

function easedProgress(context: AnimationContext): number {
  const easing = typeof context.params.easing === "string" ? context.params.easing : "ease-in-out";
  return getEasingFunction(easing)(clamp01(context.progress));
}

function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(params: Record<string, unknown>, key: string, fallback: string): string {
  const value = params[key];
  return typeof value === "string" ? value : fallback;
}

/* ------------------------------------------------------------- built-ins */

export const BUILTIN_ANIMATIONS: readonly AnimationEntry[] = [
  {
    id: "kenburns",
    label: "Ken Burns",
    icon: "Image",
    kind: "motion",
    hint: "Dheere-dheere zoom — sthir tasveer ko zinda karta hai",
    schema: z.object({
      from: z.number().positive().default(1),
      to: z.number().positive().default(1.2),
      /** Kis bindu ki taraf zoom ho — 0..1 me, 0.5/0.5 = beech. */
      focalX: z.number().min(0).max(1).default(0.5),
      focalY: z.number().min(0).max(1).default(0.5),
      easing: EASING_FIELD,
    }),
    defaults: { from: 1, to: 1.2, focalX: 0.5, focalY: 0.5, easing: "linear" },
    controls: [
      { path: "from", control: "slider", label: "Zoom se", group: "Animation", min: 0.5, max: 3, step: 0.01 },
      { path: "to", control: "slider", label: "Zoom tak", group: "Animation", min: 0.5, max: 3, step: 0.01 },
      { path: "focalX", control: "slider", label: "Focus X", group: "Animation", min: 0, max: 1, step: 0.01 },
      { path: "focalY", control: "slider", label: "Focus Y", group: "Animation", min: 0, max: 1, step: 0.01 },
      EASING_CONTROL,
    ],
    apply: (context) => {
      const from = num(context.params, "from", 1);
      const to = num(context.params, "to", 1.2);
      const scale = from + (to - from) * easedProgress(context);

      /*
       * Focal point ka matlab: zoom karte waqt kaunsa bindu apni jagah rahe.
       * Beech (0.5) se jitna door hai, utna item ko ulti disha me khiskana padta
       * hai — warna zoom hamesha frame ke beech ki taraf hota hai aur chehra
       * kinare par ho to wo bahar nikal jaata hai.
       */
      const focalX = num(context.params, "focalX", 0.5);
      const focalY = num(context.params, "focalY", 0.5);
      const drift = scale - 1;

      return {
        scale,
        x: -(focalX - 0.5) * context.frame.width * drift,
        y: -(focalY - 0.5) * context.frame.height * drift,
      };
    },
    maxScale: (params) => Math.max(num(params, "from", 1), num(params, "to", 1.2)),
  },

  {
    id: "pan",
    label: "Pan",
    icon: "Video",
    kind: "motion",
    hint: "Ek taraf se doosri taraf khisakna",
    schema: z.object({
      direction: z.enum(["left", "right", "up", "down"]).default("left"),
      /** Frame ke percent me — pixels nahi, taaki har size par ek jaisa lage. */
      amountPercent: z.number().min(0).max(100).default(10),
      easing: EASING_FIELD,
    }),
    defaults: { direction: "left", amountPercent: 10, easing: "ease-in-out" },
    controls: [
      {
        path: "direction",
        control: "segmented",
        label: "Disha",
        group: "Animation",
        options: [
          { value: "left", label: "←" },
          { value: "right", label: "→" },
          { value: "up", label: "↑" },
          { value: "down", label: "↓" },
        ],
      },
      { path: "amountPercent", control: "slider", label: "Kitna", group: "Animation", min: 0, max: 50, step: 1, unit: "%" },
      EASING_CONTROL,
    ],
    apply: (context) => {
      const direction = str(context.params, "direction", "left");
      const amount = num(context.params, "amountPercent", 10) / 100;
      const t = easedProgress(context);

      const dx = context.frame.width * amount * t;
      const dy = context.frame.height * amount * t;

      if (direction === "left") return { x: -dx };
      if (direction === "right") return { x: dx };
      if (direction === "up") return { y: -dy };
      return { y: dy };
    },
    // Pan scale nahi badalta — par khiskne se kinara khaali na ho, iske liye
    // thoda zoom chahiye hota hai. Wo user ka faisla hai, isliye yahan 1.
    maxScale: () => 1,
  },

  {
    id: "fade",
    label: "Fade",
    icon: "Layers",
    kind: "entry",
    hint: "Andar aana / bahar jaana",
    schema: z.object({
      mode: z.enum(["in", "out", "both"]).default("in"),
      durationInFrames: z.number().int().min(1).default(15),
      easing: EASING_FIELD,
    }),
    defaults: { mode: "in", durationInFrames: 15, easing: "ease-out" },
    controls: [
      {
        path: "mode",
        control: "segmented",
        label: "Kab",
        group: "Animation",
        options: [
          { value: "in", label: "In" },
          { value: "out", label: "Out" },
          { value: "both", label: "Dono" },
        ],
      },
      { path: "durationInFrames", control: "number", label: "Lambai", group: "Animation", min: 1, step: 1, unit: "frames" },
      EASING_CONTROL,
    ],
    apply: (context) => {
      const mode = str(context.params, "mode", "in");
      const span = Math.max(1, num(context.params, "durationInFrames", 15));
      const easing = getEasingFunction(str(context.params, "easing", "ease-out"));

      let opacity = 1;
      if (mode === "in" || mode === "both") {
        opacity = Math.min(opacity, easing(clamp01(context.localFrame / span)));
      }
      if (mode === "out" || mode === "both") {
        const left = context.durationInFrames - context.localFrame;
        opacity = Math.min(opacity, easing(clamp01(left / span)));
      }
      return { opacity };
    },
    maxScale: () => 1,
  },

  {
    id: "slide",
    label: "Slide in",
    icon: "Layers",
    kind: "entry",
    hint: "Kinare se andar aana",
    schema: z.object({
      direction: z.enum(["left", "right", "up", "down"]).default("up"),
      distancePercent: z.number().min(0).max(200).default(20),
      durationInFrames: z.number().int().min(1).default(15),
      easing: EASING_FIELD,
    }),
    defaults: { direction: "up", distancePercent: 20, durationInFrames: 15, easing: "ease-out" },
    controls: [
      {
        path: "direction",
        control: "segmented",
        label: "Kahan se",
        group: "Animation",
        options: [
          { value: "left", label: "←" },
          { value: "right", label: "→" },
          { value: "up", label: "↑" },
          { value: "down", label: "↓" },
        ],
      },
      { path: "distancePercent", control: "slider", label: "Doori", group: "Animation", min: 0, max: 100, step: 1, unit: "%" },
      { path: "durationInFrames", control: "number", label: "Lambai", group: "Animation", min: 1, step: 1, unit: "frames" },
      EASING_CONTROL,
    ],
    apply: (context) => {
      const span = Math.max(1, num(context.params, "durationInFrames", 15));
      const t = getEasingFunction(str(context.params, "easing", "ease-out"))(
        clamp01(context.localFrame / span),
      );
      // 1 se 0 — shuru me poori doori par, phir apni jagah.
      const away = 1 - t;
      const direction = str(context.params, "direction", "up");
      const distance = num(context.params, "distancePercent", 20) / 100;

      const dx = context.frame.width * distance * away;
      const dy = context.frame.height * distance * away;

      if (direction === "left") return { x: -dx };
      if (direction === "right") return { x: dx };
      if (direction === "up") return { y: -dy };
      return { y: dy };
    },
    maxScale: () => 1,
  },

  {
    id: "scalePop",
    label: "Scale pop",
    icon: "Square",
    kind: "entry",
    hint: "Chhote se apne naap tak — spring ke saath achha lagta hai",
    schema: z.object({
      from: z.number().positive().default(0.6),
      durationInFrames: z.number().int().min(1).default(12),
      easing: EASING_FIELD,
    }),
    defaults: { from: 0.6, durationInFrames: 12, easing: "spring" },
    controls: [
      { path: "from", control: "slider", label: "Se", group: "Animation", min: 0.1, max: 2, step: 0.01 },
      { path: "durationInFrames", control: "number", label: "Lambai", group: "Animation", min: 1, step: 1, unit: "frames" },
      EASING_CONTROL,
    ],
    apply: (context) => {
      const span = Math.max(1, num(context.params, "durationInFrames", 12));
      const t = getEasingFunction(str(context.params, "easing", "spring"))(
        clamp01(context.localFrame / span),
      );
      const from = num(context.params, "from", 0.6);
      return { scale: from + (1 - from) * t };
    },
    // 1 se upar se shuru karne wala pop upscale maang sakta hai.
    maxScale: (params) => Math.max(1, num(params, "from", 0.6)),
  },

  {
    /*
     * 10.12 ka saboot yahi entry hai: `rotateIn` sirf **is file me ek entry**
     * hai. Koi component, koi switch, koi panel code kahin nahi juda — aur
     * `git diff --stat` me bhi wahi dikhta hai.
     */
    id: "rotateIn",
    label: "Rotate in",
    icon: "Layers",
    kind: "entry",
    hint: "Ghoomte hue andar aana",
    schema: z.object({
      degrees: z.number().default(-12),
      durationInFrames: z.number().int().min(1).default(14),
      easing: EASING_FIELD,
    }),
    defaults: { degrees: -12, durationInFrames: 14, easing: "ease-out" },
    controls: [
      { path: "degrees", control: "slider", label: "Kitna ghooma", group: "Animation", min: -180, max: 180, step: 1, unit: "deg" },
      { path: "durationInFrames", control: "number", label: "Lambai", group: "Animation", min: 1, step: 1, unit: "frames" },
      EASING_CONTROL,
    ],
    apply: (context) => {
      const span = Math.max(1, num(context.params, "durationInFrames", 14));
      const t = getEasingFunction(str(context.params, "easing", "ease-out"))(
        clamp01(context.localFrame / span),
      );
      return { rotation: num(context.params, "degrees", -12) * (1 - t) };
    },
    maxScale: () => 1,
  },

  {
    id: "blurIn",
    label: "Blur in",
    icon: "Layers",
    kind: "entry",
    hint: "Dhundhle se saaf hona",
    schema: z.object({
      blurPx: z.number().min(0).max(100).default(20),
      durationInFrames: z.number().int().min(1).default(14),
      easing: EASING_FIELD,
    }),
    defaults: { blurPx: 20, durationInFrames: 14, easing: "ease-out" },
    controls: [
      { path: "blurPx", control: "slider", label: "Blur", group: "Animation", min: 0, max: 60, step: 1, unit: "px" },
      { path: "durationInFrames", control: "number", label: "Lambai", group: "Animation", min: 1, step: 1, unit: "frames" },
      EASING_CONTROL,
    ],
    apply: (context) => {
      const span = Math.max(1, num(context.params, "durationInFrames", 14));
      const t = getEasingFunction(str(context.params, "easing", "ease-out"))(
        clamp01(context.localFrame / span),
      );
      return { blur: num(context.params, "blurPx", 20) * (1 - t) };
    },
    maxScale: () => 1,
  },
];

export const ANIMATIONS: Registry<AnimationEntry> = createRegistry<AnimationEntry>("ANIMATIONS");

export function registerAnimation(entry: AnimationEntry): void {
  ANIMATIONS.register(entry);
}

export function listAnimations(): readonly AnimationEntry[] {
  return ANIMATIONS.list();
}

export function getAnimation(id: string): AnimationEntry | undefined {
  return ANIMATIONS.get(id);
}

export function requireAnimation(id: string): AnimationEntry {
  return ANIMATIONS.require(id);
}

/* --------------------------------------------------------------- compose */

/** Kuch na badle to yahi — har compose isi se shuru hota hai. */
export const IDENTITY_ANIMATION: Required<AnimationOutput> = {
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  blur: 0,
};

/**
 * Item ke saare animations ko is frame par milao (10.1 / 10.9).
 *
 * **Kram matlab rakhta hai** aur wahi list ka kram hai (10.9). Scale aur opacity
 * **guna** hote hain, position aur rotation **judte** hain, blur judta hai —
 * isliye do animations ek doosre ko mitate nahi, dono lagte hain. Ken Burns +
 * fade-in ek saath chalana isi wajah se kaam karta hai.
 *
 * ⚠️ Anjaan `type` chup-chaap chhod diya jaata hai, error nahi. Purana doc kisi
 * aise animation ka naam le sakta hai jo ab nahi hai; uske liye poora render
 * rok dena galat hoga — aur uski shikayat Phase 20 ka validator karega, jo isi
 * registry ko padhta hai.
 */
export function composeAnimations(
  item: Item,
  localFrame: number,
  frame: { width: number; height: number },
): Required<AnimationOutput> {
  const out = { ...IDENTITY_ANIMATION };
  if (item.animations.length === 0) return out;

  const duration = Math.max(1, item.durationInFrames);
  const progress = clamp01(localFrame / duration);

  for (const animation of item.animations) {
    if (animation.enabled === false) continue;
    const entry = ANIMATIONS.get(animation.type);
    if (!entry) continue;

    const { type: _type, enabled: _enabled, ...params } = animation as Record<string, unknown>;
    const result = entry.apply({
      progress,
      localFrame,
      durationInFrames: duration,
      params,
      frame,
    });

    if (result.scale !== undefined) out.scale *= result.scale;
    if (result.opacity !== undefined) out.opacity *= result.opacity;
    if (result.x !== undefined) out.x += result.x;
    if (result.y !== undefined) out.y += result.y;
    if (result.rotation !== undefined) out.rotation += result.rotation;
    if (result.blur !== undefined) out.blur += result.blur;
  }

  out.opacity = clamp01(out.opacity);
  out.blur = Math.max(0, out.blur);
  return out;
}

/**
 * Is item ke animations sabse zyada kitni scale maangte hain (10.11).
 *
 * Upscale ki chetavni ke liye ye zaroori hai: Ken Burns 1 → 1.4 me blur clip ke
 * **aakhir** me aata hai. Chalte hue wala scale dekhne se shuruaat me sab theek
 * lagta hai aur dhundhlapan video me baad me pakda jaata hai.
 */
export function animationsMaxScale(item: Item): number {
  let max = 1;
  for (const animation of item.animations) {
    if (animation.enabled === false) continue;
    const entry = ANIMATIONS.get(animation.type);
    if (!entry) continue;
    const { type: _type, enabled: _enabled, ...params } = animation as Record<string, unknown>;
    max = Math.max(max, entry.maxScale(params));
  }
  return max;
}

/** Naya animation banate waqt uske defaults — registry se, kahin likhe hue nahi. */
export function createAnimation(typeId: string): Record<string, unknown> {
  const entry = requireAnimation(typeId);
  return { type: entry.id, enabled: true, ...entry.defaults };
}
