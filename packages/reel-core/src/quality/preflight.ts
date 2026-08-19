import { animationsMaxScale } from "../registry/animations";
import { getItemType, requireExportPreset } from "../registry/index";
import { itemEndFrame, type Doc, type Item } from "../schema/project";
import { framesToSeconds } from "../time";

/**
 * Export se pehle ki jaanch (11.4 — halka roop; poora validator Phase 20 me).
 *
 * ⚠️ **Do darje hain, aur unka farak sabse zaroori baat hai:**
 *
 *  - **error** — export shuru hi nahi hona chahiye. Ye wo cheezein hain jinka
 *    nateeja ek aisi video hai jo dekhne layak hi nahi (khaali timeline, gayab
 *    asset). Aisi video banane me minute lagte hain aur wo minute poore bekaar
 *    jaate hain.
 *  - **warning** — export ho sakta hai, par user ko pata hona chahiye. Yahan
 *    rok lagana galat hoga: kabhi-kabhi blurry image chalti hai, aur "editor ne
 *    mujhe export hi nahi karne diya" se bura kuch nahi.
 *
 * Isliye UI me warnings ke saath "Export anyway" hota hai, errors ke saath nahi.
 *
 * ⚠️ Ye ek **list** hai (Dynamic rule 11), if-else ki lambi zanjeer nahi. Nayi
 * jaanch = ek entry. Phase 20 isi list ko badhayega aur `VALIDATION_RULES`
 * registry me le jaayega.
 */

export type PreflightLevel = "error" | "warning";

export interface PreflightIssue {
  /** Rule ka id — UI isi se "ye dobara mat dikhao" jaisi cheezein kar sakta hai. */
  ruleId: string;
  level: PreflightLevel;
  message: string;
  /** Kis item ki wajah se (agar kisi ek ki wajah se ho). */
  itemId?: string;
}

export interface PreflightInput {
  doc: Doc;
  presetId: string;
  /**
   * assetId -> source ka naap aur lambai. Jo asset yahan **nahi** hai use
   * "gayab" maana jaata hai.
   *
   * ⚠️ Ye baahar se aata hai kyunki `@reel/core` ko DB ka pata nahi hona
   * chahiye — wahi package browser aur worker dono me chalta hai.
   */
  assets: Record<string, { width: number | null; height: number | null; durationMs: number | null } | undefined>;
}

export interface PreflightRule {
  id: string;
  label: string;
  run(input: PreflightInput): PreflightIssue[];
}

/** Source se kitna upar khinchne par "blurry" maana jaaye. */
export const UPSCALE_WARN_FACTOR = 1.15;

