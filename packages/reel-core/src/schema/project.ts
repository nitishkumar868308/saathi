import { z } from "zod";

import { EASING_IDS, DEFAULT_EASING } from "../config/easing";
import { DIMENSION_STEP, MAX_DIMENSION, MIN_DIMENSION } from "../config/presets";
import { MAX_FPS, MIN_FPS } from "../time";

/**
 * Project JSON — poore product ka **ekmatra** sach.
 *
 * AI ise likhta hai, template ise likhte hain, haath se editing ise badalti hai,
 * renderer sirf ise padhta hai. Isi ek faisle ki wajah se AI-generated reel baad
 * me bhi editable rehti hai.
 *
 * Do baatein locked hain (00-architecture Section E):
 *  1. Timing **integer frames** me hai, seconds me nahi. Float seconds par split
 *     karne se hamesha 1-frame ka gap ya overlap aa jaata hai.
 *  2. `version` din ek se maujood hai, taaki `migrate.ts` purane docs utha sake.
 *
 * Types yahan haath se nahi likhe — sab `z.infer` se aate hain, warna schema aur
 * type dhire-dhire alag ho jaate hain aur runtime par pata chalta hai.
 */

export const SCHEMA_VERSION = 1;

const IdSchema = z.string().min(1);

/** Timeline par jagah — hamesha integer frame. */
export const FrameSchema = z.number().int().min(0);

/** Lambai — kam se kam 1 frame, warna clip kabhi dikhega hi nahi. */
export const DurationFramesSchema = z.number().int().min(1);

/**
 * Rang ya to hex hai (`#C25A37`) ya **brand token** (`brand.primary`).
 * Token likhne se brand badalte hi poori reel badal jaati hai — isliye UI hamesha
 * token ki taraf dhakelta hai (Dynamic rule 9).
 *
 * Resolve karne wale helpers `config/brand.ts` me hain (`isBrandToken`, `resolveToken`).
 */
export const ColorSchema = z.string().min(1);

const evenDimension = (label: string) =>
  z
    .number()
    .int()
    .min(MIN_DIMENSION)
    .max(MAX_DIMENSION)
    .refine((n) => n % DIMENSION_STEP === 0, {
      // yuv420p ka chroma plane aadha hota hai — visham (odd) size par encoder rota hai.
      message: `${label} even hona chahiye (yuv420p ki zaroorat)`,
    });

export const ProjectSettingsSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  /** Kaunsa size preset chuna gaya tha — "custom" bhi ho sakta hai. */
  sizePresetId: z.string().min(1),
  width: evenDimension("width"),
  height: evenDimension("height"),
  fps: z.number().int().min(MIN_FPS).max(MAX_FPS),
  durationInFrames: DurationFramesSchema,
  background: ColorSchema,
});

export const TrackSchema = z.object({
  id: IdSchema,
  /** TRACK_TYPES registry ka id. Track ki ginti fixed nahi hai — sirf type fixed hai. */
  type: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().min(0),
  muted: z.boolean(),
  hidden: z.boolean(),
  locked: z.boolean(),
});

