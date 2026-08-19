import { z } from "zod";

import { CONTAIN_BACKGROUNDS, FIT_MODES } from "../config/fit";
import { ShapeSpecSchema, TextSpecSchema } from "../schema/project";
import type { ControlDescriptor, RegistryEntry } from "./types";

/**
 * ITEM_TYPES — image / video / audio / text / shape.
 *
 * Timeline, properties panel, sidebar aur renderer sab yahi entries padhte hain.
 * Naya item type add karna = is file me ek entry (+ Phase 3 me ek component).
 * Kisi bhi doosri file me `if (type === "...")` likhna mana hai.
 */

export interface ItemTypeEntry extends RegistryEntry {
  kind: "media" | "text" | "graphic" | "audio";
  /** Phase 3 me Remotion component isi key se joda jaayega. Core me React nahi hai. */
  componentKey: string;
  /** Bina asset ke ye item ban hi nahi sakta (image/video/audio). */
  needsAsset: boolean;
  hasVisual: boolean;
  hasAudio: boolean;
  /** Source ke andar trim/split ho sakta hai (sirf timed media). */
  supportsTrim: boolean;
  /** Naya item kis track type par gira. */
  defaultTrackType: string;
  /** Naya item kitna lamba shuru ho — seconds, frames project fps se bante hain. */
  defaultDurationSeconds: number;
}

const FIT_MODE_OPTIONS = FIT_MODES.map((mode) => ({ value: mode.id, label: mode.label }));
const CONTAIN_BACKGROUND_OPTIONS = CONTAIN_BACKGROUNDS.map((bg) => ({
  value: bg.id,
  label: bg.label,
}));

/**
 * Transform ke controls har visual item par ek jaise hote hain, isliye ek hi
 * jagah likhe hain — paanch jagah copy karne se hi panel dhire-dhire alag hote hain.
 */
const TRANSFORM_CONTROLS: readonly ControlDescriptor[] = [
  {
    path: "transform.scale",
    control: "slider",
    label: "Scale",
    group: "Transform",
    min: 0.1,
    max: 4,
    step: 0.01,
    keyframable: true,
    help: "Fit ki base scale ke upar lagti hai",
  },
  {
    path: "transform.x",
    control: "number",
    label: "X",
    group: "Transform",
    step: 1,
    unit: "px",
    keyframable: true,
  },
  {
    path: "transform.y",
    control: "number",
    label: "Y",
    group: "Transform",
    step: 1,
    unit: "px",
    keyframable: true,
  },
  {
    path: "transform.rotation",
    control: "slider",
    label: "Rotation",
    group: "Transform",
    min: -180,
    max: 180,
    step: 0.5,
    unit: "deg",
    keyframable: true,
  },
  {
    path: "transform.opacity",
    control: "slider",
    label: "Opacity",
    group: "Transform",
    min: 0,
    max: 1,
    step: 0.01,
    keyframable: true,
  },
  {
    path: "transform.anchor",
    control: "vector2",
    label: "Anchor",
    group: "Transform",
    min: 0,
    max: 1,
    step: 0.01,
    help: "0.5, 0.5 = beech. Rotation aur scale isi bindu ke aas-paas ghumte hain",
  },
  /*
   * Crop numeric hai, visual nahi (9.6 me yahi likha hai — visual crop Phase 15).
   * Values 0-1 me hain, pixels me nahi: isse ek hi crop har naap ke source par
   * sahi baithta hai, aur project ka size badalne par bhi nahi tootta.
   */
  {
    path: "transform.crop",
    control: "enable",
    label: "Crop",
    group: "Transform",
    enableDefault: { x: 0, y: 0, width: 1, height: 1 },
    help: "Source ka kaunsa hissa dikhe (0-1 me)",
  },
  {
    path: "transform.crop.x",
    control: "slider",
    label: "Crop X",
    group: "Transform",
    min: 0,
    max: 1,
    step: 0.001,
    when: { path: "transform.crop", isSet: true },
  },
  {
    path: "transform.crop.y",
    control: "slider",
    label: "Crop Y",
    group: "Transform",
    min: 0,
    max: 1,
    step: 0.001,
    when: { path: "transform.crop", isSet: true },
  },
  {
    path: "transform.crop.width",
    control: "slider",
    label: "Crop width",
    group: "Transform",
    min: 0.01,
    max: 1,
    step: 0.001,
    when: { path: "transform.crop", isSet: true },
  },
  {
    path: "transform.crop.height",
    control: "slider",
    label: "Crop height",
    group: "Transform",
    min: 0.01,
    max: 1,
    step: 0.001,
    when: { path: "transform.crop", isSet: true },
  },
];

