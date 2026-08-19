import { DEFAULT_EASING } from "../config/easing";
import { getByPath } from "../path";
import type { Item, Keyframe } from "../schema/project";

/**
 * Keyframe evaluation.
 *
 * ⚠️ **Scope ki baat, saaf-saaf:** poora keyframe *engine* (lanes, UI, curve
 * editor, per-property handles) Phase 13 ka kaam hai. Yahan sirf utna hai jitna
 * Phase 3 ko ek chalti hui Ken Burns dikhane ke liye chahiye — value nikalna.
 * Phase 13 ise badhayega, badlega nahi.
 *
 * Do baatein Phase 1 me tay ho chuki hain aur yahan wahi maani gayi hain:
 *  - keyframe ka `frame` **item-local** hai (0 = item ka apna start)
 *  - keyframes property **path** se address hote hain (`"transform.scale"`),
 *    isliye koi bhi nayi property apne aap keyframable ho jaati hai
 */

/** Ek easing curve: 0..1 andar, 0..1 bahar. */
export type EasingFunction = (t: number) => number;

/**
 * Cubic-bezier solver (CSS jaisa hi).
 *
 * Newton-Raphson se x ke liye t dhoondhte hain, phir us t par y. Ye wahi tarika
 * hai jo browser use karte hain — isliye preview aur render me curve bilkul ek
 * jaisa lagta hai, aur "CSS me aur video me animation alag lag rahi hai" wali
 * pareshani hoti hi nahi.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const curve = (a: number, b: number, t: number): number => {
    const c = 3 * a;
    const bTerm = 3 * (b - a) - c;
    const aTerm = 1 - c - bTerm;
    return ((aTerm * t + bTerm) * t + c) * t;
  };
  const slope = (a: number, b: number, t: number): number => {
    const c = 3 * a;
    const bTerm = 3 * (b - a) - c;
    const aTerm = 1 - c - bTerm;
    return (3 * aTerm * t + 2 * bTerm) * t + c;
  };

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = curve(x1, x2, t) - x;
      if (Math.abs(error) < 1e-6) return curve(y1, y2, t);
      const d = slope(x1, x2, t);
      // Derivative 0 ke aas-paas Newton bhaag jaata hai — tab bisection par gir jao.
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }

    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 20; i += 1) {
      const value = curve(x1, x2, t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value > x) high = t;
      else low = t;
      t = (low + high) / 2;
    }
    return curve(y1, y2, t);
  };
}

/** CSS ke wahi curve, wahi numbers. */
export const EASING_FUNCTIONS: Record<string, EasingFunction> = {
  linear: (t) => t,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  "ease-in": cubicBezier(0.42, 0, 1, 1),
  "ease-out": cubicBezier(0, 0, 0.58, 1),
  "ease-in-out": cubicBezier(0.42, 0, 0.58, 1),
  // Step: beech me kuch nahi badalta, agle keyframe par ek jhatke me badal jaata hai.
  step: () => 0,
};

export function getEasingFunction(id: string): EasingFunction {
  return EASING_FUNCTIONS[id] ?? EASING_FUNCTIONS[DEFAULT_EASING] ?? ((t: number) => t);
}

/**
 * Do keyframes ke beech ka easing **baayen** keyframe se aata hai.
 *
 * Ye chhoti si baat baar-baar galat likhi jaati hai. Sochne ka sahi tarika: har
 * keyframe kehta hai "yahan se aage kaise nikalna hai", isliye segment ka curve
 * uske shuruaati keyframe ka hota hai — jaise CSS transition ka easing shuru
 * hone wale state par lagta hai.
 */
function blend(a: Keyframe, b: Keyframe, frame: number): unknown {
  const span = b.frame - a.frame;
  const t = span <= 0 ? 1 : (frame - a.frame) / span;
  const eased = getEasingFunction(a.easing)(Math.min(1, Math.max(0, t)));

  if (typeof a.value === "number" && typeof b.value === "number") {
    return a.value + (b.value - a.value) * eased;
  }
  // Number ke alawa (rang, string, boolean) abhi interpolate nahi hote — aadha
  // rang dena aadha jhooth hota. Phase 13/14 me colour interpolation aayega;
  // tab tak value jhatke se badalti hai, jo kam se kam imaandaar hai.
  return eased >= 1 ? b.value : a.value;
}

/**
 * Ek property path par is frame ki value nikalo.
 *
 * `localFrame` item ke apne start se ginte hain. Keyframes na hon to `null` —
 * caller tab item ki static value use karta hai.
 */
export function sampleKeyframes(
  keyframes: Record<string, readonly Keyframe[]>,
  path: string,
  localFrame: number,
): unknown | null {
  const list = keyframes[path];
  if (!list || list.length === 0) return null;

  // Doc me keyframes kabhi bhi bina order ke aa sakte hain (AI patch, template,
  // haath se editing) — isliye har baar sort karke chalte hain.
  const sorted = [...list].sort((a, b) => a.frame - b.frame);
  const first = sorted[0] as Keyframe;
  const last = sorted[sorted.length - 1] as Keyframe;

  // Pehle keyframe se pehle aur aakhri ke baad value **rukti** hai (hold), aage
  // nahi badhti. Extrapolate karne se Ken Burns clip ke bahar bhi zoom karta
  // rehta aur transform bekaar bada ho jaata.
  if (localFrame <= first.frame) return first.value;
  if (localFrame >= last.frame) return last.value;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i] as Keyframe;
    const b = sorted[i + 1] as Keyframe;
    if (localFrame >= a.frame && localFrame <= b.frame) return blend(a, b, localFrame);
  }
  return last.value;
}

/**
 * Item ki koi bhi property is frame par kya hai — keyframe ho to wo, warna static.
 *
 * Renderer ke har item component ke liye ekmatra raasta. Isi wajah se "kaun si
 * property animate ho sakti hai" ka jawab registry me hai, code me nahi.
 */
export function resolveItemValue<T>(item: Item, path: string, localFrame: number): T {
  const animated = sampleKeyframes(item.keyframes, path, localFrame);
  if (animated !== null && animated !== undefined) return animated as T;
  return getByPath(item, path) as T;
}

/** Is item par kahin bhi keyframe laga hai? (UI ka badge dikhane ke liye.) */
export function hasKeyframes(item: Item, path?: string): boolean {
  if (path) return (item.keyframes[path]?.length ?? 0) > 0;
  return Object.values(item.keyframes).some((list) => list.length > 0);
}

/**
 * Kisi path par keyframes ki sabse badi value — Section 3A ke upscale check ke liye.
 *
 * Ken Burns 1 -> 1.4 me blur clip ke **aakhir** me aata hai. Sirf shuruaati scale
 * dekhne se sab theek lagta hai aur video me dhundhlapan baad me pakda jaata hai.
 */
export function maxKeyframeValue(item: Item, path: string): number {
  const list = item.keyframes[path];
  const staticValue = getByPath(item, path);
  const base = typeof staticValue === "number" ? staticValue : 1;
  if (!list || list.length === 0) return base;

  let max = base;
  for (const keyframe of list) {
    if (typeof keyframe.value === "number") max = Math.max(max, keyframe.value);
  }
  return max;
}
