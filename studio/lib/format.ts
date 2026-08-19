import { framesToTimecode } from "@reel/core";

/**
 * Dikhane ke liye chhote formatters.
 *
 * Time ka math yahan **nahi** hota — wo `@reel/core/time` me hai (Dynamic rule 6).
 * Yahan sirf "kaisa dikhe" hai.
 */

/** `00:15:00` — ruler jaisa nahi, card jaisa: `0:15`. */
export function clipLength(durationInFrames: number, fps: number): string {
  const timecode = framesToTimecode(durationInFrames, fps, { compact: true });
  const [minutes, seconds] = timecode.split(":");
  return `${Number(minutes)}:${seconds}`;
}

/** "abhi", "5 min pehle", "3 din pehle" — chhoti aur bina library ke. */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "abhi";

  const steps: [number, string][] = [
    [60, "min"],
    [60, "ghante"],
    [24, "din"],
  ];
  let value = seconds / 60;
  let unit = "min";
  for (let i = 1; i < steps.length; i += 1) {
    const [divisor, name] = steps[i] as [number, string];
    if (value < divisor) break;
    value /= divisor;
    unit = name;
  }
  return `${Math.round(value)} ${unit} pehle`;
}

/**
 * `30500` -> `"0:30"`. Asset ki lambai milliseconds me aati hai (DB ka
 * `duration_ms`), frames me nahi — isliye yahan `framesToTimecode` ka koi kaam
 * nahi. Frame ka math hamesha `@reel/core/time` se hota hai; ye uska maamla
 * hai hi nahi.
 */
export function msToClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** `1080×1920` — `x` nahi, asli multiplication sign. */
export function sizeLabel(width: number, height: number): string {
  return `${width}×${height}`;
}
