/**
 * Tap / touch ka nishaan (18.11).
 *
 * Screen recording dekhne wale ko ye bilkul pata nahi chalta ki ungli **kahan**
 * padi — screen achanak badal jaati hai aur wo ek jump jaisa lagta hai. Ek chhota
 * gola, jo tap ki jagah par phail kar gayab ho jaaye, us jump ko wajah de deta hai.
 *
 * ⚠️ Ye poora hissa **ek pure function** par khada hai, aur wo jaan-boojhkar
 * yahan (core me) hai — renderer aur preview dono isi ko bulate hain. Do jagah
 * ye ganit likhne par ek din preview me tap dikhta aur MP4 me nahi, ya ulta.
 */

/** Nishaan kitni der dikhe. Second me — frame me nahi, warna fps badalte hi lambai badal jaati. */
export const TAP_SECONDS = 0.4;

export interface Tap {
  /** Item-local frame — clip ke apne start se. */
  frame: number;
  /** Screen ke andar jagah, 0..1 (0,0 = upar-baayein). */
  x: number;
  y: number;
}

export interface LiveTap {
  x: number;
  y: number;
  /** 0 = abhi shuru hua, 1 = bas gayab hone wala hai. Renderer isi se phailata hai. */
  progress: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Is frame par kaun se tap dikhne chahiye, aur kitne phaile hue.
 *
 * ⚠️ Window **seconds me** naapi jaati hai (`TAP_SECONDS`), frames me nahi. Agar
 * frame count fix kar dete (jaise "12 frame") to 60fps ke project me wahi nishaan
 * aadhe waqt ka ho jaata — aur wo farak sirf saath-saath dekhne par pakda jaata.
 *
 * ⚠️ Ek se zyada tap ek saath dikh sakte hain (do ungli, ya tez-tez tap). Sirf
 * "aakhri tap" dikhana aasan hota par tez tap wali recording me wo aadhe nishaan
 * kha jaata.
 */
export function visibleTaps(
  taps: readonly Tap[],
  localFrame: number,
  fps: number,
): LiveTap[] {
  const window = Math.max(1, Math.round(TAP_SECONDS * fps));
  const out: LiveTap[] = [];

  for (const tap of taps) {
    const since = localFrame - tap.frame;
    // `since === window` par tap khatam — us frame par wo dikhna nahi chahiye,
    // warna do tap laga-laga hon to unke nishaan ek frame ke liye jud jaate hain.
    if (since < 0 || since >= window) continue;
    out.push({
      x: clamp01(tap.x),
      y: clamp01(tap.y),
      progress: since / window,
    });
  }

  return out;
}
