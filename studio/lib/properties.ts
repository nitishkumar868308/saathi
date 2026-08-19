/**
 * Generated properties panel ka ganit — **React ke bina**.
 *
 * Panel ka poora dhaancha registry ke `controls[]` descriptor se banta hai (9.1),
 * isliye yahan sirf teen sawaalon ka jawab hai:
 *
 *   1. is selection me kaun se controls dikhne chahiye? (mixed selection)
 *   2. is path ki value kya hai — sab items par ek jaisi, ya alag-alag?
 *   3. is path ki default value kya hai (double-click se reset ke liye)?
 *
 * Teeno pure hain aur `scripts/check-properties.ts` inhe asli numbers se naapta
 * hai. Component me likhne par ye "aankh se theek lag raha hai" wali cheezein
 * ban jaate — aur mixed selection ki galti aankh se kabhi nahi dikhti.
 */

import {
  checkUpscale,
  computeFit,
  controlVisible,
  createItem,
  getByPath,
  getItemType,
  groupControls,
  type ControlDescriptor,
  type FitMode,
  type Item,
} from "@reel/core";

/**
 * "Sab items par ek jaisi value nahi hai."
 *
 * `null` ya `undefined` se kaam nahi chalta — wo **asli** values hain (stroke
 * `null` ka matlab "stroke nahi hai"). Isliye ek alag nishaan chahiye jise koi
 * property galti se le na sake.
 */
export const MIXED = Symbol("mixed");
export type MaybeMixed<T = unknown> = T | typeof MIXED;

export function isMixed(value: unknown): value is typeof MIXED {
  return value === MIXED;
}

/**
 * Chuni hui items par is path ki value.
 *
 * Ek bhi item alag ho to `MIXED` — jise panel me `—` dikhta hai. Pehle item ki
 * value dikha dena aasan hota par wo jhooth hai: user ko lagta hai sab clips ka
 * rang laal hai, jabki sirf ek ka hai.
 */
export function commonValue(items: readonly Item[], path: string): MaybeMixed {
  if (items.length === 0) return undefined;

  const first = getByPath(items[0] as Item, path);
  for (let i = 1; i < items.length; i += 1) {
    const value = getByPath(items[i] as Item, path);
    if (!sameValue(first, value)) return MIXED;
  }
  return first;
}

/** Gehri tulna — anchor jaisi arrays aur stroke jaise chhote object ke liye. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Multi-select me kaun se controls dikhein (9.5).
 *
 * **Sirf wo jo har chune hue item par hain** — path se milaya jaata hai. Ek text
 * aur ek image ek saath chune hon to sirf Transform/Size&Fit bachte hain, aur
 * yahi sahi hai: text ka font image par lagana ka koi matlab hi nahi.
 *
 * Kram pehle item ke hisaab se rehta hai, taaki ek clip chunne aur do chunne me
 * panel ke sections apni jagah na badlein.
 */
export function commonControls(items: readonly Item[]): ControlDescriptor[] {
  if (items.length === 0) return [];

  const first = getItemType((items[0] as Item).type);
  if (!first) return [];
  if (items.length === 1) return [...first.controls];

  const others = items.slice(1).map((item) => {
    const entry = getItemType(item.type);
    return new Set((entry?.controls ?? []).map((control) => control.path));
  });

  return first.controls.filter((control) =>
    others.every((paths) => paths.has(control.path)),
  );
}

/** Controls ko sections me baanto — aur wahi controls jo abhi dikhne chahiye. */
export function visibleGroups(
  items: readonly Item[],
  controls: readonly ControlDescriptor[],
): { group: string; controls: ControlDescriptor[] }[] {
  const read = (path: string): unknown => {
    const value = commonValue(items, path);
    // Mixed halat me `when` ka jawab dena namumkin hai; aise me control dikha
    // dena hi kam nuksaan wala hai — chhupa dene par user ko lagta hai property
    // hai hi nahi.
    return isMixed(value) ? undefined : value;
  };

  const shown = controls.filter((control) => {
    if (!control.when) return true;
    // Mixed par `when` ko sach maan lo (upar wali wajah).
    if (isMixed(commonValue(items, control.when.path))) return true;
    return controlVisible(control, read);
  });

  return groupControls(shown).filter((group) => group.controls.length > 0);
}

/**
 * Is path ki default value (9.4 ka double-click reset).
 *
 * Default kahin **likhi nahi** jaati — ek bilkul naya item banakar usi path se
 * padh li jaati hai. Isliye transform, fit, audio, text, shape — sabki default
 * apne aap sahi hoti hai, aur registry me default badalne par reset bhi badal
 * jaata hai. Do jagah default rakhne par wo dono ek hafte me alag ho jaate hain.
 */
const pristineCache = new Map<string, Item>();

export function defaultValue(itemType: string, path: string, fps: number): unknown {
  const key = `${itemType}@${fps}`;
  let pristine = pristineCache.get(key);
  if (!pristine) {
    pristine = createItem(itemType, { fps, trackId: "_" });
    pristineCache.set(key, pristine);
  }
  return getByPath(pristine, path);
}

/* ------------------------------------------------- effective resolution */

export interface ResolutionReadout {
  source: { width: number; height: number };
  frame: { width: number; height: number };
  /** Fit ki base scale × user ki scale. */
  totalScale: number;
  /** Frame me item sach me kitne pixels ghera hai. */
  effective: { width: number; height: number };
  upscaled: boolean;
  /** Saaf dikhne ke liye source kitna bada hona chahiye tha. */
  requiredSource: { width: number; height: number };
  message: string | null;
}

/**
 * "Ye clip sach me kitne pixels par dikh rahi hai" (9.6c).
 *
 * Ye A1 quality rule ka **live** roop hai. Export ke waqt warning dena bhi theek
 * hai, par tab tak user ne wo scale keyframe laga diya hota hai aur badalna
 * mehnga lagta hai. Panel me number dikhte rehne se galti hoti hi nahi.
 *
 * Ganit `computeFit` + `checkUpscale` se aata hai — wahi do function jo render
 * chalate hain. Panel ka apna hisaab likhna matlab do sach, aur unme se ek hamesha
 * galat.
 */
export function resolutionReadout(args: {
  source: { width: number; height: number };
  frame: { width: number; height: number };
  fitMode: FitMode;
  itemScale: number;
  /**
   * Animations sabse zyada kitni scale maangte hain (10.11).
   *
   * ⚠️ Ye alag se aana **zaroori** hai. Ken Burns 1 → 1.4 me blur clip ke
   * **aakhir** me aata hai; sirf item ki apni scale dekhne se shuruaat me sab
   * theek lagta hai aur dhundhlapan final MP4 me baad me pakda jaata hai. Isi
   * baat ke liye `animationsMaxScale()` sabse bada scale deta hai, chalte hue
   * wala nahi.
   */
  animationScale?: number;
}): ResolutionReadout {
  const fit = computeFit(args.source, args.frame, args.fitMode);
  const extra = args.itemScale * (args.animationScale ?? 1);
  const check = checkUpscale(args.source, args.frame, fit, extra);

  const totalScale = Math.max(fit.scaleX, fit.scaleY) * extra;
  return {
    source: args.source,
    frame: args.frame,
    totalScale,
    effective: {
      width: Math.round(args.source.width * fit.scaleX * extra),
      height: Math.round(args.source.height * fit.scaleY * extra),
    },
    upscaled: check.upscaled,
    requiredSource: check.requiredSource,
    message: check.message,
  };
}
