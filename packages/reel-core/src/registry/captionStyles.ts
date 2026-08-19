import { z } from "zod";

import { createRegistry, type ControlDescriptor, type Registry } from "./types";

/**
 * CAPTION_STYLES — caption ka style ek **plugin** hai (19.6).
 *
 * ⚠️ Har style ka kaam ek hi sawaal ka jawab dena hai: "is frame par ye shabd
 * kaisa dikhe?" Jawab ek plain object hai (CSS jaisa), React ka element nahi —
 * kyunki `@reel/core` me React nahi aata (wahi package worker aur browser dono
 * me chalta hai).
 *
 * Isi wajah se naya style jodna sach me ek entry hai: renderer, preview aur
 * properties panel teeno isi list se chalte hain.
 */

/** Ek shabd ki haalat — style isi se tay karta hai ki wo kaisa dikhe. */
export interface WordState {
  /** Shabd ka number (0 se). */
  index: number;
  total: number;
  /** Abhi ispar highlight hai? */
  active: boolean;
  /** Ye shabd bola ja chuka hai? (karaoke me pehle wale alag dikhte hain.) */
  past: boolean;
  /** Shabd ke apne waqt me kitna aage — 0..1. Sirf active shabd par matlab rakhta hai. */
  progress: number;
}

/** Style ka jawab — ek shabd ke liye. */
export interface WordStyle {
  /** CSS color. Brand token bhi ho sakta hai (`brand.primary`). */
  color?: string;
  /** 0..1 — poore shabd ki paardarshita. */
  opacity?: number;
  /** 1 = jaisa hai. */
  scale?: number;
  /** Shabd ke peeche ka dabba (highlight). */
  background?: string;
  /** Shabd bilkul na dikhe (typewriter). */
  hidden?: boolean;
  fontWeight?: number;
}

export interface CaptionStyleContext {
  word: WordState;
  params: Record<string, unknown>;
}

export interface CaptionStyleEntry {
  id: string;
  label: string;
  icon: string;
  hint: string;
  schema: z.ZodTypeAny;
  defaults: Record<string, unknown>;
  controls: readonly ControlDescriptor[];
  /**
   * Per-word timing chahiye?
   *
   * `false` wale styles bina timing ke bhi theek chalte hain. `true` walon par
   * UI batati hai ki timing ka andaaza lag raha hai (19.8) — bina bataye chalane
   * par user sochta hai ki highlight galat hai, jabki wo bas andaaza hai.
   */
  needsWordTiming: boolean;
  apply(context: CaptionStyleContext): WordStyle;
}

function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(params: Record<string, unknown>, key: string, fallback: string): string {
  const value = params[key];
  return typeof value === "string" && value ? value : fallback;
}

const HIGHLIGHT_CONTROL: ControlDescriptor = {
  path: "highlightColor",
  control: "color",
  label: "Highlight rang",
  group: "Caption",
};

/* ------------------------------------------------------------- built-ins */

