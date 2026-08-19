/**
 * Time math.
 *
 * Poore repo me frames <-> seconds ka conversion SIRF yahan hota hai. Kahin bhi
 * `/ 30` ya `* fps` likhna mana hai — fps project pe rehta hai aur 24/25/30/50/60
 * kuch bhi ho sakta hai, isliye har jagah alag math likhna hamesha toota hai.
 */

export const MIN_FPS = 1;
export const MAX_FPS = 240;

export function assertFps(fps: number): void {
  if (!Number.isFinite(fps) || fps < MIN_FPS || fps > MAX_FPS) {
    throw new Error(`Invalid fps: ${fps} (allowed ${MIN_FPS}-${MAX_FPS})`);
  }
}

export function framesToSeconds(frames: number, fps: number): number {
  assertFps(fps);
  return frames / fps;
}

/**
 * Seconds -> frames. Round hota hai, floor nahi: 1.999s @30fps ko 59 banana
 * (floor) har jagah ek frame ka nuksaan de deta hai.
 */
export function secondsToFrames(seconds: number, fps: number): number {
  assertFps(fps);
  return Math.round(seconds * fps);
}

/** Duration ke liye — kam se kam 1 frame, warna clip dikhega hi nahi. */
export function durationFromSeconds(seconds: number, fps: number): number {
  return Math.max(1, secondsToFrames(seconds, fps));
}

export interface TimecodeOptions {
  /** Ghanta 0 ho to `MM:SS:FF` de do (timeline ruler ke liye). */
  compact?: boolean;
}

/** Non-drop-frame timecode: `HH:MM:SS:FF`. */
export function framesToTimecode(
  frames: number,
  fps: number,
  options: TimecodeOptions = {},
): string {
  assertFps(fps);
  const sign = frames < 0 ? "-" : "";
  const total = Math.abs(Math.round(frames));
  const fpsInt = Math.round(fps);

  const ff = total % fpsInt;
  const totalSeconds = Math.floor(total / fpsInt);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);

  const pad = (n: number) => String(n).padStart(2, "0");
  if (options.compact && hh === 0) {
    return `${sign}${pad(mm)}:${pad(ss)}:${pad(ff)}`;
  }
  return `${sign}${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

export function clampFrame(frame: number, min: number, max: number): number {
  if (max < min) throw new Error(`clampFrame: max (${max}) < min (${min})`);
  return Math.min(max, Math.max(min, Math.round(frame)));
}

/**
 * Nazdeek ke candidate par snap karo (playhead, clip edge, scene boundary…).
 *
 * `threshold` frames me hai. Barabar doori par do candidate ho to chhota
 * candidate jeetta hai — warna drag karte waqt clip do jagah ke beech kaapta hai.
 */
export function snapFrame(
  frame: number,
  candidates: readonly number[],
  threshold: number,
): number {
  const target = Math.round(frame);
  if (threshold <= 0 || candidates.length === 0) return target;

  let best = target;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - target);
    if (distance > threshold) continue;
    if (distance < bestDistance || (distance === bestDistance && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
