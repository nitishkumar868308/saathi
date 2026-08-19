import { ffmpegPath, probe, run, videoStream } from "./ffmpeg";

/**
 * Video/audio ulta karo (15.9).
 *
 * ⚠️ Ye hamesha ek **naya** file banata hai. Asli file kabhi nahi badalti — wo
 * Phase 1 ka locked rule hai, aur reverse uska sabse bada imtihan hai: ulti file
 * ko "wahi file" maan lena matlab user ka original media hamesha ke liye gaya.
 * Naya asset `lifecycle: "temporary"` ke saath save hota hai, taaki cleanup use
 * baad me uthaa sake.
 *
 * ⚠️ Ye **dheema** hai, aur uski wajah ganit me hai: `reverse` filter poore
 * stream ko memory me bharta hai, kyunki aakhri frame pehle dena hota hai. 10s
 * ki 1080p clip par ye ~1 GB tak le sakta hai. Isliye yahan ek hadd hai aur
 * lambi clip par saaf mana kiya jaata hai — chup-chaap machine ki RAM khatam
 * karne se behtar hai batana.
 */

/** Isse lambi clip reverse nahi hoti — `reverse` filter poori clip RAM me rakhta hai. */
export const MAX_REVERSE_SECONDS = 30;

export interface ReverseOptions {
  /** Bina audio wali file par apne aap skip ho jaata hai. */
  includeAudio?: boolean;
  /** CRF — Section 3A ka wahi bar (18 ya usse behtar). */
  crf?: number;
  onProgress?: (fraction: number) => void;
}

export interface ReverseResult {
  durationSeconds: number;
  hasAudio: boolean;
}

export async function reverseMedia(
  input: string,
  output: string,
  options: ReverseOptions = {},
): Promise<ReverseResult> {
  const info = await probe(input);
  const duration = Number(info.format.duration ?? 0);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`${input} ki lambai nahi pata chali — reverse nahi ho sakta`);
  }
  if (duration > MAX_REVERSE_SECONDS) {
    throw new Error(
      `Clip ${duration.toFixed(1)}s lambi hai. Reverse ${MAX_REVERSE_SECONDS}s tak hi hota hai ` +
        `(reverse poori clip ko memory me rakhta hai). Pehle chhota tukda kaato.`,
    );
  }

  const hasVideo = videoStream(info) !== undefined;
  if (!hasVideo) throw new Error(`${input} me video stream nahi hai`);

  const hasAudio = info.streams.some((stream: { codec_type?: string }) => stream.codec_type === "audio");
  const wantAudio = hasAudio && options.includeAudio !== false;

  /*
   * `-an` ya `areverse` — beech ka koi raasta nahi. Audio ko waise ka waisa
   * chhod dena sabse buri galti hoti: video ulta chalta aur awaaz seedhi, aur
   * dekhne wale ko bas "kuch gadbad hai" lagta hai bina wajah samjhe.
   */
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-vf",
    "reverse",
    ...(wantAudio ? ["-af", "areverse"] : ["-an"]),
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    String(options.crf ?? 18),
    ...(wantAudio ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : []),
    output,
  ];

  await run(ffmpegPath(), args);
  options.onProgress?.(1);

  return { durationSeconds: duration, hasAudio: wantAudio };
}
