import { requireExportPreset } from "../registry/index";
import { itemEndFrame, type Doc, type Item } from "../schema/project";
import { framesToSeconds } from "../time";
import { validateExportSettings, type ValidationIssue } from "./validate";

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
   */
  assets: Record<
    string,
    { width: number | null; height: number | null; durationMs: number | null } | undefined
  >;
}

export interface PreflightResult {
  issues: PreflightIssue[];
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
  /** Export shuru ho sakta hai? (Sirf errors rokte hain.) */
  canExport: boolean;
}

/**
 * Export se pehle ki jaanch (11.4).
 *
 * ⚠️ Phase 20 me is function ka **poora dimaag `quality/validate.ts` me chala
 * gaya**. Yahan ab sirf naam aur shape bachi hai.
 *
 * Wajah: Phase 20 me ek asli registry bani (`VALIDATION_RULE_LIST`) jisme har
 * rule ka `scope` aur `severity` hai. Purane rules ko waise ka waisa chhod dene
 * par do jagah do list hoti — aur unme se ek dheere-dheere purani padti. Ek
 * rule kahin theek hota aur doosri jagah wahi bug pada rehta.
 *
 * `info` wale issues yahan **nahi** aate: purane callers sirf error/warning
 * jaante hain, aur unhe warning bana dena jhooth hota (wo rokti nahi par dikhti
 * chetavni ki tarah hain). Jise recommendations chahiye wo seedha
 * `validateExportSettings()` bulaye.
 */
export function preflight(input: PreflightInput): PreflightResult {
  const report = validateExportSettings({
    doc: input.doc,
    assets: input.assets,
    presetId: input.presetId,
  });

  const map = (issue: ValidationIssue): PreflightIssue => ({
    ruleId: issue.ruleId,
    level: issue.severity === "error" ? "error" : "warning",
    message: issue.message,
    ...(issue.itemId === undefined ? {} : { itemId: issue.itemId }),
  });

  const errors = report.errors.map(map);
  const warnings = report.warnings.map(map);
  return {
    issues: [...errors, ...warnings],
    errors,
    warnings,
    canExport: report.valid,
  };
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
