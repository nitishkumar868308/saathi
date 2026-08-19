import { z } from "zod";

import { resolveItemValue } from "../keyframes/interpolate";
import type { Item } from "../schema/project";
import { createRegistry, type ControlDescriptor, type Registry } from "./types";

/**
 * EFFECTS — effect ek **configuration** hai, feature nahi (14.1).
 *
 * Har effect sirf itna batata hai ki wo style me kya jodta hai. Kaun sa item hai,
 * kis kram me lagta hai, keyframe lage hain ya nahi — ye sab `applyEffects()`
 * dekhta hai. Isliye kisi bhi item component ke andar effect ka naam likhna mana
 * hai; `ImageItem.tsx` ko ye pata bhi nahi hona chahiye ki "blur" naam ki koi
 * cheez hai.
 *
 * ⚠️ **Kram maayne rakhta hai** (14.4). CSS filters baayein se daayein lagte
 * hain: `grayscale(1) sepia(1)` aur `sepia(1) grayscale(1)` do alag nateeje dete
 * hain. Isliye stack ka kram waise ka waisa CSS me jaata hai — hum use "theek"
 * karne ki koshish nahi karte, kyunki user ne jo kram banaya wahi uska matlab hai.
 */

/** Ek effect ne style me kya joda. Sab optional; jo na de wo "koi badlav nahi". */
export interface EffectOutput {
  /** CSS `filter` ke tukde, isi kram me jud'te hain. */
  filters?: readonly string[];
  /** Seedha style — border, radius, shadow jaisi cheezein jo filter nahi hain. */
  style?: Record<string, string | number>;
  /**
   * Item ke **upar** chipakne wali ek parat (vignette).
   *
   * Filter se vignette nahi banti — wo item ke pixels badalne ka kaam nahi,
   * uske upar ek gradient rakhne ka kaam hai.
   */
  overlay?: { background: string; opacity?: number; blendMode?: string };
  /**
   * SVG filter jo browser me banana padta hai (sharpen).
   *
   * Core me React nahi hai, isliye yahan sirf **byora** jaata hai aur SVG
   * `reel-remotion` banata hai. Isse core saaf rehta hai aur effect phir bhi
   * registry-driven rehta hai.
   */
  svgFilter?: { kind: "convolve"; matrix: readonly number[]; divisor?: number };
}

export interface EffectContext {
  params: Record<string, unknown>;
  /** Project ka frame — vignette ke gradient ki naap iske hisaab se hoti hai. */
  frame: { width: number; height: number };
}

export interface EffectEntry {
  id: string;
  label: string;
  icon: string;
  /** UI grouping — "color" / "blur" / "shape" / "light". */
  kind: string;
  hint: string;
  schema: z.ZodTypeAny;
  defaults: Record<string, unknown>;
  controls: readonly ControlDescriptor[];
  /** Jin params par keyframe lag sakta hai (14.5). */
  keyframable: readonly string[];
  apply(context: EffectContext): EffectOutput;
  /**
   * Render kitna bhaari padega (14.8) — 1 = lagbhag muft.
   *
   * Ye anumaan hai, naap nahi, aur isi liye iska ek hi kaam hai: user ko pehle
   * se batana ki "blur wala stack dheema chalega". Asli naap Phase 14 ke render
   * me li gayi hai aur doc me likhi hai.
   */
  cost: number;
}

function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(params: Record<string, unknown>, key: string, fallback: string): string {
  const value = params[key];
  return typeof value === "string" ? value : fallback;
}