export const PREFLIGHT_RULES: readonly PreflightRule[] = [
  {
    id: "empty-timeline",
    label: "Timeline khaali hai",
    run: ({ doc }) =>
      doc.items.length === 0
        ? [
            {
              ruleId: "empty-timeline",
              level: "error",
              message: "Timeline khaali hai — export karne ko kuch hai hi nahi.",
            },
          ]
        : [],
  },

  {
    id: "missing-asset",
    label: "Asset nahi mila",
    run: ({ doc, assets }) => {
      const issues: PreflightIssue[] = [];
      for (const item of doc.items) {
        if (!item.assetId) continue;
        if (assets[item.assetId]) continue;
        issues.push({
          ruleId: "missing-asset",
          level: "error",
          itemId: item.id,
          message: `"${item.name}" ka asset nahi mila (${item.assetId}). Ye clip render me gulaabi card banegi.`,
        });
      }
      return issues;
    },
  },

  {
    id: "needs-asset",
    label: "Clip ko asset chahiye par lagi nahi",
    run: ({ doc }) => {
      const issues: PreflightIssue[] = [];
      for (const item of doc.items) {
        const entry = getItemType(item.type);
        if (!entry?.needsAsset) continue;
        if (item.assetId) continue;
        issues.push({
          ruleId: "needs-asset",
          level: "error",
          itemId: item.id,
          message: `"${item.name}" (${entry.label}) par koi asset lagi hi nahi hai.`,
        });
      }
      return issues;
    },
  },

  {
    id: "zero-duration",
    label: "Clip ki lambai 0 hai",
    run: ({ doc }) => {
      const issues: PreflightIssue[] = [];
      for (const item of doc.items) {
        if (item.durationInFrames >= 1) continue;
        issues.push({
          ruleId: "zero-duration",
          level: "error",
          itemId: item.id,
          message: `"${item.name}" ki lambai ${item.durationInFrames} frames hai — kam se kam 1 chahiye.`,
        });
      }
      return issues;
    },
  },

  {
    id: "all-hidden",
    label: "Sab kuch chhupa hua hai",
    run: ({ doc }) => {
      const hiddenTracks = new Set(doc.tracks.filter((track) => track.hidden).map((t) => t.id));
      const visible = doc.items.filter(
        (item) => !item.hidden && !hiddenTracks.has(item.trackId) && getItemType(item.type)?.hasVisual,
      );
      if (doc.items.length === 0 || visible.length > 0) return [];
      return [
        {
          ruleId: "all-hidden",
          level: "warning",
          message: "Koi bhi dikhne wali clip chalu nahi hai — video poori kaali aayegi.",
        },
      ];
    },
  },

  {
    id: "silent",
    label: "Koi awaaz nahi",
    run: ({ doc }) => {
      const mutedTracks = new Set(doc.tracks.filter((track) => track.muted).map((t) => t.id));
      const audible = doc.items.filter((item) => {
        if (!getItemType(item.type)?.hasAudio) return false;
        if (item.audio.muted || item.audio.volume <= 0) return false;
        return !mutedTracks.has(item.trackId);
      });
      if (audible.length > 0) return [];
      return [
        {
          ruleId: "silent",
          level: "warning",
          message: "Poori reel me koi awaaz nahi hai. Jaan-boojhkar ho to theek hai.",
        },
      ];
    },
  },

  {
    id: "clipping-risk",
    label: "Volume 1 se upar",
    run: ({ doc }) => {
      const issues: PreflightIssue[] = [];
      for (const item of doc.items) {
        if (item.audio.volume <= 1) continue;
        issues.push({
          ruleId: "clipping-risk",
          level: "warning",
          itemId: item.id,
          message: `"${item.name}" ka volume ${item.audio.volume}x hai — clipping ka khatra. Loudness pass isko theek karne ki koshish karega, par source hi toota ho to nahi kar sakta.`,
        });
      }
      return issues;
    },
  },

  {
    id: "upscale",
    label: "Source se bada khincha ja raha hai",
    run: ({ doc, assets }) => {
      const issues: PreflightIssue[] = [];
      const frameHeight = doc.project.height;

      for (const item of doc.items) {
        if (!item.assetId) continue;
        const source = assets[item.assetId];
        if (!source?.height || !source.width) continue;
        if (!getItemType(item.type)?.hasVisual) continue;

        /*
         * ⚠️ Yahan **animations ka sabse bada scale** bhi ginti me aata hai.
         * Ken Burns 1 → 1.4 me dhundhlapan clip ke *aakhir* me aata hai; sirf
         * item ki apni scale dekhne se sab theek lagta hai aur blur final MP4
         * me hi pakda jaata (Section 3A / 10.11).
         */
        const totalScale = item.transform.scale * animationsMaxScale(item);
        const needed = (frameHeight * totalScale) / source.height;
        if (needed <= UPSCALE_WARN_FACTOR) continue;

        issues.push({
          ruleId: "upscale",
          level: "warning",
          itemId: item.id,
          message:
            `"${item.name}" ${source.width}×${source.height} ka hai par ${needed.toFixed(2)}x bada ` +
            `dikhaya ja raha hai — dhundhla aayega. Saaf dikhne ke liye kam se kam ` +
            `${Math.ceil(source.width * needed)}×${Math.ceil(source.height * needed)} chahiye.`,
        });
      }
      return issues;
    },
  },

  {
    id: "source-shorter",
    label: "Clip apne source se lambi hai",
    run: ({ doc, assets }) => {
      const issues: PreflightIssue[] = [];
      const fps = doc.project.fps;

      for (const item of doc.items) {
        if (!item.assetId) continue;
        const source = assets[item.assetId];
        if (!source?.durationMs || source.durationMs <= 0) continue;
        if (!getItemType(item.type)?.supportsTrim) continue;

        const sourceFrames = Math.round((source.durationMs / 1000) * fps);
        const needed = item.trimStartFrame + item.durationInFrames * item.playbackRate;
        if (needed <= sourceFrames + 1) continue;

        issues.push({
          ruleId: "source-shorter",
          level: "warning",
          itemId: item.id,
          message:
            `"${item.name}" apne source se lambi hai — aakhri ` +
            `${framesToSeconds(Math.round((needed - sourceFrames) / item.playbackRate), fps).toFixed(1)}s ` +
            `me kaala frame aayega.`,
        });
      }
      return issues;
    },
  },

  {
    id: "preset-too-big",
    label: "Preset project se bada hai",
    run: ({ doc, presetId }) => {
      const preset = requireExportPreset(presetId);
      if (!preset.requiresMinHeight) return [];
      if (doc.project.height >= preset.requiresMinHeight) return [];

      return [
        {
          ruleId: "preset-too-big",
          level: "warning",
          message:
            `"${preset.label}" preset ${preset.requiresMinHeight}p ke liye hai par project ` +
            `${doc.project.height}p ka hai. File badi hogi, quality behtar nahi — aur "4K" ka ` +
            `label lagakar upscaled video dena mana hai.`,
        },
      ];
    },
  },

  {
    id: "beyond-duration",
    label: "Clip project ke bahar hai",
    run: ({ doc }) => {
      const issues: PreflightIssue[] = [];
      for (const item of doc.items) {
        if (item.startFrame < doc.project.durationInFrames) continue;
        issues.push({
          ruleId: "beyond-duration",
          level: "warning",
          itemId: item.id,
          message: `"${item.name}" project ke ant ke baad shuru hoti hai — video me dikhegi hi nahi.`,
        });
      }
      return issues;
    },
  },
];