export const CropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const TransformSchema = z.object({
  /** Frame ke center se offset, project pixels me. */
  x: z.number(),
  y: z.number(),
  /** Fit ki base scale ke **upar** lagne wali user scale (fit.ts ka contract). */
  scale: z.number().positive(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  anchor: z.tuple([z.number(), z.number()]),
  crop: CropSchema.nullable(),
});

export const FitBackgroundSchema = z.object({
  kind: z.enum(["color", "brand", "blurred-asset", "gradient"]),
  /** `blurred-asset` ko value nahi chahiye — isliye nullable. */
  value: z.string().nullable(),
});

export const FitSchema = z.object({
  mode: z.enum(["cover", "contain", "fill", "custom"]),
  background: FitBackgroundSchema,
});

export const EasingSchema = z
  .string()
  .refine((value) => EASING_IDS.includes(value), {
    message: `easing inme se ek hona chahiye: ${EASING_IDS.join(", ")}`,
  });

/**
 * Ek keyframe. Value ka type property par nirbhar hai (number, color string,
 * vector…) isliye yahan `unknown` — asli check registry ke control descriptor se
 * hota hai. Isi wajah se koi bhi nayi property apne aap keyframable ban jaati hai.
 */
export const KeyframeSchema = z.object({
  frame: FrameSchema,
  value: z.unknown(),
  easing: EasingSchema.default(DEFAULT_EASING),
  /**
   * Apna curve — `[x1, y1, x2, y2]`, bilkul CSS ke `cubic-bezier()` jaisa (13.2).
   *
   * ⚠️ Ye `easing` ki jagah nahi, uske **upar** hai: bezier diya ho to wahi
   * chalta hai. Do alag fields isliye hain ki dropdown se chuna hua easing (jo
   * 95% baar kaafi hota hai) padhne me saaf rahe, aur curve editor se banaya
   * hua custom curve uske saath baith sake — bina har keyframe me chaar number
   * bhare.
   */
  bezier: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().default(null),
});

/** Key = property path (`"transform.scale"`), value = us path ke keyframes. */
export const KeyframesSchema = z.record(z.string().min(1), z.array(KeyframeSchema));

/** Animation/effect ke type-specific fields registry validate karti hai. */
export const AnimationSchema = z
  .object({
    type: z.string().min(1),
    enabled: z.boolean().default(true),
  })
  .passthrough();

export const EffectSchema = z
  .object({
    type: z.string().min(1),
    enabled: z.boolean().default(true),
  })
  .passthrough();

export const AudioSettingsSchema = z.object({
  /** 1 = jaisa hai. 1 se upar clipping ka khatra — Phase 20 validation warn karegi. */
  volume: z.number().min(0).max(4),
  muted: z.boolean(),
  fadeInFrames: FrameSchema,
  fadeOutFrames: FrameSchema,
});

export const TransitionSchema = z
  .object({
    /** TRANSITIONS registry ka id. `"none"` ka matlab koi transition nahi. */
    type: z.string().min(1),
    durationInFrames: FrameSchema,
  })
  /*
   * `passthrough` — bilkul `AnimationSchema` ki tarah, aur usi wajah se.
   *
   * Har transition ke apne params hote hain (`slide` ka `direction`, `zoom` ka
   * `from`, sabka `easing`) aur wo TRANSITIONS registry me apne zod schema ke
   * saath rehte hain. Un sab ko yahan ginana matlab registry ki poori list is
   * file me dobara likhna — aur tab naya transition jodna do jagah ka kaam ban
   * jaata, jo poore dynamic-first design ke khilaf hai.
   *
   * Ye gap type-checker ne pakda tha: params kahin save hi nahi ho paate the,
   * aur transition hamesha apne default par chalti rehti.
   */
  .passthrough();

export const TextStrokeSchema = z.object({
  color: ColorSchema,
  width: z.number().min(0),
});

export const TextShadowSchema = z.object({
  color: ColorSchema,
  blur: z.number().min(0),
  x: z.number(),
  y: z.number(),
});

export const TextBackgroundSchema = z.object({
  color: ColorSchema,
  paddingX: z.number().min(0),
  paddingY: z.number().min(0),
  radius: z.number().min(0),
});

export const TextSpecSchema = z.object({
  content: z.string(),
  /** Brand token (`brand.font.display`) ya seedha font family. */
  fontFamily: z.string().min(1),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(900),
  color: ColorSchema,
  align: z.enum(["left", "center", "right"]),
  verticalAlign: z.enum(["top", "middle", "bottom"]),
  lineHeight: z.number().positive(),
  letterSpacing: z.number(),
  uppercase: z.boolean(),
  /** Frame ki chaudai ka percent — pixels nahi, taaki har project size par chale. */
  maxWidthPercent: z.number().min(1).max(100).nullable(),
  stroke: TextStrokeSchema.nullable(),
  shadow: TextShadowSchema.nullable(),
  background: TextBackgroundSchema.nullable(),
});

export const ShapeSpecSchema = z.object({
  kind: z.enum(["rect", "ellipse", "line"]),
  fill: ColorSchema.nullable(),
  stroke: TextStrokeSchema.nullable(),
  /** Frame ke percent me — 100 = poori chaudai. Magic pixels se bachne ke liye. */
  widthPercent: z.number().positive(),
  heightPercent: z.number().positive(),
  radius: z.number().min(0),
});

export const ItemSchema = z.object({
  id: IdSchema,
  trackId: IdSchema,
  /** ITEM_TYPES registry ka id: image / video / audio / text / shape … */
  type: z.string().min(1),
  /** Scene sirf grouping hai — item kis scene ka hissa hai. */
  sceneId: IdSchema.nullable(),
  name: z.string().min(1),

  /** Timeline par jagah. */
  startFrame: FrameSchema,
  durationInFrames: DurationFramesSchema,

  /** Source ke andar non-destructive trim — asli file kabhi nahi badalti. */
  trimStartFrame: FrameSchema,
  playbackRate: z.number().positive(),

  assetId: IdSchema.nullable(),

  transform: TransformSchema,
  fit: FitSchema,

  animations: z.array(AnimationSchema),
  keyframes: KeyframesSchema,
  effects: z.array(EffectSchema),
  audio: AudioSettingsSchema,

  transitionIn: TransitionSchema,
  transitionOut: TransitionSchema,

  text: TextSpecSchema.nullable(),
  shape: ShapeSpecSchema.nullable(),

  hidden: z.boolean(),
  locked: z.boolean(),
});

export const SceneSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  order: z.number().int().min(0),
  itemIds: z.array(IdSchema),

  /**
   * SCENE_TYPES registry ka id (Phase 12).
   *
   * `.default("custom")` isliye hai ki Phase 1-11 ke docs me scenes ke paas
   * type tha hi nahi. Unhe migration se guzarna padta to har purana project
   * ek baar rewrite hota — aur wo ek aisa kaam hai jo kabhi-kabhi aadha hokar
   * chhoot jaata hai. Default se purana doc bina chhue chalta rehta hai, aur
   * "custom" ka matlab saaf hai: ye scene kisi registry type se nahi bana.
   */
  type: z.string().min(1).default("custom"),

  /**
   * Scene ke slots ki abhi ki value — `{ image: "as_123", caption: "Namaste" }`.
   *
   * Khula record isliye hai ki har scene type ke apne slots hote hain aur wo
   * uski registry entry me likhe hain. Yahan unhe ginana matlab poori list
   * dobara likhna, aur naya scene type jodna do jagah ka kaam ban jaata.
   */
  slots: z.record(z.unknown()).default({}),
});