/** `amount` wale sabhi CSS filters ek hi jaise hain — bas naam aur hadd alag. */
function filterEffect(args: {
  id: string;
  label: string;
  icon: string;
  kind: string;
  hint: string;
  cssName: string;
  /** 1 = "koi badlav nahi" (multiply wale filters), 0 = grayscale jaise. */
  neutral: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  cost?: number;
}): EffectEntry {
  return {
    id: args.id,
    label: args.label,
    icon: args.icon,
    kind: args.kind,
    hint: args.hint,
    schema: z.object({ amount: z.number().min(args.min).max(args.max).default(args.neutral) }),
    defaults: { amount: args.neutral },
    controls: [
      {
        path: "amount",
        control: "slider",
        label: args.label,
        group: "Effect",
        min: args.min,
        max: args.max,
        step: args.step,
        ...(args.unit ? { unit: args.unit } : {}),
        keyframable: true,
      },
    ],
    keyframable: ["amount"],
    apply: ({ params }) => {
      const amount = num(params, "amount", args.neutral);
      // Neutral par filter likhna hi nahi — har filter browser ko ek naya layer
      // banane par majboor karta hai, chahe wo kuch badle ya na badle.
      if (amount === args.neutral) return {};
      /*
       * Unit CSS me jaana **zaroori** hai: `hue-rotate(30)` invalid hai,
       * `hue-rotate(30deg)` sahi. Invalid filter browser poora chhod deta hai —
       * yaani effect chup-chaap gayab, bina kisi error ke.
       */
      const unit = args.unit === "deg" || args.unit === "%" ? args.unit : "";
      return { filters: [`${args.cssName}(${amount}${unit})`] };
    },
    cost: args.cost ?? 1,
  };
}

/* ------------------------------------------------------------- built-ins */