export interface PreflightResult {
  issues: PreflightIssue[];
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
  /** Export shuru ho sakta hai? (Sirf errors rokte hain.) */
  canExport: boolean;
}

export function preflight(input: PreflightInput): PreflightResult {
  const issues: PreflightIssue[] = [];
  for (const rule of PREFLIGHT_RULES) issues.push(...rule.run(input));

  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  return { issues, errors, warnings, canExport: errors.length === 0 };
}

/**
 * Export ki file kitni badi hogi, mota andaaza.
 *
 * ⚠️ Ye **andaaza hai aur UI me bhi wahi likha jaata hai** — CRF variable
 * bitrate deta hai, isliye ek sthir number dena jhooth hoga. Base numbers asli
 * renders se aaye hain (1080x1920@30, CRF 18 par ~4.3 Mbps), aur pixel-rate ke
 * anupaat me badalte hain.
 */
export function estimateExportBytes(doc: Doc, presetId: string): number {
  const preset = requireExportPreset(presetId);
  const { width, height, fps, durationInFrames } = doc.project;

  const REFERENCE = { pixels: 1080 * 1920, fps: 30, crf: 18, mbps: 4.3 };
  const pixelRatio = (width * height) / REFERENCE.pixels;
  const fpsRatio = fps / REFERENCE.fps;

  // CRF ka har 6 ka farak lagbhag dugna/aadha bitrate deta hai.
  const crfRatio = Math.pow(2, (REFERENCE.crf - preset.crf) / 6);

  const videoMbps = REFERENCE.mbps * pixelRatio * fpsRatio * crfRatio;
  const totalMbps = videoMbps + preset.audioBitrateKbps / 1000;
  const seconds = framesToSeconds(durationInFrames, fps);

  return Math.round((totalMbps * 1_000_000 * seconds) / 8);
}

/** Doc me kaun se asset chahiye — job ke saath jama karne ke liye (11.6). */
export function assetIdsForExport(doc: Doc): string[] {
  const ids = new Set<string>();
  for (const item of doc.items as readonly Item[]) {
    if (item.assetId) ids.add(item.assetId);
  }
  return [...ids];
}

/** Aakhri clip kahan khatam hoti hai — "project ke bahar" wali jaanch ke liye. */
export function contentEndFrame(doc: Doc): number {
  return doc.items.reduce((end, item) => Math.max(end, itemEndFrame(item)), 0);
}
