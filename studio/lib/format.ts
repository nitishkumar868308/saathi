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

/** `1080×1920` — `x` nahi, asli multiplication sign. */
export function sizeLabel(width: number, height: number): string {
  return `${width}×${height}`;
}
