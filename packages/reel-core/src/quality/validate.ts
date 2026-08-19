import { estimateMixPeak, suggestedMasterVolume } from "../audio/mix";
import { BUILTIN_FONTS } from "../config/fonts";
import { computeFit, type FitMode } from "../config/fit";
import { getItemType, requireExportPreset } from "../registry/index";
import type { Doc, Item } from "../schema/project";
import { framesToSeconds } from "../time";
import { requiredSourcePixels } from "./scale";

/**
 * Validation rules — **ek registry, if-else spaghetti nahi** (20.1).
 *
 * ⚠️ Har rule apne aap me poora hai: uska id, kitni badi baat hai, kis cheez
 * par lagti hai, aur kaise jaanchni hai. Nayi jaanch jodna is list me ek entry
 * hai — na koi `if` badalta hai, na koi switch.
 *
 * Yahi wo cheez hai jo Phase 11 ke `preflight()` se aage hai: wahan rules ek
 * plain array me the aur unme `scope` nahi tha, isliye "sirf asset ki jaanch
 * karo" jaisi baat mumkin hi nahi thi. Ab teen alag darwaze hain
 * (`validateAssetQuality` / `validateProjectQuality` / `validateExportSettings`)
 * aur teeno **wahi** rules chalate hain — copy nahi.
 */

export type ValidationSeverity = "error" | "warning" | "info";
export type ValidationScope = "project" | "item" | "asset" | "export";

export interface ValidationIssue {
  ruleId: string;
  severity: ValidationSeverity;
  scope: ValidationScope;
  message: string;
  /** Kis item ki wajah se — UI "Show me" isi se jump karta hai (20.8). */
  itemId?: string;
  assetId?: string;
  /**
   * Auto-fix ke liye zaroori numbers.
   *
   * ⚠️ Yahan **op nahi** hota, sirf data. Op UI banati hai (`applyOp` uska hai),
   * aur core ko UI ka pata nahi hona chahiye. Data hone se ek hi issue par do
   * alag fix bhi ban sakte hain.
   */
  data?: Record<string, number | string>;
}

export interface AssetInfo {
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** `temporary` assets ki expiry — 20.3 ka aakhri rule. */
  expiresAt?: string | null;
  /** Padhi ja sakti hai? `false` = corrupt ya adhoori upload. */
  readable?: boolean;
  codec?: string | null;
}

export interface ValidationContext {
  doc: Doc;
  /** assetId -> naap. Jo yahan **nahi** hai wo "gayab" maana jaata hai. */
  assets: Record<string, AssetInfo | undefined>;
  /** Export ki jaanch ke liye. */
  presetId?: string;
  /** Loudness/peak ki asli naap, agar pehle se ho. */
  measured?: { integratedLufs?: number | null; truePeakDb?: number | null };
  /** Abhi ka waqt — expiry ki jaanch ke liye (test me jama kiya ja sake). */
  now?: number;
}

export interface ValidationRule {
  id: string;
  label: string;
  severity: ValidationSeverity;
  scope: ValidationScope;
  check(context: ValidationContext): ValidationIssue[];
}

/** Source se kitna upar khinchne par "blurry" maana jaaye. */
export const UPSCALE_WARN_FACTOR = 1.15;

/** Spec ka **exact** message (20.5) — ise badalna mana hai. */
export const LOW_RES_MESSAGE = "Low-resolution asset detected. This asset may appear blurry in 4K.";

/** Isse lambi reel par platform khud kaat deta hai. */
const LONG_REEL_SECONDS = 90;

/* ------------------------------------------------------------- helpers */

function visualItems(doc: Doc): Item[] {
  return doc.items.filter((item) => getItemType(item.type)?.hasVisual);
}

function issue(
  rule: Pick<ValidationRule, "id" | "severity" | "scope">,
  message: string,
  extra: Partial<ValidationIssue> = {},
): ValidationIssue {
  return { ruleId: rule.id, severity: rule.severity, scope: rule.scope, message, ...extra };
}

