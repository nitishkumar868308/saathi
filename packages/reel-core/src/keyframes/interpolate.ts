import { getByPath } from "../path";
import { cubicBezier, getEasingFunction } from "./easing";
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

/* ------------------------------------------------------------ rang (13.1) */

/** `#rgb`, `#rrggbb`, `#rrggbbaa` — teeno chalte hain. */
export function parseHexColor(value: string): [number, number, number, number] | null {
  const text = value.trim();
  if (!text.startsWith("#")) return null;

  const hex = text.slice(1);
  const expand = (part: string): number => Number.parseInt(part.repeat(2), 16);

  if (hex.length === 3 || hex.length === 4) {
    const parts = hex.split("").map(expand);
    if (parts.some((n) => Number.isNaN(n))) return null;
    return [parts[0] as number, parts[1] as number, parts[2] as number, (parts[3] ?? 255) as number];
  }
  if (hex.length === 6 || hex.length === 8) {
    const parts: number[] = [];
    for (let i = 0; i < hex.length; i += 2) parts.push(Number.parseInt(hex.slice(i, i + 2), 16));
    if (parts.some((n) => Number.isNaN(n))) return null;
    return [parts[0] as number, parts[1] as number, parts[2] as number, (parts[3] ?? 255) as number];
  }
  return null;
}

function toHex(rgba: [number, number, number, number]): string {
  const part = (n: number): string =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  const [r, g, b, a] = rgba;
  // Alpha 255 par usko likhna hi nahi — `#ff0000` padhne me `#ff0000ff` se
  // behtar hai, aur CSS dono ko ek jaisa samajhta hai.
  return a >= 255 ? `#${part(r)}${part(g)}${part(b)}` : `#${part(r)}${part(g)}${part(b)}${part(a)}`;
}

/**
 * Do rangon ke beech ka rang (13.1).
 *
 * ⚠️ Ye **sRGB me** mila jaata hai, kisi behtar rang-space me nahi. Wajah
 * imaandaari hai: browser ka CSS transition bhi sRGB me milata hai, aur preview
 * (CSS) aur render (Chromium) dono ka nateeja bilkul ek hona chahiye. "Sahi"
 * rang-space (Oklab) chun'ne par preview aur MP4 me halka sa farak aa jaata,
 * aur wo farak sirf side-by-side dekh kar pakda jaata hai.
 *
 * ⚠️ Brand token (`brand.primary`) yahan interpolate **nahi** hota — wo render
 * ke waqt asli rang banta hai. Aadha-token jaisi koi cheez hoti hi nahi, isliye
 * aise me value jhatke se badalti hai.
 */
export function blendColors(from: string, to: string, t: number): string | null {
  const a = parseHexColor(from);
  const b = parseHexColor(to);
  if (!a || !b) return null;

  return toHex([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ]);
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
  const clamped = Math.min(1, Math.max(0, t));

  /*
   * Custom bezier `easing` ke **upar** chalta hai (13.2). Dono fields isliye
   * hain ki dropdown wala easing (jo 95% baar kaafi hota hai) padhne me saaf
   * rahe, aur curve editor ka custom curve uske saath baith sake.
   */
  const curve = a.bezier
    ? cubicBezier(a.bezier[0], a.bezier[1], a.bezier[2], a.bezier[3])
    : getEasingFunction(a.easing);
  const eased = curve(clamped);

  if (typeof a.value === "number" && typeof b.value === "number") {
    return a.value + (b.value - a.value) * eased;
  }

  // Vector (anchor, crop ke kone) — har hissa alag se mila jaata hai.
  if (Array.isArray(a.value) && Array.isArray(b.value) && a.value.length === b.value.length) {
    const from = a.value as unknown[];
    const to = b.value as unknown[];
    if (from.every((n) => typeof n === "number") && to.every((n) => typeof n === "number")) {
      return (from as number[]).map(
        (value, index) => value + (((to as number[])[index] as number) - value) * eased,
      );
    }
  }

  if (typeof a.value === "string" && typeof b.value === "string") {
    const color = blendColors(a.value, b.value, eased);
    if (color !== null) return color;
  }

  /*
   * Baaki sab (boolean, brand token, koi bhi string) jhatke se badalta hai.
   * Aadha `true` ya aadha `brand.primary` jaisi koi cheez hoti hi nahi, aur
   * kuch bana kar dena jhooth hoga.
   */
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

  const sorted = sortedKeyframes(list);
  const first = sorted[0] as Keyframe;
  const last = sorted[sorted.length - 1] as Keyframe;

  // Pehle keyframe se pehle aur aakhri ke baad value **rukti** hai (hold), aage
  // nahi badhti. Extrapolate karne se Ken Burns clip ke bahar bhi zoom karta
  // rehta aur transform bekaar bada ho jaata.
  if (localFrame <= first.frame) return first.value;
  if (localFrame >= last.frame) return last.value;

  /*
   * Binary search (13.11).
   *
   * ⚠️ Linear scan bilkul theek chalta hai — jab tak nahi chalta. 500 keyframes
   * wale project me har frame par poori list chhaanni padti hai, aur wo kaam
   * **har item ke har property par, har frame par** hota hai. 30fps ki 30s reel
   * me wo lakhon comparison ban jaata hai aur playback hakla jaata hai. Binary
   * search me wahi kaam ~9 kadam me ho jaata hai.
   */
  let low = 0;
  let high = sorted.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if ((sorted[mid] as Keyframe).frame <= localFrame) low = mid;
    else high = mid;
  }
  return blend(sorted[low] as Keyframe, sorted[high] as Keyframe, localFrame);
}

/**
 * Keyframes ko kram me lao — **cache ke saath**.
 *
 * Doc me keyframes kabhi bhi bina order ke aa sakte hain (AI patch, template,
 * haath se editing), isliye sort zaroori hai. Par har frame par sort karna
 * binary search ka poora faayda kha jaata hai — sort O(n log n) hai aur search
 * O(log n).
 *
 * ⚠️ Cache ki chaabi **array ka reference** hai (WeakMap), uski copy nahi. Immer
 * har badlaav par nayi array deta hai, isliye purani entry apne aap bekaar ho
 * jaati hai aur GC use utha leta hai — stale value dikhne ka koi raasta hi nahi.
 */
const sortCache = new WeakMap<readonly Keyframe[], Keyframe[]>();

export function sortedKeyframes(list: readonly Keyframe[]): readonly Keyframe[] {
  const cached = sortCache.get(list);
  if (cached) return cached;

  const sorted = [...list].sort((a, b) => a.frame - b.frame);
  sortCache.set(list, sorted);
  return sorted;
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
