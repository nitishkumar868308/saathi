/**
 * Easing ke naam — keyframes aur animations dono yahi ids use karte hain.
 * Asli curve math Phase 13 (keyframe engine) me aayega; abhi ye list schema ko
 * valid value dene ke liye hai, taaki koi typo chupchaap doc me na baithe.
 */

export interface EasingDef {
  id: string;
  label: string;
}

export const EASINGS: readonly EasingDef[] = [
  { id: "linear", label: "Linear" },
  { id: "ease", label: "Ease" },
  { id: "ease-in", label: "Ease in" },
  { id: "ease-out", label: "Ease out" },
  { id: "ease-in-out", label: "Ease in-out" },
  { id: "step", label: "Step (koi interpolation nahi)" },
] as const;

export const EASING_IDS: readonly string[] = EASINGS.map((e) => e.id);
export const DEFAULT_EASING = "ease-in-out";

export function isEasingId(value: string): boolean {
  return EASING_IDS.includes(value);
}
