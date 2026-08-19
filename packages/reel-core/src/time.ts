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

/**
 * Timecode se frames — `framesToTimecode` ka ulta (9.7).
 *
 * Ye isliye chahiye ki timing wale khaane me user timecode likh sake, sirf frame
 * number nahi. Chaar roop chalte hain, aur teeno chhote roop se seekh kar likhe
 * gaye hain ki aadmi kya type karta hai:
 *
 *   `"90"`              -> 90 frames (seedha number)
 *   `"12:05"`           -> 12 second 5 frame
 *   `"01:12:05"`        -> 1 min 12 sec 5 frame
 *   `"00:01:12:05"`     -> poora HH:MM:SS:FF
 *
 * ⚠️ Aakhri hissa hamesha **frames** hai, seconds ka dashamlav nahi. `12:05` ko
 * "12.05 second" padhna sabse aam galti hoti — isliye yahan ginti hamesha
 * daayein se hoti hai: frames, phir seconds, phir minutes, phir ghante.
 *
 * Galat input par `null` — chupchaap 0 laut'na sabse bura jawab hai, kyunki tab
 * ek typo clip ko shuruaat me pahucha deta hai.
 */
export function parseTimecode(input: string, fps: number): number | null {
  assertFps(fps);
  const text = input.trim();
  if (!text) return null;

  const negative = text.startsWith("-");
  const parts = (negative ? text.slice(1) : text).split(":");
  if (parts.length > 4) return null;

  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part.trim())) return null;
    numbers.push(Number(part.trim()));
  }

  // Daayein se: frames, seconds, minutes, hours.
  const [frames = 0, seconds = 0, minutes = 0, hours = 0] = [...numbers].reverse();
  const fpsInt = Math.round(fps);

  // Ek akela number seedha frames hai; usme 60 se badi value bilkul theek hai.
  if (numbers.length > 1 && frames >= fpsInt) return null;
  if (numbers.length > 2 && seconds >= 60) return null;
  if (numbers.length > 3 && minutes >= 60) return null;

  const total = ((hours * 60 + minutes) * 60 + seconds) * fpsInt + frames;
  return negative ? -total : total;
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
