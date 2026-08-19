import { z } from "zod";

import { clamp01, getEasingFunction } from "../keyframes/easing";
import type { AnimationOutput } from "./animations";
import { createRegistry, type ControlDescriptor, type Registry } from "./types";

/**
 * TRANSITIONS — do clips ke jod par kya ho (10.4).
 *
 * ⚠️ **Yahan ek design faisla hai jo saaf likhna zaroori hai.**
 *
 * Transition do tarah se banaya ja sakta tha:
 *  (a) ek alag "transition component" jo do clips ko ek saath render kare, ya
 *  (b) har clip ka apna in/out effect, jo overlap par apne aap crossfade banta hai.
 *
 * Yahan **(b)** hai, aur wajah `@remotion/transitions` se meri naaraazgi nahi —
 * wajah ye hai ki (a) ke liye timeline ka model badalna padta: do clips ko ek
 * "transition ki jodi" me baandhna padta, aur uske baad unhe alag-alag sarkana,
 * trim karna ya delete karna Phase 8 ke saare ops ko todta. (b) me transition
 * **clip ki apni property** hai (`transitionIn` / `transitionOut`), overlap
 * timeline par saaf dikhta hai (10.5 ka "implicit magic nahi"), aur crossfade
 * apne aap ban jaata hai: neeche wali clip fade-out, upar wali fade-in.
 *
 * Isi wajah se transition aur animation dono ek hi pipeline se guzarte hain —
 * dono `AnimationOutput` dete hain aur `Transformed` unhe milata hai. Do alag
 * pipeline rakhne par "transition ke dauraan animation ruk gayi" jaise bug
 * banate hain.
 */

export interface TransitionContext {
  /** 0 = transition ki shuruaat, 1 = poori tarah lag chuki. */
  progress: number;
  /** `in` = clip andar aa rahi hai, `out` = ja rahi hai. */
  side: "in" | "out";
  params: Record<string, unknown>;
  frame: { width: number; height: number };
}

export interface TransitionOutput extends AnimationOutput {
  /** CSS `clip-path` — wipe jaisi cheezon ke liye. */
  clipPath?: string;
}

export interface TransitionEntry {
  id: string;
  label: string;
  icon: string;
  hint: string;
  schema: z.ZodTypeAny;
  defaults: Record<string, unknown>;
  controls: readonly ControlDescriptor[];
  apply(context: TransitionContext): TransitionOutput;
}

const EASING_FIELD = z.string().default("ease-in-out");

const EASING_CONTROL: ControlDescriptor = {
  path: "easing",
  control: "select",
  label: "Easing",
  group: "Transition",
  options: ["linear", "ease", "ease-in", "ease-out", "ease-in-out"].map((id) => ({
    value: id,
    label: id,
  })),
};

function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(params: Record<string, unknown>, key: string, fallback: string): string {
  const value = params[key];
  return typeof value === "string" ? value : fallback;
}

function eased(context: TransitionContext): number {
  return getEasingFunction(str(context.params, "easing", "ease-in-out"))(clamp01(context.progress));
}