/** Size & Fit — README Section 3B. Har visual item par milta hai. */
const FIT_CONTROLS: readonly ControlDescriptor[] = [
  {
    path: "fit.mode",
    control: "segmented",
    label: "Fit",
    group: "Size & fit",
    options: FIT_MODE_OPTIONS,
    help: "Cover = bhar do (crop), Contain = poora dikhe (khaali jagah)",
  },
  {
    path: "fit.background.kind",
    control: "select",
    label: "Background",
    group: "Size & fit",
    options: CONTAIN_BACKGROUND_OPTIONS,
    // Background sirf tab matlab rakhta hai jab khaali jagah bachti ho.
    when: { path: "fit.mode", equals: "contain" },
  },
  {
    path: "fit.background.value",
    control: "color",
    label: "Background colour",
    group: "Size & fit",
    when: { path: "fit.background.kind", equals: "color" },
  },
  {
    // Brand wala background ek **token** leta hai (`brand.primary`), hex nahi —
    // isliye brand badalne par poori reel ke background apne aap badal jaate hain.
    path: "fit.background.value",
    control: "select",
    label: "Brand colour",
    group: "Size & fit",
    options: [
      { value: "brand.primary", label: "Primary" },
      { value: "brand.accent", label: "Accent" },
      { value: "brand.bg", label: "Background" },
      { value: "brand.text", label: "Text" },
    ],
    when: { path: "fit.background.kind", equals: "brand" },
  },
  {
    path: "fit.background.value",
    control: "text",
    label: "Gradient CSS",
    group: "Size & fit",
    when: { path: "fit.background.kind", equals: "gradient" },
    help: "Jaise: linear-gradient(180deg, #1b1b22, #000)",
  },
];

const AUDIO_CONTROLS: readonly ControlDescriptor[] = [
  {
    path: "audio.volume",
    control: "slider",
    label: "Volume",
    group: "Audio",
    min: 0,
    max: 2,
    step: 0.01,
    keyframable: true,
    help: "1 se upar clipping ka khatra — export se pehle check hota hai",
  },
  { path: "audio.muted", control: "toggle", label: "Mute", group: "Audio" },
  {
    path: "audio.fadeInFrames",
    control: "number",
    label: "Fade in",
    group: "Audio",
    min: 0,
    step: 1,
    unit: "frames",
  },
  {
    path: "audio.fadeOutFrames",
    control: "number",
    label: "Fade out",
    group: "Audio",
    min: 0,
    step: 1,
    unit: "frames",
  },
];

const SPEED_CONTROL: ControlDescriptor = {
  path: "playbackRate",
  control: "slider",
  label: "Speed",
  group: "Clip",
  min: 0.25,
  max: 4,
  step: 0.05,
  unit: "x",
};

const TRANSFORM_KEYFRAMABLE = [
  "transform.x",
  "transform.y",
  "transform.scale",
  "transform.rotation",
  "transform.opacity",
] as const;

/** Naya text item kaisa dikhega. Rang aur font **brand tokens** hain, hex nahi. */
const DEFAULT_TEXT: z.infer<typeof TextSpecSchema> = {
  content: "Naya text",
  fontFamily: "brand.font.display",
  fontSize: 72,
  fontWeight: 700,
  color: "brand.text",
  align: "center",
  verticalAlign: "middle",
  lineHeight: 1.2,
  letterSpacing: 0,
  uppercase: false,
  maxWidthPercent: 80,
  stroke: null,
  shadow: null,
  background: null,
};