export const BUILTIN_EFFECTS: readonly EffectEntry[] = [
  {
    id: "blur",
    label: "Blur",
    icon: "Droplet",
    kind: "blur",
    hint: "Dhundhla — background ko peeche bhejne ke liye",
    schema: z.object({ radius: z.number().min(0).max(100).default(4) }),
    defaults: { radius: 4 },
    controls: [
      {
        path: "radius",
        control: "slider",
        label: "Radius",
        group: "Effect",
        min: 0,
        max: 100,
        step: 0.5,
        unit: "px",
        keyframable: true,
      },
    ],
    keyframable: ["radius"],
    apply: ({ params }) => {
      const radius = num(params, "radius", 4);
      if (radius <= 0) return {};
      return { filters: [`blur(${radius}px)`] };
    },
    // Blur har frame par poora layer dobara banata hai — sabse mehnga effect.
    cost: 4,
  },

  filterEffect({
    id: "brightness",
    label: "Brightness",
    icon: "Sun",
    kind: "light",
    hint: "Roshni — 1 se upar chamak, neeche andhera",
    cssName: "brightness",
    neutral: 1,
    min: 0,
    max: 3,
    step: 0.01,
  }),
  filterEffect({
    id: "contrast",
    label: "Contrast",
    icon: "Contrast",
    kind: "light",
    hint: "Kaale aur safed ke beech ka farak",
    cssName: "contrast",
    neutral: 1,
    min: 0,
    max: 3,
    step: 0.01,
  }),
  filterEffect({
    id: "saturation",
    label: "Saturation",
    icon: "Palette",
    kind: "color",
    hint: "Rangon ka gehrapan — 0 par bilkul safed-kaala",
    cssName: "saturate",
    neutral: 1,
    min: 0,
    max: 3,
    step: 0.01,
  }),
  filterEffect({
    id: "grayscale",
    label: "Black & white",
    icon: "CircleOff",
    kind: "color",
    hint: "Rang hata do",
    cssName: "grayscale",
    neutral: 0,
    min: 0,
    max: 1,
    step: 0.01,
  }),
  filterEffect({
    id: "sepia",
    label: "Sepia",
    icon: "Coffee",
    kind: "color",
    hint: "Purani tasveer wala bhoora rang",
    cssName: "sepia",
    neutral: 0,
    min: 0,
    max: 1,
    step: 0.01,
  }),
  filterEffect({
    id: "hue-rotate",
    label: "Hue shift",
    icon: "RefreshCw",
    kind: "color",
    hint: "Saare rang ghuma do",
    cssName: "hue-rotate",
    neutral: 0,
    min: -180,
    max: 180,
    step: 1,
    unit: "deg",
  }),
  filterEffect({
    id: "opacity",
    label: "Opacity",
    icon: "Layers",
    kind: "light",
    hint: "Paardarshita — stack ke beech me bhi lag sakti hai",
    cssName: "opacity",
    neutral: 1,
    min: 0,
    max: 1,
    step: 0.01,
  }),

  filterEffect({
    id: "invert",
    label: "Invert",
    icon: "CircleHalf",
    kind: "color",
    hint: "Rang ulte — negative jaisa",
    cssName: "invert",
    neutral: 0,
    min: 0,
    max: 1,
    step: 0.01,
  }),

  {
    id: "vignette",
    label: "Vignette",
    icon: "Aperture",
    kind: "light",
    hint: "Kinare dheere-dheere kaale — nazar beech par jaati hai",
    schema: z.object({
      amount: z.number().min(0).max(1).default(0.45),
      /** Kahan se andhera shuru ho — 0.5 matlab aadhe se hi. */
      spread: z.number().min(0.1).max(1).default(0.55),
      color: z.string().default("#000000"),
    }),
    defaults: { amount: 0.45, spread: 0.55, color: "#000000" },
    controls: [
      { path: "amount", control: "slider", label: "Kitna", group: "Effect", min: 0, max: 1, step: 0.01, keyframable: true },
      { path: "spread", control: "slider", label: "Phailav", group: "Effect", min: 0.1, max: 1, step: 0.01 },
      { path: "color", control: "color", label: "Rang", group: "Effect" },
    ],
    keyframable: ["amount"],
    apply: ({ params }) => {
      const amount = num(params, "amount", 0.45);
      if (amount <= 0) return {};
      const spread = num(params, "spread", 0.55);
      const color = str(params, "color", "#000000");
      /*
       * `closest-side` isliye ki reel 1080x1920 hai — `farthest-corner` par
       * andhera sirf kinaron ke kono me aata aur beech ka 70% hissa bilkul
       * chhoot jaata. Reel me vignette ka poora matlab hi kinare daabna hai.
       */
      return {
        overlay: {
          background: `radial-gradient(ellipse closest-side at 50% 50%, transparent ${Math.round(spread * 100)}%, ${color} 140%)`,
          opacity: amount,
        },
      };
    },
    cost: 1,
  },

  {
    id: "sharpen",
    label: "Sharpen",
    icon: "Sparkles",
    kind: "blur",
    hint: "Kinare tez — halka rakho, warna daane dikhne lagte hain",
    schema: z.object({ amount: z.number().min(0).max(2).default(0.5) }),
    defaults: { amount: 0.5 },
    controls: [
      { path: "amount", control: "slider", label: "Kitna", group: "Effect", min: 0, max: 2, step: 0.05, keyframable: true },
    ],
    keyframable: ["amount"],
    apply: ({ params }) => {
      const amount = num(params, "amount", 0.5);
      if (amount <= 0) return {};
      /*
       * CSS me sharpen naam ka koi filter hai hi nahi — isliye SVG ka
       * `feConvolveMatrix` chahiye. Classic 3x3 unsharp kernel, `amount` se
       * taaqat:
       *
       *     0  -a   0
       *    -a  1+4a -a
       *     0  -a   0
       *
       * Jod hamesha 1 rehta hai, isliye tasveer ki roshni nahi badalti — sirf
       * kinare uthte hain. Yahi wajah hai ki brightness/contrast ko sharpen ke
       * naam par bech dena galat hota: wo dikhne me thoda mila-julta lagta hai
       * par karta bilkul doosri cheez hai.
       */
      const a = amount;
      return {
        svgFilter: {
          kind: "convolve",
          matrix: [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0],
          divisor: 1,
        },
      };
    },
    cost: 3,
  },

  {
    id: "dropShadow",
    label: "Drop shadow",
    icon: "Box",
    kind: "shape",
    hint: "Neeche parchhai — item ko upar utha deti hai",
    schema: z.object({
      x: z.number().min(-200).max(200).default(0),
      y: z.number().min(-200).max(200).default(12),
      blur: z.number().min(0).max(200).default(24),
      color: z.string().default("#00000066"),
    }),
    defaults: { x: 0, y: 12, blur: 24, color: "#00000066" },
    controls: [
      { path: "x", control: "number", label: "X", group: "Effect", step: 1, unit: "px", keyframable: true },
      { path: "y", control: "number", label: "Y", group: "Effect", step: 1, unit: "px", keyframable: true },
      { path: "blur", control: "slider", label: "Blur", group: "Effect", min: 0, max: 200, step: 1, unit: "px", keyframable: true },
      { path: "color", control: "color", label: "Rang", group: "Effect" },
    ],
    keyframable: ["x", "y", "blur"],
    apply: ({ params }) => ({
      /*
       * `drop-shadow` filter hai, `box-shadow` nahi — aur ye jaan-boojhkar hai.
       * `box-shadow` hamesha dabbe ki aayat ki parchhai banata hai; `drop-shadow`
       * asli **pixels** ki (PNG ki paardarshi jagah, text ke akshar). Text par
       * box-shadow lagana turant nakli lagta hai.
       */
      filters: [
        `drop-shadow(${num(params, "x", 0)}px ${num(params, "y", 12)}px ${num(params, "blur", 24)}px ${str(params, "color", "#00000066")})`,
      ],
    }),
    cost: 3,
  },

  {
    id: "roundedCorners",
    label: "Rounded corners",
    icon: "Square",
    kind: "shape",
    hint: "Kone gol",
    schema: z.object({ radius: z.number().min(0).max(400).default(32) }),
    defaults: { radius: 32 },
    controls: [
      { path: "radius", control: "slider", label: "Radius", group: "Effect", min: 0, max: 400, step: 1, unit: "px", keyframable: true },
    ],
    keyframable: ["radius"],
    apply: ({ params }) => {
      const radius = num(params, "radius", 32);
      if (radius <= 0) return {};
      // `overflow: hidden` ke bina radius sirf background par lagti hai aur
      // andar ki tasveer kono se bahar nikalti rehti hai.
      return { style: { borderRadius: `${radius}px`, overflow: "hidden" } };
    },
    cost: 1,
  },

  {
    id: "border",
    label: "Border",
    icon: "SquareDashed",
    kind: "shape",
    hint: "Chaaron taraf ek lakeer",
    schema: z.object({
      width: z.number().min(0).max(80).default(4),
      color: z.string().default("#ffffff"),
    }),
    defaults: { width: 4, color: "#ffffff" },
    controls: [
      { path: "width", control: "slider", label: "Motai", group: "Effect", min: 0, max: 80, step: 1, unit: "px", keyframable: true },
      { path: "color", control: "color", label: "Rang", group: "Effect" },
    ],
    keyframable: ["width"],
    apply: ({ params }) => {
      const width = num(params, "width", 4);
      if (width <= 0) return {};
      /*
       * `outline` (border nahi) — kyunki border dabbe ka size badal deta hai aur
       * item apni jagah se hil jaata hai. `outline` andar ki taraf lagti hai
       * (`outlineOffset` negative) aur layout ko haath nahi lagati.
       */
      return {
        style: {
          outline: `${width}px solid ${str(params, "color", "#ffffff")}`,
          outlineOffset: `-${width}px`,
        },
      };
    },
    cost: 1,
  },
];

