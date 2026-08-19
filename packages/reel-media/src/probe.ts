import {
  audioStream,
  parseFrameRate,
  probe,
  videoStream,
  type ProbeResult,
  type ProbeStream,
} from "./ffmpeg";

/**
 * ffprobe ka nateeja -> `reel_assets` ki row.
 *
 * ⚠️ Ye numbers **asli** hone chahiye, andaaza nahi (Phase 5 checklist 5.4 aur
 * Section 3A). Browser bhi upload se pehle width/height/duration nikalta hai aur
 * wo turant milta hai — par wo bharosemand nahi hai: rotation metadata browser
 * apne aap laga deta hai, duration `Infinity` aa sakti hai (webm), aur fps to
 * wahan sirf ginn kar andaaza lagta hai. Isliye upload ke baad ffprobe hi
 * aakhri sach hai, aur wahi DB me likha jaata hai.
 */

export interface AssetProbeResult {
  /** Jaise **dikhta** hai — rotation lagne ke baad. */
  width: number | null;
  height: number | null;
  durationMs: number | null;
  fps: number | null;
  sampleRate: number | null;
  channels: number | null;
  /** Baaki sab kuch — `reel_assets.meta` (jsonb) me jaata hai. */
  meta: AssetProbeMeta;
}

export interface AssetProbeMeta {
  container: string | null;
  videoCodec: string | null;
  videoProfile: string | null;
  pixelFormat: string | null;
  videoBitRate: number | null;
  audioCodec: string | null;
  audioBitRate: number | null;
  audioProfile: string | null;
  totalBitRate: number | null;
  /** Degrees (0 / 90 / 180 / 270). Phone ke video me sabse zyada milta hai. */
  rotation: number;
  /** Rotation lagne se pehle wale pixels — debug ke liye. */
  storedWidth: number | null;
  storedHeight: number | null;
  probedAt: string;
}

function toNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Rotation nikalo.
 *
 * Do jagah ho sakta hai aur dono chalte hain: purane files me `tags.rotate`,
 * naye me `side_data_list` ka `displaymatrix`. ffmpeg 7+ purana tag dena band
 * kar chuka hai, isliye dono dekhna zaroori hai — warna phone ka portrait video
 * landscape samajh liya jaata hai aur poori reel me galat crop lagta hai.
 *
 * ⚠️ Ginti ki **disha** (clockwise ya counter) alag-alag jagah alag likhi milti
 * hai, isliye us par koi faisla nahi liya jaata. Humein sirf itna chahiye ki
 * 90/270 par chaudai-oonchai palat jaati hai — aur wo disha se nahi badalta.
 * Value waisi ki waisi meta me chali jaati hai (0-359 me laakar).
 */
export function rotationOf(stream: ProbeStream | undefined): number {
  if (!stream) return 0;

  const fromTag = toNumber(stream.tags?.rotate);
  if (fromTag !== null) return normalizeRotation(fromTag);

  for (const side of stream.side_data_list ?? []) {
    const value = toNumber(side.rotation);
    if (value !== null) return normalizeRotation(value);
  }
  return 0;
}

function normalizeRotation(degrees: number): number {
  const rounded = Math.round(degrees / 90) * 90;
  return ((rounded % 360) + 360) % 360;
}

export function fromProbeResult(result: ProbeResult): AssetProbeResult {
  const video = videoStream(result);
  const audio = audioStream(result);
  const rotation = rotationOf(video);

  const storedWidth = toNumber(video?.width);
  const storedHeight = toNumber(video?.height);
  // 90/270 par dikhne wali chaudai-oonchai palat jaati hai.
  const swap = rotation === 90 || rotation === 270;
  const width = swap ? storedHeight : storedWidth;
  const height = swap ? storedWidth : storedHeight;

  const durationSeconds = toNumber(result.format.duration);

  return {
    width,
    height,
    durationMs: durationSeconds === null ? null : Math.round(durationSeconds * 1000),
    fps: video ? parseFrameRate(video.r_frame_rate) : null,
    sampleRate: toNumber(audio?.sample_rate),
    channels: toNumber(audio?.channels),
    meta: {
      container: result.format.format_name ?? null,
      videoCodec: video?.codec_name ?? null,
      videoProfile: video?.profile ?? null,
      pixelFormat: video?.pix_fmt ?? null,
      videoBitRate: toNumber(video?.bit_rate),
      audioCodec: audio?.codec_name ?? null,
      audioBitRate: toNumber(audio?.bit_rate),
      audioProfile: audio?.profile ?? null,
      totalBitRate: toNumber(result.format.bit_rate),
      rotation,
      storedWidth,
      storedHeight,
      probedAt: new Date().toISOString(),
    },
  };
}

/** File par ffprobe chalao aur seedha DB me likhne layak shape lauta do. */
export async function probeAsset(file: string): Promise<AssetProbeResult> {
  return fromProbeResult(await probe(file));
}