export const BUILTIN_CAPTION_STYLES: readonly CaptionStyleEntry[] = [
  {
    id: "normal",
    label: "Saada",
    icon: "Type",
    hint: "Poora cue ek saath — sabse saaf aur sabse tez padha jaata hai",
    schema: z.object({}),
    defaults: {},
    controls: [],
    needsWordTiming: false,
    apply: () => ({}),
  },

  {
    id: "bold",
    label: "Mota",
    icon: "Bold",
    hint: "Poora cue mota — chhote phone par door se bhi padha jaata hai",
    schema: z.object({ weight: z.number().min(400).max(900).default(800) }),
    defaults: { weight: 800 },
    controls: [
      { path: "weight", control: "slider", label: "Motai", group: "Caption", min: 400, max: 900, step: 100 },
    ],
    needsWordTiming: false,
    apply: ({ params }) => ({ fontWeight: num(params, "weight", 800) }),
  },

  {
    id: "highlight-word",
    label: "Shabd par rang",
    icon: "Highlighter",
    hint: "Jo shabd bola ja raha hai wo alag rang me",
    schema: z.object({
      highlightColor: z.string().default("brand.accent"),
      dimPast: z.boolean().default(false),
    }),
    defaults: { highlightColor: "brand.accent", dimPast: false },
    controls: [
      HIGHLIGHT_CONTROL,
      { path: "dimPast", control: "toggle", label: "Bole hue shabd halke", group: "Caption" },
    ],
    needsWordTiming: true,
    apply: ({ word, params }) => {
      if (word.active) return { color: str(params, "highlightColor", "brand.accent") };
      if (word.past && params.dimPast === true) return { opacity: 0.55 };
      return {};
    },
  },

  {
    id: "karaoke",
    label: "Karaoke",
    icon: "Mic",
    hint: "Bole hue shabd rang me, aage wale halke — gaane jaisa",
    schema: z.object({
      highlightColor: z.string().default("brand.accent"),
      upcomingOpacity: z.number().min(0.1).max(1).default(0.45),
    }),
    defaults: { highlightColor: "brand.accent", upcomingOpacity: 0.45 },
    controls: [
      HIGHLIGHT_CONTROL,
      {
        path: "upcomingOpacity",
        control: "slider",
        label: "Aage wale kitne halke",
        group: "Caption",
        min: 0.1,
        max: 1,
        step: 0.05,
      },
    ],
    needsWordTiming: true,
    apply: ({ word, params }) => {
      const color = str(params, "highlightColor", "brand.accent");
      if (word.active || word.past) return { color };
      return { opacity: num(params, "upcomingOpacity", 0.45) };
    },
  },

  {
    id: "pop",
    label: "Pop",
    icon: "Sparkles",
    hint: "Har shabd par ek chhoti uchhaal — tez reels me dhyan kheenchti hai",
    schema: z.object({
      amount: z.number().min(0).max(0.6).default(0.18),
      highlightColor: z.string().default("brand.accent"),
    }),
    defaults: { amount: 0.18, highlightColor: "brand.accent" },
    controls: [
      { path: "amount", control: "slider", label: "Uchhaal", group: "Caption", min: 0, max: 0.6, step: 0.02 },
      HIGHLIGHT_CONTROL,
    ],
    needsWordTiming: true,
    apply: ({ word, params }) => {
      if (!word.active) return {};
      /*
       * Uchhaal shabd ke **shuru** me sabse zyada hoti hai aur phir baith jaati
       * hai. Poore shabd bhar bade rehne par har shabd bada dikhta hai aur "pop"
       * ka koi matlab hi nahi rehta — uchhaal ka matlab hi ek pal ka hona hai.
       */
      const fall = Math.max(0, 1 - word.progress * 3);
      return {
        scale: 1 + num(params, "amount", 0.18) * fall,
        color: str(params, "highlightColor", "brand.accent"),
      };
    },
  },

  {
    id: "typewriter",
    label: "Typewriter",
    icon: "Keyboard",
    hint: "Shabd ek-ek karke aate hain",
    schema: z.object({}),
    defaults: {},
    controls: [],
    needsWordTiming: true,
    // Aage wale shabd **chhupe** hote hain, hataye nahi — hatane par baaki
    // shabd har frame par apni jagah badalte hain aur line kaanpti dikhti hai.
    apply: ({ word }) => (word.active || word.past ? {} : { hidden: true }),
  },

  {
    id: "boxed",
    label: "Dabbe me",
    icon: "Square",
    hint: "Har shabd ke peeche ek dabba — chamakdaar video par sabse achha padha jaata hai",
    schema: z.object({
      boxColor: z.string().default("brand.primary"),
      activeOnly: z.boolean().default(true),
    }),
    defaults: { boxColor: "brand.primary", activeOnly: true },
    controls: [
      { path: "boxColor", control: "color", label: "Dabbe ka rang", group: "Caption" },
      { path: "activeOnly", control: "toggle", label: "Sirf bolte shabd par", group: "Caption" },
    ],
    needsWordTiming: false,
    apply: ({ word, params }) => {
      const color = str(params, "boxColor", "brand.primary");
      if (params.activeOnly === false) return { background: color };
      return word.active ? { background: color } : {};
    },
  },
];

export const CAPTION_STYLES: Registry<CaptionStyleEntry> =
  createRegistry<CaptionStyleEntry>("CAPTION_STYLES");

export function listCaptionStyles(): readonly CaptionStyleEntry[] {
  return CAPTION_STYLES.list();
}

export function requireCaptionStyle(id: string): CaptionStyleEntry {
  return CAPTION_STYLES.require(id);
}

export function getCaptionStyle(id: string): CaptionStyleEntry | undefined {
  return CAPTION_STYLES.get(id);
}