export const EFFECTS: Registry<EffectEntry> = createRegistry<EffectEntry>("EFFECTS");

export function listEffects(): readonly EffectEntry[] {
  return EFFECTS.list();
}

export function requireEffect(id: string): EffectEntry {
  return EFFECTS.require(id);
}

/** Naya effect banate waqt uske defaults — registry se, kahin likhe hue nahi. */
export function createEffect(typeId: string): Record<string, unknown> {
  const entry = requireEffect(typeId);
  return { type: entry.id, enabled: true, ...entry.defaults };
}

/**
 * Ek effect ke param ka keyframe path (14.5).
 *
 * ⚠️ Path me **index** hai, effect ka koi apna id nahi — aur ye ek soch-samajh
 * kar liya faisla hai. `getByPath` arrays par seedha chalta hai, isliye
 * `effects.2.radius` bina kisi naye code ke wahi keyframe engine use kar leta
 * hai jo `transform.scale` use karta hai.
 *
 * Iski keemat ye hai ki stack ka kram badalne par paths khisak jaate hain.
 * Isliye `reorderEffects`/`removeEffect` ops keyframe keys ko **saath me**
 * badalte hain (`remapEffectKeyframes`). Wo ek jagah likha hai, aur bina uske ye
 * poora tarika chup-chaap galat keyframes chala deta.
 */