export const BUILTIN_TRANSITIONS: readonly TransitionEntry[] = [
  {
    id: "none",
    label: "Cut",
    icon: "Square",
    hint: "Koi transition nahi — seedha cut",
    schema: z.object({}),
    defaults: {},
    controls: [],
    // Cut ka matlab hi "kuch mat karo" hai. Ye entry isliye hai ki UI ka
    // dropdown registry se bane aur "cut" bhi ek asli chunaav lage.
    apply: () => ({}),
  },
  {
    id: "fade",
    label: "Fade",
    icon: "Layers",
    hint: "Kaale/paardarshi se andar-bahar",
    schema: z.object({ easing: EASING_FIELD }),
    defaults: { easing: "ease-in-out" },
    controls: [EASING_CONTROL],
    apply: (context) => ({ opacity: eased(context) }),
  },
  {
    /*
     * Crossfade aur fade ka farak dikhne me nahi, **matlab** me hai: crossfade
     * tabhi crossfade hai jab do clips overlap kar rahi hon. Isliye ye alag
     * entry hai — UI me user ko yahi shabd chahiye hota hai, aur uska hint use
     * bata deta hai ki overlap zaroori hai.
     */
    id: "crossfade",
    label: "Crossfade",
    icon: "Layers",
    hint: "Do clips ka overlap chahiye — ek ghulti hai, doosri ubharti hai",
    schema: z.object({ easing: EASING_FIELD }),
    defaults: { easing: "linear" },
    controls: [EASING_CONTROL],
    apply: (context) => ({ opacity: eased(context) }),
  },
  {
    id: "slide",
    label: "Slide",
    icon: "Layers",
    hint: "Kinare se sarak kar aana/jaana",
    schema: z.object({
      direction: z.enum(["left", "right", "up", "down"]).default("left"),
      easing: EASING_FIELD,
    }),
    defaults: { direction: "left", easing: "ease-out" },
    controls: [
      {
        path: "direction",
        control: "segmented",
        label: "Disha",
        group: "Transition",
        options: [
          { value: "left", label: "←" },
          { value: "right", label: "→" },
          { value: "up", label: "↑" },
          { value: "down", label: "↓" },
        ],
      },
      EASING_CONTROL,
    ],
    apply: (context) => {
      // `in` me clip bahar se andar aati hai, `out` me andar se bahar jaati hai.
      const away = context.side === "in" ? 1 - eased(context) : 1 - eased(context);
      const sign = context.side === "in" ? 1 : -1;
      const direction = str(context.params, "direction", "left");

      const dx = context.frame.width * away * sign;
      const dy = context.frame.height * away * sign;

      if (direction === "left") return { x: -dx };
      if (direction === "right") return { x: dx };
      if (direction === "up") return { y: -dy };
      return { y: dy };
    },
  },
  {
    id: "zoom",
    label: "Zoom",
    icon: "Image",
    hint: "Chhote/bade se andar-bahar",
    schema: z.object({
      from: z.number().positive().default(1.3),
      easing: EASING_FIELD,
    }),
    defaults: { from: 1.3, easing: "ease-out" },
    controls: [
      { path: "from", control: "slider", label: "Se", group: "Transition", min: 0.2, max: 3, step: 0.01 },
      EASING_CONTROL,
    ],
    apply: (context) => {
      const from = num(context.params, "from", 1.3);
      const t = eased(context);
      return { scale: from + (1 - from) * t, opacity: t };
    },
  },
  {
    id: "blur",
    label: "Blur",
    icon: "Layers",
    hint: "Dhundhle se saaf",
    schema: z.object({
      blurPx: z.number().min(0).max(100).default(24),
      easing: EASING_FIELD,
    }),
    defaults: { blurPx: 24, easing: "ease-out" },
    controls: [
      { path: "blurPx", control: "slider", label: "Blur", group: "Transition", min: 0, max: 80, step: 1, unit: "px" },
      EASING_CONTROL,
    ],
    apply: (context) => {
      const t = eased(context);
      return { blur: num(context.params, "blurPx", 24) * (1 - t), opacity: t };
    },
  },
  {
    id: "wipe",
    label: "Wipe",
    icon: "Layers",
    hint: "Ek taraf se pardah hatna",
    schema: z.object({
      direction: z.enum(["left", "right", "up", "down"]).default("left"),
      easing: EASING_FIELD,
    }),
    defaults: { direction: "left", easing: "linear" },
    controls: [
      {
        path: "direction",
        control: "segmented",
        label: "Disha",
        group: "Transition",
        options: [
          { value: "left", label: "←" },
          { value: "right", label: "→" },
          { value: "up", label: "↑" },
          { value: "down", label: "↓" },
        ],
      },
      EASING_CONTROL,
    ],
    apply: (context) => {
      // `inset()` ke chaar hisse: top right bottom left. Transition ke saath
      // ek taraf ka pardah 100% se 0% par aata hai.
      const hidden = (1 - eased(context)) * 100;
      const direction = str(context.params, "direction", "left");

      if (direction === "left") return { clipPath: `inset(0 ${hidden}% 0 0)` };
      if (direction === "right") return { clipPath: `inset(0 0 0 ${hidden}%)` };
      if (direction === "up") return { clipPath: `inset(0 0 ${hidden}% 0)` };
      return { clipPath: `inset(${hidden}% 0 0 0)` };
    },
  },
];

export const TRANSITIONS: Registry<TransitionEntry> =
  createRegistry<TransitionEntry>("TRANSITIONS");

