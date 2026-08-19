import { ffmpegPath, run } from "./ffmpeg";

/**
 * Thumbnails — library ke grid ke liye.
 *
 * Teen tarike, teen kism ke asset ke liye (ASSET_KINDS ka `thumbnail` field
 * batata hai kaunsa):
 *  - **resize**   image ko chhota kar do
 *  - **frame**    video se ek frame nikaalo
 *  - **waveform** audio ki lehar bana do (`showwavespic`)
 *
 * Sab JPEG dete hain, ek hi naap ke dabbe me. Ek hi format rakhne se storage
 * key bhi ek jaisi rehti hai (`permanent/thumbs/<assetId>.jpg`) aur UI ko har
 * asset ke liye alag soch nahi rakhni padti.
 *
 * ⚠️ **Upscale kabhi nahi** — `force_original_aspect_ratio=decrease` ke saath
 * `min(iw, MAX)` lagta hai, isliye chhoti image chhoti hi rehti hai. Thumbnail
 * ko bada karke dikhana Section 3A ke us hi jhooth ka chhota roop hota jisse
 * poore project me bacha ja raha hai.
 */

/** Thumbnail ka sabse bada naap (px) — dono taraf ki hadd. */
export const THUMBNAIL_MAX_SIZE = 512;

/** Waveform ki tasveer ka naap. */
export const WAVEFORM_SIZE = { width: 640, height: 180 } as const;

/** Lanczos — Section 3A ka scaling rule, yahan bhi. */
const SCALE_FILTER = (max: number) =>
  `scale=w=min(iw\\,${max}):h=min(ih\\,${max}):force_original_aspect_ratio=decrease:flags=lanczos`;

const QUIET = ["-hide_banner", "-loglevel", "error", "-y"] as const;

export async function makeImageThumbnail(
  input: string,
  output: string,
  maxSize = THUMBNAIL_MAX_SIZE,
): Promise<void> {
  await run(ffmpegPath(), [
    ...QUIET,
    "-i",
    input,
    "-vf",
    SCALE_FILTER(maxSize),
    "-frames:v",
    "1",
    "-q:v",
    "3",
    output,
  ]);
}

export interface PosterOptions {
  /** Kis second par frame lena hai. Default: shuru se thoda aage. */
  atSeconds?: number;
  maxSize?: number;
}

/**
 * Video ka poster.
 *
 * Frame shuru se thoda aage se liya jaata hai — pehla frame aksar kaala ya fade-in
 * hota hai, aur kaali thumbnail se library me kuch samajh nahi aata.
 */
export async function makeVideoPoster(
  input: string,
  output: string,
  options: PosterOptions = {},
): Promise<void> {
  const at = Math.max(0, options.atSeconds ?? 1);
  await run(ffmpegPath(), [
    ...QUIET,
    // `-ss` input se pehle = tez seek (keyframe tak). Poster ke liye frame-exact
    // hona zaroori nahi, aur 200MB file par ye farak minute me naapa jaata hai.
    "-ss",
    String(at),
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    SCALE_FILTER(options.maxSize ?? THUMBNAIL_MAX_SIZE),
    "-q:v",
    "3",
    output,
  ]);
}

/**
 * Audio ki waveform.
 *
 * `split_channels=0` — dono channel ek hi lehar me. Library ke chhote card me
 * do alag lehar sirf gadbad dikhti hai; stereo ka farak Phase 15 ke audio panel
 * me dekhna hoga, yahan nahi.
 */
export async function makeWaveform(
  input: string,
  output: string,
  size: { width: number; height: number } = WAVEFORM_SIZE,
): Promise<void> {
  await run(ffmpegPath(), [
    ...QUIET,
    "-i",
    input,
    "-filter_complex",
    `showwavespic=s=${size.width}x${size.height}:colors=#c25a37:split_channels=0`,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    output,
  ]);
}

/**
 * ASSET_KINDS ke `thumbnail` field ke hisaab se sahi tarika chalao.
 *
 * Switch yahan **ek hi jagah** hai (registry lookup ke saath) — Dynamic rule 3
 * ka wahi allowance. Nayi kism aane par sirf uska strategy naam yahan judta hai.
 */
export async function makeThumbnail(
  strategy: string,
  input: string,
  output: string,
  options: { durationMs?: number | null } = {},
): Promise<boolean> {
  switch (strategy) {
    case "resize":
      await makeImageThumbnail(input, output);
      return true;
    case "frame": {
      // Lambi video me 1s bhi kaala ho sakta hai, isliye 10% par jaate hain —
      // par chhoti clip me 10% se aage jaane ka koi matlab nahi.
      const durationSeconds = (options.durationMs ?? 0) / 1000;
      const at = durationSeconds > 10 ? durationSeconds * 0.1 : Math.min(1, durationSeconds / 2);
      await makeVideoPoster(input, output, { atSeconds: at });
      return true;
    }
    case "waveform":
      await makeWaveform(input, output);
      return true;
    default:
      // "none" — font waghera. Chupchaap chhod dena hi sahi hai, error nahi.
      return false;
  }
}