export function effectParamPath(index: number, param: string): string {
  return `effects.${index}.${param}`;
}

/**
 * Poore stack ko ek style me milao (14.3).
 *
 * `ItemRenderer` sirf ye function bulata hai. Item components ko effects ke bare
 * me kuch pata nahi hota — yahi 14.1 ka poora point hai.
 *
 * Har param `resolveItemValue` se aata hai, isliye **har param apne aap
 * keyframable hai**: keyframe laga ho to wahi chalega, warna static value.
 */
export function applyEffects(
  item: Item,
  localFrame: number,
  frame: { width: number; height: number },
): {
  filter: string | null;
  style: Record<string, string | number>;
  overlays: readonly { background: string; opacity?: number; blendMode?: string }[];
  svgFilters: readonly { kind: "convolve"; matrix: readonly number[]; divisor?: number }[];
} {
  const filters: string[] = [];
  const style: Record<string, string | number> = {};
  const overlays: { background: string; opacity?: number; blendMode?: string }[] = [];
  const svgFilters: { kind: "convolve"; matrix: readonly number[]; divisor?: number }[] = [];

  item.effects.forEach((effect, index) => {
    if (effect.enabled === false) return;
    const entry = EFFECTS.get(effect.type);
    // Anjaan effect chup-chaap chhod dete hain: purani file naye build me khulni
    // chahiye, chahe usme koi effect ho jo ab hai hi nahi.
    if (!entry) return;

    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(effect as Record<string, unknown>)) {
      if (key === "type" || key === "enabled") continue;
      params[key] = value;
    }
    // Keyframed params static value ke upar chalte hain (13.12 wala hi niyam).
    for (const param of entry.keyframable) {
      const animated = resolveItemValue<unknown>(item, effectParamPath(index, param), localFrame);
      if (animated !== undefined && animated !== null) params[param] = animated;
    }

    const output = entry.apply({ params, frame });
    if (output.filters) filters.push(...output.filters);
    if (output.style) Object.assign(style, output.style);
    if (output.overlay) overlays.push(output.overlay);
    if (output.svgFilter) svgFilters.push(output.svgFilter);
  });

  return {
    filter: filters.length > 0 ? filters.join(" ") : null,
    style,
    overlays,
    svgFilters,
  };
}

/**
 * Is item ka stack render me kitna bhaari hai (14.8).
 *
 * Ye number sirf chetavni ke liye hai. "Bhaari" ka matlab yahan **render dheema**
 * hai, quality kharab nahi — dono ko ek saath keh dena user ko galat faisla
 * karwaata hai.
 */
export function effectsCost(item: Item): number {
  let total = 0;
  for (const effect of item.effects) {
    if (effect.enabled === false) continue;
    total += EFFECTS.get(effect.type)?.cost ?? 1;
  }
  return total;
}