export function registerTransition(entry: TransitionEntry): void {
  TRANSITIONS.register(entry);
}

export function listTransitions(): readonly TransitionEntry[] {
  return TRANSITIONS.list();
}

export function getTransition(id: string): TransitionEntry | undefined {
  return TRANSITIONS.get(id);
}

export function requireTransition(id: string): TransitionEntry {
  return TRANSITIONS.require(id);
}

/**
 * Transition ki lambai clip me sama sakti hai ya nahi (10.6).
 *
 * Do transitions (in + out) milkar clip se lambi nahi ho sakti — warna clip ka
 * beech ka hissa kabhi poora dikhta hi nahi. Aur har transition ke liye kam se
 * kam ek frame bachna chahiye jo poori tarah dikhe, warna clip sirf ek jhilmil
 * ban jaati hai.
 *
 * ⚠️ Ye **clamp** karta hai, error nahi deta — user clip ko chhota kar sakta hai
 * aur tab uski purani transition apne aap sim jaani chahiye. Par UI ko batana
 * zaroori hai, isliye `clamped` bhi lautta hai.
 */
export function clampTransitionFrames(args: {
  durationInFrames: number;
  inFrames: number;
  outFrames: number;
}): { inFrames: number; outFrames: number; clamped: boolean } {
  const clip = Math.max(1, Math.round(args.durationInFrames));
  let inFrames = Math.max(0, Math.round(args.inFrames));
  let outFrames = Math.max(0, Math.round(args.outFrames));

  // Kam se kam ek frame poora dikhna chahiye.
  const budget = Math.max(0, clip - 1);
  const wanted = inFrames + outFrames;

  if (wanted <= budget) return { inFrames, outFrames, clamped: false };
  if (wanted === 0) return { inFrames: 0, outFrames: 0, clamped: false };

  // Dono ko usi anupaat me chhota karo — ek ko poora kaat dena galat lagta hai.
  const factor = budget / wanted;
  inFrames = Math.floor(inFrames * factor);
  outFrames = Math.floor(outFrames * factor);
  return { inFrames, outFrames, clamped: true };
}

/**
 * Is frame par clip ki transition ka nateeja (10.5).
 *
 * `null` matlab is frame par koi transition nahi chal rahi — caller tab kuch
 * extra nahi lagata.
 */
export function transitionOutputAt(args: {
  localFrame: number;
  durationInFrames: number;
  /*
   * Params bhi saath aate hain (`direction`, `easing`…) — isliye ye ek khula
   * record hai. `TransitionSchema` bhi `passthrough` hai, dono ek hi baat
   * kehte hain: transition ke params uski apni registry entry ke schema se
   * tay hote hain, is jagah se nahi.
   */
  transitionIn: { type: string; durationInFrames: number } & Record<string, unknown>;
  transitionOut: { type: string; durationInFrames: number } & Record<string, unknown>;
  frame: { width: number; height: number };
}): TransitionOutput | null {
  const clamped = clampTransitionFrames({
    durationInFrames: args.durationInFrames,
    inFrames: args.transitionIn.durationInFrames,
    outFrames: args.transitionOut.durationInFrames,
  });

  if (clamped.inFrames > 0 && args.localFrame < clamped.inFrames) {
    const entry = TRANSITIONS.get(args.transitionIn.type);
    if (entry && entry.id !== "none") {
      const { type: _type, durationInFrames: _d, ...params } = args.transitionIn as Record<
        string,
        unknown
      >;
      return entry.apply({
        progress: args.localFrame / clamped.inFrames,
        side: "in",
        params,
        frame: args.frame,
      });
    }
  }

  const outStart = args.durationInFrames - clamped.outFrames;
  if (clamped.outFrames > 0 && args.localFrame >= outStart) {
    const entry = TRANSITIONS.get(args.transitionOut.type);
    if (entry && entry.id !== "none") {
      const { type: _type, durationInFrames: _d, ...params } = args.transitionOut as Record<
        string,
        unknown
      >;
      // Out me progress ulti chalti hai: 1 (poori dikh rahi) se 0 (gayab).
      const done = (args.localFrame - outStart) / clamped.outFrames;
      return entry.apply({ progress: 1 - done, side: "out", params, frame: args.frame });
    }
  }

  return null;
}
