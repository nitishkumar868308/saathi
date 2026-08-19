import { getByPath } from "../path";
import { getEasingFunction } from "./easing";
import type { Item, Keyframe } from "../schema/project";

/*
 * Easing ab apni file me hai (`keyframes/easing.ts`) — Phase 10 me animations
 * ko bhi wahi curve chahiye the, aur do copy rakhne par ek din CSS wala
 * `ease-out` aur video wala `ease-out` alag ho jaate.
 */
export * from "./easing";

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