const DEFAULT_SHAPE: z.infer<typeof ShapeSpecSchema> = {
  kind: "rect",
  fill: "brand.primary",
  stroke: null,
  widthPercent: 60,
  heightPercent: 20,
  radius: 16,
};

export const BUILTIN_ITEM_TYPES: readonly ItemTypeEntry[] = [
  {
    id: "image",
    label: "Image",
    icon: "Image",
    kind: "media",
    componentKey: "ImageItem",
    needsAsset: true,
    hasVisual: true,
    hasAudio: false,
    supportsTrim: false,
    defaultTrackType: "image",
    defaultDurationSeconds: 4,
    schema: z.object({ assetId: z.string().min(1) }),
    defaults: {},
    controls: [...FIT_CONTROLS, ...TRANSFORM_CONTROLS],
    keyframable: [...TRANSFORM_KEYFRAMABLE],
  },
  {
    id: "video",
    label: "Video",
    icon: "Video",
    kind: "media",
    componentKey: "VideoItem",
    needsAsset: true,
    hasVisual: true,
    hasAudio: true,
    supportsTrim: true,
    defaultTrackType: "video",
    defaultDurationSeconds: 5,
    schema: z.object({ assetId: z.string().min(1) }),
    defaults: {},
    controls: [...FIT_CONTROLS, ...TRANSFORM_CONTROLS, SPEED_CONTROL, ...AUDIO_CONTROLS],
    keyframable: [...TRANSFORM_KEYFRAMABLE, "audio.volume"],
  },
  {
    id: "audio",
    label: "Audio",
    icon: "Music",
    kind: "audio",
    componentKey: "AudioItem",
    needsAsset: true,
    hasVisual: false,
    hasAudio: true,
    supportsTrim: true,
    defaultTrackType: "audio",
    defaultDurationSeconds: 10,
    schema: z.object({ assetId: z.string().min(1) }),
    defaults: {},
    controls: [SPEED_CONTROL, ...AUDIO_CONTROLS],
    keyframable: ["audio.volume"],
  },
  {
    id: "text",
    label: "Text",
    icon: "Type",
    kind: "text",
    componentKey: "TextItem",
    needsAsset: false,
    hasVisual: true,
    hasAudio: false,
    supportsTrim: false,
    defaultTrackType: "text",
    defaultDurationSeconds: 3,
    schema: z.object({ text: TextSpecSchema }),
    defaults: { text: DEFAULT_TEXT },
    controls: [
      { path: "text.content", control: "textarea", label: "Text", group: "Text" },
      { path: "text.fontFamily", control: "font", label: "Font", group: "Text" },
      {
        path: "text.fontSize",
        control: "number",
        label: "Size",
        group: "Text",
        min: 4,
        step: 1,
        unit: "px",
        keyframable: true,
      },
      {
        path: "text.fontWeight",
        control: "select",
        label: "Weight",
        group: "Text",
        options: [
          { value: 400, label: "Regular" },
          { value: 500, label: "Medium" },
          { value: 600, label: "Semibold" },
          { value: 700, label: "Bold" },
          { value: 800, label: "Extrabold" },
        ],
      },
      { path: "text.color", control: "color", label: "Colour", group: "Text" },
      { path: "text.align", control: "align", label: "Align", group: "Text" },
      { path: "text.uppercase", control: "toggle", label: "UPPERCASE", group: "Text" },
      {
        path: "text.lineHeight",
        control: "slider",
        label: "Line height",
        group: "Text",
        min: 0.8,
        max: 2.5,
        step: 0.01,
      },
      {
        path: "text.letterSpacing",
        control: "slider",
        label: "Letter spacing",
        group: "Text",
        min: -5,
        max: 20,
        step: 0.1,
        unit: "px",
      },
      {
        path: "text.maxWidthPercent",
        control: "slider",
        label: "Max width",
        group: "Text",
        min: 10,
        max: 100,
        step: 1,
        unit: "%",
        help: "Frame ki chaudai ka percent — isi par text apne aap wrap hota hai",
      },
      {
        path: "text.verticalAlign",
        control: "segmented",
        label: "Vertical",
        group: "Text",
        options: [
          { value: "top", label: "Top" },
          { value: "middle", label: "Middle" },
          { value: "bottom", label: "Bottom" },
        ],
      },

      /* Stroke / shadow / background — teeno nullable hain, isliye `enable`. */
      {
        path: "text.stroke",
        control: "enable",
        label: "Stroke",
        group: "Stroke",
        enableDefault: { color: "#000000", width: 4 },
      },
      {
        path: "text.stroke.color",
        control: "color",
        label: "Stroke colour",
        group: "Stroke",
        when: { path: "text.stroke", isSet: true },
      },
      {
        path: "text.stroke.width",
        control: "slider",
        label: "Stroke width",
        group: "Stroke",
        min: 0,
        max: 40,
        step: 0.5,
        unit: "px",
        when: { path: "text.stroke", isSet: true },
      },

      {
        path: "text.shadow",
        control: "enable",
        label: "Shadow",
        group: "Shadow",
        enableDefault: { color: "#000000", blur: 12, x: 0, y: 6 },
      },
      {
        path: "text.shadow.color",
        control: "color",
        label: "Shadow colour",
        group: "Shadow",
        when: { path: "text.shadow", isSet: true },
      },
      {
        path: "text.shadow.blur",
        control: "slider",
        label: "Blur",
        group: "Shadow",
        min: 0,
        max: 80,
        step: 1,
        unit: "px",
        when: { path: "text.shadow", isSet: true },
      },
      {
        path: "text.shadow.x",
        control: "number",
        label: "Shadow X",
        group: "Shadow",
        step: 1,
        unit: "px",
        when: { path: "text.shadow", isSet: true },
      },
      {
        path: "text.shadow.y",
        control: "number",
        label: "Shadow Y",
        group: "Shadow",
        step: 1,
        unit: "px",
        when: { path: "text.shadow", isSet: true },
      },

      {
        path: "text.background",
        control: "enable",
        label: "Background box",
        group: "Background box",
        enableDefault: { color: "brand.primary", paddingX: 24, paddingY: 12, radius: 8 },
      },
      {
        path: "text.background.color",
        control: "color",
        label: "Box colour",
        group: "Background box",
        when: { path: "text.background", isSet: true },
      },
      {
        path: "text.background.paddingX",
        control: "slider",
        label: "Padding X",
        group: "Background box",
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
        when: { path: "text.background", isSet: true },
      },
      {
        path: "text.background.paddingY",
        control: "slider",
        label: "Padding Y",
        group: "Background box",
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
        when: { path: "text.background", isSet: true },
      },
      {
        path: "text.background.radius",
        control: "slider",
        label: "Box radius",
        group: "Background box",
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
        when: { path: "text.background", isSet: true },
      },

      ...TRANSFORM_CONTROLS,
    ],
    keyframable: [...TRANSFORM_KEYFRAMABLE, "text.fontSize"],
  },
  {
    id: "shape",
    label: "Shape",
    icon: "Square",
    kind: "graphic",
    componentKey: "ShapeItem",
    needsAsset: false,
    hasVisual: true,
    hasAudio: false,
    supportsTrim: false,
    defaultTrackType: "overlay",
    defaultDurationSeconds: 3,
    schema: z.object({ shape: ShapeSpecSchema }),
    defaults: { shape: DEFAULT_SHAPE },
    controls: [
      {
        path: "shape.kind",
        control: "segmented",
        label: "Shape",
        group: "Shape",
        options: [
          { value: "rect", label: "Rectangle" },
          { value: "ellipse", label: "Ellipse" },
          { value: "line", label: "Line" },
        ],
      },
      { path: "shape.fill", control: "color", label: "Fill", group: "Shape" },
      {
        path: "shape.widthPercent",
        control: "slider",
        label: "Width",
        group: "Shape",
        min: 1,
        max: 200,
        step: 1,
        unit: "%",
        keyframable: true,
      },
      {
        path: "shape.heightPercent",
        control: "slider",
        label: "Height",
        group: "Shape",
        min: 1,
        max: 200,
        step: 1,
        unit: "%",
        keyframable: true,
      },
      {
        path: "shape.radius",
        control: "slider",
        label: "Corner radius",
        group: "Shape",
        min: 0,
        max: 200,
        step: 1,
        unit: "px",
        when: { path: "shape.kind", equals: "rect" },
      },
      {
        path: "shape.stroke",
        control: "enable",
        label: "Stroke",
        group: "Shape",
        enableDefault: { color: "brand.text", width: 4 },
      },
      {
        path: "shape.stroke.color",
        control: "color",
        label: "Stroke colour",
        group: "Shape",
        when: { path: "shape.stroke", isSet: true },
      },
      {
        path: "shape.stroke.width",
        control: "slider",
        label: "Stroke width",
        group: "Shape",
        min: 0,
        max: 40,
        step: 0.5,
        unit: "px",
        when: { path: "shape.stroke", isSet: true },
      },
      ...TRANSFORM_CONTROLS,
    ],
    keyframable: [...TRANSFORM_KEYFRAMABLE, "shape.widthPercent", "shape.heightPercent"],
  },

  {
    /*
     * Subtitle — text item se **alag** item type (19.1).
     *
     * ⚠️ Text item me `cues` daal dena aasan lagta hai par galat hai: text item
     * ki poori zindagi ek hi content par tiki hai (`text.content`), aur subtitle
     * ki zindagi waqt ke saath badalne wale cues par. Ek hi type me dono rakhne
     * par har jagah "cues hain ya nahi" poochhna padta — renderer me, panel me,
     * validator me, har naye feature me.
     *
     * Roop (`text`) dono me ek hi schema se aata hai, isliye font/size/rang ka
     * code do jagah nahi hai.
     */
    id: "subtitle",
    label: "Captions",
    icon: "Captions",
    kind: "text",
    componentKey: "SubtitleItem",
    needsAsset: false,
    hasVisual: true,
    hasAudio: false,
    supportsTrim: false,
    defaultTrackType: "text",
    defaultDurationSeconds: 10,
    schema: z.object({ text: TextSpecSchema, subtitle: z.unknown() }),
    defaults: {
      text: {
        ...DEFAULT_TEXT,
        // Captions neeche baithti hain aur safe-area ke andar — Instagram ka
        // apna UI neeche ka hissa dhak leta hai.
        verticalAlign: "bottom" as const,
        maxWidthPercent: 84,
        fontWeight: 700,
      },
      subtitle: {
        styleId: "normal",
        params: {},
        cues: [],
        language: "hi",
      },
    },
    controls: [
      {
        path: "subtitle.styleId",
        control: "select",
        label: "Style",
        group: "Captions",
        options: [],
      },
      { path: "text.fontFamily", control: "font", label: "Font", group: "Captions" },
      {
        path: "text.fontSize",
        control: "number",
        label: "Size",
        group: "Captions",
        min: 4,
        step: 1,
        unit: "px",
        keyframable: true,
      },
      {
        path: "text.color",
        control: "color",
        label: "Rang",
        group: "Captions",
      },
      {
        path: "text.maxWidthPercent",
        control: "slider",
        label: "Chaudai",
        group: "Captions",
        min: 30,
        max: 100,
        step: 1,
        unit: "%",
      },
      ...TRANSFORM_CONTROLS,
    ],
    keyframable: [...TRANSFORM_KEYFRAMABLE, "text.fontSize"],
  },
];