/* --------------------------------------------------------------- rules */

export const VALIDATION_RULE_LIST: readonly ValidationRule[] = [
  {
    id: "empty-timeline",
    label: "Timeline khaali hai",
    severity: "error",
    scope: "project",
    check(context) {
      const self = this as ValidationRule;
      return context.doc.items.length === 0
        ? [issue(self, "Timeline khaali hai — export karne ko kuch hai hi nahi.")]
        : [];
    },
  },

  {
    id: "missing-asset",
    label: "Asset nahi mila",
    severity: "error",
    scope: "asset",
    check(context) {
      const self = this as ValidationRule;
      const issues: ValidationIssue[] = [];
      for (const item of context.doc.items) {
        if (!item.assetId || context.assets[item.assetId]) continue;
        issues.push(
          issue(
            self,
            `"${item.name}" ka asset nahi mila (${item.assetId}). Ye clip render me gulaabi card banegi.`,
            { itemId: item.id, assetId: item.assetId },
          ),
        );
      }
      return issues;
    },
  },

  {
    id: "unreadable-asset",
    label: "Asset padhi nahi ja rahi",
    severity: "error",
    scope: "asset",
    check(context) {
      const self = this as ValidationRule;
      const issues: ValidationIssue[] = [];
      for (const item of context.doc.items) {
        if (!item.assetId) continue;
        const asset = context.assets[item.assetId];
        if (!asset || asset.readable !== false) continue;
        issues.push(
          issue(
            self,
            `"${item.name}" ki file padhi nahi ja rahi — upload adhoori reh gayi ya file kharab hai. Dobara upload karo.`,
            { itemId: item.id, assetId: item.assetId },
          ),
        );
      }
      return issues;
    },
  },

  {
    id: "needs-asset",
    label: "Clip ko asset chahiye par lagi nahi",
    severity: "error",
    scope: "item",
    check(context) {
      const self = this as ValidationRule;
      const issues: ValidationIssue[] = [];
      for (const item of context.doc.items) {
        const entry = getItemType(item.type);
        if (!entry?.needsAsset || item.assetId) continue;
        issues.push(
          issue(self, `"${item.name}" (${entry.label}) par koi asset lagi hi nahi hai.`, {
            itemId: item.id,
          }),
        );
      }
      return issues;
    },
  },

  {
    id: "zero-duration",
    label: "Clip ki lambai 0 hai",
    severity: "error",
    scope: "item",
    check(context) {
      const self = this as ValidationRule;
      return context.doc.items
        .filter((item) => item.durationInFrames < 1)
        .map((item) =>
          issue(self, `"${item.name}" ki lambai 0 frame hai — wo kabhi dikhegi hi nahi.`, {
            itemId: item.id,
            data: { durationInFrames: item.durationInFrames },
          }),
        );
    },
  },

  {
    id: "all-hidden",
    label: "Sab kuch chhupa hua hai",
    severity: "error",
    scope: "project",
    check(context) {
      const self = this as ValidationRule;
      const visible = visualItems(context.doc).filter((item) => {
        if (item.hidden) return false;
        const track = context.doc.tracks.find((entry) => entry.id === item.trackId);
        return track ? !track.hidden : true;
      });
      return context.doc.items.length > 0 && visible.length === 0
        ? [issue(self, "Har dikhne wali cheez chhupi hui hai — video poori kaali aayegi.")]
        : [];
    },
  },

  {
    id: "beyond-duration",
    label: "Clip project ke bahar hai",
    severity: "warning",
    scope: "item",
    check(context) {
      const self = this as ValidationRule;
      return context.doc.items
        .filter((item) => item.startFrame >= context.doc.project.durationInFrames)
        .map((item) =>
          issue(self, `"${item.name}" project ke ant ke baad shuru hoti hai — video me dikhegi hi nahi.`, {
            itemId: item.id,
            data: { startFrame: item.startFrame, projectEnd: context.doc.project.durationInFrames },
          }),
        );
    },
  },

  {
    id: "upscale",
    label: "Source se bada khincha ja raha hai",
    severity: "warning",
    scope: "item",
    check(context) {
      const self = this as ValidationRule;
      const issues: ValidationIssue[] = [];
      const frame = { width: context.doc.project.width, height: context.doc.project.height };

      for (const item of visualItems(context.doc)) {
        if (!item.assetId) continue;
        const asset = context.assets[item.assetId];
        if (!asset?.width || !asset.height) continue;

        const source = { width: asset.width, height: asset.height };
        const fit = computeFit(source, frame, item.fit.mode as FitMode);
        const required = requiredSourcePixels({
          item,
          source,
          fitScale: Math.max(fit.scaleX, fit.scaleY),
        });

        if (required.totalScale <= UPSCALE_WARN_FACTOR) continue;

        issues.push(
          issue(
            self,
            `"${item.name}" ${source.width}×${source.height} ka hai par ${required.totalScale.toFixed(2)}x ` +
              `bada dikhaya ja raha hai — dhundhla aayega. Saaf dikhne ke liye kam se kam ` +
              `${required.width}×${required.height} chahiye.`,
            {
              itemId: item.id,
              assetId: item.assetId,
              data: {
                totalScale: Math.round(required.totalScale * 100) / 100,
                neededWidth: required.width,
                neededHeight: required.height,
                // Auto-fix: itni scale par blur nahi aayega.
                safeScale: Math.round((required.totalScale / (required.totalScale / UPSCALE_WARN_FACTOR)) * 100) / 100,
              },
            },
          ),
        );
      }
      return issues;
    },
  },

  {
    id: "low-res-for-preset",
    label: "Source preset se chhota hai",
    severity: "warning",
    scope: "asset",
    check(context) {
      const self = this as ValidationRule;
      if (!context.presetId) return [];
      const preset = requireExportPreset(context.presetId);
      if (!preset.requiresMinHeight) return [];

      const issues: ValidationIssue[] = [];
      for (const item of visualItems(context.doc)) {
        if (!item.assetId) continue;
        const asset = context.assets[item.assetId];
        if (!asset?.height) continue;
        if (asset.height >= preset.requiresMinHeight) continue;

        /*
         * ⚠️ Message spec se **hu-ba-hu** liya gaya hai (20.5) aur English me
         * hai. Ise translate karne ka mann karta hai par nahi karna: ye wahi
         * line hai jo spec me likhi hai aur uspar baahar ke tools/test tike ho
         * sakte hain.
         */
        issues.push(
          issue(self, LOW_RES_MESSAGE, {
            itemId: item.id,
            assetId: item.assetId,
            data: {
              sourceHeight: asset.height,
              presetMinHeight: preset.requiresMinHeight,
            },
          }),
        );
      }
      return issues;
    },
  },

  {
    id: "preset-too-big",
    label: "Preset project se bada hai",
    severity: "warning",
    scope: "export",
    check(context) {
      const self = this as ValidationRule;
      if (!context.presetId) return [];
      const preset = requireExportPreset(context.presetId);
      if (!preset.requiresMinHeight) return [];
      if (context.doc.project.height >= preset.requiresMinHeight) return [];

      return [
        issue(
          self,
          `"${preset.label}" preset ${preset.requiresMinHeight}p ke liye hai par project ` +
            `${context.doc.project.height}p ka hai. File badi hogi, quality behtar nahi — aur "4K" ka ` +
            `label lagakar upscaled video dena mana hai.`,
        ),
      ];
    },
  },

  {
    id: "no-gain-from-4k",
    label: "4K se quality nahi badhegi",
    severity: "info",
    scope: "export",
    check(context) {
      const self = this as ValidationRule;
      if (!context.presetId) return [];
      const preset = requireExportPreset(context.presetId);
      if (!preset.requiresMinHeight || preset.requiresMinHeight < 2160) return [];

      const sources = visualItems(context.doc)
        .map((item) => (item.assetId ? context.assets[item.assetId] : undefined))
        .filter((asset): asset is AssetInfo => Boolean(asset?.height));
      if (sources.length === 0) return [];

      const best = Math.max(...sources.map((asset) => asset.height as number));
      if (best >= preset.requiresMinHeight) return [];

      /*
       * Ye **info** hai, warning nahi — aur ye farak zaroori hai. User 4K jaan-
       * boojhkar chun sakta hai (platform ka apna niyam, ya aage ke liye). Use
       * "galti" batana galat hoga; use **sach** batana zaroori hai.
       */
      return [
        issue(
          self,
          `Saare assets zyada se zyada ${best}p ke hain. 4K me export karne se quality nahi ` +
            `badhegi — sirf file badi hogi aur render me zyada waqt lagega.`,
          { data: { bestSourceHeight: best, presetHeight: preset.requiresMinHeight } },
        ),
      ];
    },
  },

  {
    id: "source-shorter",
    label: "Clip apne source se lambi hai",
    severity: "warning",
    scope: "item",
    check(context) {
      const self = this as ValidationRule;
      const issues: ValidationIssue[] = [];
      const fps = context.doc.project.fps;

      for (const item of context.doc.items) {
        if (!item.assetId) continue;
        const asset = context.assets[item.assetId];
        if (!asset?.durationMs || asset.durationMs <= 0) continue;
        if (!getItemType(item.type)?.supportsTrim) continue;

        const sourceFrames = Math.round((asset.durationMs / 1000) * fps);
        const needed = item.trimStartFrame + item.durationInFrames * item.playbackRate;
        if (needed <= sourceFrames + 1) continue;

        const extraFrames = Math.round((needed - sourceFrames) / item.playbackRate);
        issues.push(
          issue(
            self,
            `"${item.name}" apne source se lambi hai — aakhri ` +
              `${framesToSeconds(extraFrames, fps).toFixed(1)}s me kaala frame aayega.`,
            {
              itemId: item.id,
              data: { extraFrames, safeDuration: item.durationInFrames - extraFrames },
            },
          ),
        );
      }
      return issues;
    },
  },

  {
    id: "fps-mismatch",
    label: "Source ka fps project se alag hai",
    severity: "warning",
    scope: "item",
    check(context) {
      const self = this as ValidationRule;
      const issues: ValidationIssue[] = [];
      const fps = context.doc.project.fps;

      for (const item of context.doc.items) {
        if (!item.assetId || item.type !== "video") continue;
        const asset = context.assets[item.assetId];
        if (!asset?.durationMs) continue;

        /*
         * ⚠️ Asset ka apna fps hamesha pata nahi hota, aur **jhootha andaaza
         * lagana galat hoga**. Isliye ye rule sirf tab bolta hai jab project ka
         * fps 24/25/30/50/60 me se na ho — kyunki ajeeb fps par har source par
         * judder aata hai, chahe uska apna fps kuch bhi ho.
         */
        if ([24, 25, 30, 50, 60].includes(fps)) continue;

        issues.push(
          issue(
            self,
            `Project ${fps}fps par hai. Video clips aksar 24/25/30 fps ki hoti hain — ` +
              `is fps par unme halka judder (jhatka) aata hai. 30fps sabse safe hai.`,
            { itemId: item.id, data: { projectFps: fps } },
          ),
        );
        // Ek hi baar batana kaafi hai — ye project ki baat hai, clip ki nahi.
        break;
      }
      return issues;
    },
  },

  {
    id: "missing-font",
    label: "Font nahi mila",
    severity: "warning",
    scope: "item",
    check(context) {
      const self = this as ValidationRule;
      const known = new Set(BUILTIN_FONTS.map((font) => font.id));
      const issues: ValidationIssue[] = [];

      for (const item of context.doc.items) {
        const family = item.text?.fontFamily;
        if (!family) continue;
        // Brand token ya seedha CSS stack — dono theek hain.
        if (family.startsWith("brand.") || family.includes(",")) continue;
        if (known.has(family)) continue;

        issues.push(
          issue(
            self,
            `"${item.name}" ka font "${family}" list me nahi hai — render me wo kisi aur font ` +
              `me nikal jaayega, aur wo video me sabse gandi galti lagti hai.`,
            { itemId: item.id, data: { fontFamily: family } },
          ),
        );
      }
      return issues;
    },
  },

  {
    id: "silent",
    label: "Awaaz hai hi nahi",
    severity: "warning",
    scope: "project",
    check(context) {
      const self = this as ValidationRule;
      const audible = context.doc.items.filter((item) => {
        if (!getItemType(item.type)?.hasAudio) return false;
        if (item.audio.muted || item.hidden) return false;
        const track = context.doc.tracks.find((entry) => entry.id === item.trackId);
        return track ? !track.muted && !track.hidden : true;
      });
      return context.doc.items.length > 0 && audible.length === 0
        ? [issue(self, "Reel me koi awaaz nahi hai — bina awaaz ki reel bahut kam dekhi jaati hai.")]
        : [];
    },
  },

  {
    id: "clipping-risk",
    label: "Awaazein milkar clip kar sakti hain",
    severity: "warning",
    scope: "project",
    check(context) {
      const self = this as ValidationRule;
      /*
       * ⚠️ Ye **anumaan** hai, naap nahi — aur `estimateMixPeak()` khud bhi
       * hamesha zyada batata hai (sab gain ka jod leta hai). Ye jaan-boojhkar
       * hai: kam batane wali chetavni bekaar hoti hai. Asli naap render ke baad
       * `astats` se hoti hai.
       *
       * Yahan wahi function chalta hai jo master panel me chalta hai — do jagah
       * do hisaab rakhne par panel kuch kehta aur export kuch aur.
       */
      const { peak, frame } = estimateMixPeak(context.doc);
      if (peak <= 1) return [];

      const suggestion = suggestedMasterVolume(context.doc);
      return [
        issue(
          self,
          `Frame ${frame} par saari awaazein milkar ${peak.toFixed(2)} par ja rahi hain ` +
            `(1 se upar = clipping ka khatra). Master volume ${suggestion?.toFixed(2) ?? "kam"} par le aao.`,
          {
            data: {
              peak: Math.round(peak * 100) / 100,
              frame,
              ...(suggestion === null ? {} : { suggestedMaster: suggestion }),
            },
          },
        ),
      ];
    },
  },

  {
    id: "loudness-off-target",
    label: "Loudness target se door hai",
    severity: "warning",
    scope: "export",
    check(context) {
      const self = this as ValidationRule;
      const measured = context.measured?.integratedLufs;
      if (measured === undefined || measured === null) return [];

      const target = context.doc.project.audio.loudnessLufs;
      const gap = Math.abs(measured - target);
      if (gap <= 2) return [];

      return [
        issue(
          self,
          `Naapi hui loudness ${measured.toFixed(1)} LUFS hai par target ${target} LUFS. ` +
            `Itna farak sunai deta hai — master volume dekho.`,
          { data: { measured: Math.round(measured * 10) / 10, target } },
        ),
      ];
    },
  },

  {
    id: "long-reel",
    label: "Reel bahut lambi hai",
    severity: "info",
    scope: "project",
    check(context) {
      const self = this as ValidationRule;
      const seconds = framesToSeconds(
        context.doc.project.durationInFrames,
        context.doc.project.fps,
      );
      if (seconds <= LONG_REEL_SECONDS) return [];

      return [
        issue(
          self,
          `Reel ${Math.round(seconds)}s lambi hai. Instagram Reels ${LONG_REEL_SECONDS}s tak hi ` +
            `leta hai — usse lambi apne aap kat jaati hai.`,
          { data: { seconds: Math.round(seconds), limit: LONG_REEL_SECONDS } },
        ),
      ];
    },
  },

  {
    id: "temp-asset-expiring",
    label: "Temporary asset expire hone wali hai",
    severity: "warning",
    scope: "asset",
    check(context) {
      const self = this as ValidationRule;
      const now = context.now ?? Date.now();
      const issues: ValidationIssue[] = [];

      for (const item of context.doc.items) {
        if (!item.assetId) continue;
        const asset = context.assets[item.assetId];
        if (!asset?.expiresAt) continue;

        const expires = Date.parse(asset.expiresAt);
        if (!Number.isFinite(expires)) continue;

        const daysLeft = (expires - now) / (24 * 60 * 60 * 1000);
        if (daysLeft > 7) continue;

        /*
         * Cleanup script referenced temp assets ko kabhi nahi mitata (20.10),
         * par user ko phir bhi pata hona chahiye — wo asset kisi doosre project
         * se aayi ho sakti hai jise wo aage delete kar de.
         */
        issues.push(
          issue(
            self,
            daysLeft <= 0
              ? `"${item.name}" ki asset ki expiry beet chuki hai. Use permanent banao ya dobara upload karo.`
              : `"${item.name}" ki asset ${Math.ceil(daysLeft)} din me expire ho rahi hai.`,
            { itemId: item.id, assetId: item.assetId, data: { daysLeft: Math.round(daysLeft) } },
          ),
        );
      }
      return issues;
    },
  },
];