export const BrandSchema = z.object({
  presetId: z.string().min(1).nullable(),
});

export const MetaSchema = z.object({
  createdBy: z.enum(["manual", "ai", "template"]),
  sourceStory: z.string().nullable(),
});

const DocShape = z.object({
  version: z.literal(SCHEMA_VERSION),
  project: ProjectSettingsSchema,
  tracks: z.array(TrackSchema),
  items: z.array(ItemSchema),
  scenes: z.array(SceneSchema),
  brand: BrandSchema,
  meta: MetaSchema,
});

function findDuplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * Poora doc + referential integrity.
 *
 * Ye checks schema me hi rakhe hain (alag helper me nahi) kyunki ek toota
 * reference — item ka gayab track — renderer me jaakar aisi jagah phatta hai
 * jahan se asli wajah dhoondhna mushkil ho jaata hai.
 */
export const DocSchema = DocShape.superRefine((doc, ctx) => {
  const trackIds = doc.tracks.map((track) => track.id);
  const itemIds = doc.items.map((item) => item.id);
  const sceneIds = doc.scenes.map((scene) => scene.id);

  for (const [label, ids, path] of [
    ["track", trackIds, "tracks"],
    ["item", itemIds, "items"],
    ["scene", sceneIds, "scenes"],
  ] as const) {
    const duplicates = findDuplicates(ids);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: `Duplicate ${label} id: ${duplicates.join(", ")}`,
      });
    }
  }

  const trackIdSet = new Set(trackIds);
  const itemIdSet = new Set(itemIds);
  const sceneIdSet = new Set(sceneIds);

  doc.items.forEach((item, index) => {
    if (!trackIdSet.has(item.trackId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "trackId"],
        message: `Item "${item.id}" ka track "${item.trackId}" maujood nahi hai`,
      });
    }
    if (item.sceneId !== null && !sceneIdSet.has(item.sceneId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "sceneId"],
        message: `Item "${item.id}" ka scene "${item.sceneId}" maujood nahi hai`,
      });
    }
  });

  doc.scenes.forEach((scene, index) => {
    scene.itemIds.forEach((id, itemIndex) => {
      if (!itemIdSet.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scenes", index, "itemIds", itemIndex],
          message: `Scene "${scene.id}" ek gayab item "${id}" ko point kar raha hai`,
        });
      }
    });
  });
});

export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Crop = z.infer<typeof CropSchema>;
export type Transform = z.infer<typeof TransformSchema>;
export type FitBackground = z.infer<typeof FitBackgroundSchema>;
export type Fit = z.infer<typeof FitSchema>;
export type Keyframe = z.infer<typeof KeyframeSchema>;
export type Keyframes = z.infer<typeof KeyframesSchema>;
export type Animation = z.infer<typeof AnimationSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type AudioSettings = z.infer<typeof AudioSettingsSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type TextSpec = z.infer<typeof TextSpecSchema>;
export type ShapeSpec = z.infer<typeof ShapeSpecSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type Doc = z.infer<typeof DocSchema>;

/** Sakht parse — galat doc par saaf error. */
export function parseDoc(input: unknown): Doc {
  return DocSchema.parse(input);
}

export function safeParseDoc(input: unknown): z.SafeParseReturnType<unknown, Doc> {
  return DocSchema.safeParse(input);
}

/** Item ka aakhri frame (exclusive) — timeline ka sabse zyada dohraaya jaane wala hisaab. */
export function itemEndFrame(item: Pick<Item, "startFrame" | "durationInFrames">): number {
  return item.startFrame + item.durationInFrames;
}