/* -------------------------------------------------------------- runner */

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** `info` — kaam ki baatein jo rokti nahi. */
  recommendations: ValidationIssue[];
  issues: ValidationIssue[];
}

function report(issues: ValidationIssue[]): ValidationReport {
  const errors = issues.filter((entry) => entry.severity === "error");
  const warnings = issues.filter((entry) => entry.severity === "warning");
  const recommendations = issues.filter((entry) => entry.severity === "info");
  return { valid: errors.length === 0, errors, warnings, recommendations, issues };
}

function run(context: ValidationContext, scopes: readonly ValidationScope[]): ValidationReport {
  const issues: ValidationIssue[] = [];
  for (const rule of VALIDATION_RULE_LIST) {
    if (!scopes.includes(rule.scope)) continue;
    issues.push(...rule.check(context));
  }
  return report(issues);
}

/** Sirf assets ki jaanch (20.2). */
export function validateAssetQuality(context: ValidationContext): ValidationReport {
  return run(context, ["asset"]);
}

/** Project + items ki jaanch — export preset ke bina bhi chalti hai (20.2). */
export function validateProjectQuality(context: ValidationContext): ValidationReport {
  return run(context, ["project", "item", "asset"]);
}

/** Export ke waqt sab kuch — yahi wo darwaza hai jispar export rukta hai (20.2). */
export function validateExportSettings(context: ValidationContext): ValidationReport {
  return run(context, ["project", "item", "asset", "export"]);
}

/**
 * Strict tier me export **rukta** hai (20.6).
 *
 * ⚠️ Strict me warnings bhi rokti hain, sirf errors nahi. Yahi Strict ka poora
 * matlab hai: "mujhe pakka pata hona chahiye ki kuch bhi dhundhla ya adhoora
 * nahi hai". Baaki tiers me warning dikhti hai aur "Export anyway" chalta hai —
 * kyunki aksar user ko pata hota hai ki wo warning uske liye maayne nahi rakhti.
 */
export function canExport(report: ValidationReport, tier: "normal" | "strict"): boolean {
  if (tier === "strict") return report.errors.length === 0 && report.warnings.length === 0;
  return report.errors.length === 0;
}
