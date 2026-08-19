import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

/**
 * FFmpeg / ffprobe ke saath baat karne ki ekmatra jagah.
 *
 * ⚠️ Section 3A ka sabse zaroori rule yahan bandha gaya hai: **single encode**.
 * Remotion se seedha final H.264 nikalta hai; FFmpeg ka kaam sirf remux
 * (`-c copy`), faststart, probe aur thumbnail hai. Video ko dobara encode karna
 * matlab quality ka nuksaan bina kisi faayde ke — aur wo nuksaan ffprobe me
 * dikhta bhi nahi, sirf aankh se pata chalta hai jab tak bahut der na ho jaaye.
 *
 * Windows par FFmpeg PATH me na ho (winget ne PATH badla par purana terminal
 * chal raha ho) — isliye `REEL_FFMPEG_PATH` / `REEL_FFPROBE_PATH` se override
 * kiya ja sakta hai.
 */

export function ffmpegPath(): string {
  return process.env.REEL_FFMPEG_PATH?.trim() || "ffmpeg";
}

export function ffprobePath(): string {
  return process.env.REEL_FFPROBE_PATH?.trim() || "ffprobe";
}

export class FfmpegError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    super(
      `${command} exit ${exitCode} ke saath mara.\n` +
        // Aakhri lines me asli wajah hoti hai; poora stderr bahut lamba hota hai.
        stderr.split("\n").slice(-12).join("\n"),
    );
    this.name = "FfmpegError";
  }
}

export interface RunResult {
  stdout: string;
  stderr: string;
}

/** Ek binary chalao aur poora output lauta do. */
export function run(command: string, args: readonly string[]): Promise<RunResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { windowsHide: true });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      // ENOENT ka matlab hamesha ek hi hota hai, aur Windows par ye sabse aam
      // galti hai — isliye seedha wahi bata dete hain, raw error nahi.
      rejectPromise(
        new Error(
          `"${command}" chala hi nahi (${error.message}). ` +
            `FFmpeg install hai? Naya terminal khola tha? Ya REEL_FFMPEG_PATH set karo.`,
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else rejectPromise(new FfmpegError(command, code, stderr));
    });
  });
}

// -------------------------------------------------------------------- probe

export interface ProbeSideData {
  side_data_type?: string;
  /** `displaymatrix` ke saath aata hai — phone ke portrait video ka poora khel. */
  rotation?: number;
}

export interface ProbeStream {
  index: number;
  codec_type: "video" | "audio" | string;
  codec_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  bit_rate?: string;
  nb_frames?: string;
  side_data_list?: ProbeSideData[];
  /** Purane files me rotation yahan (`tags.rotate`) hota hai. */
  tags?: Record<string, string>;
}

export interface ProbeFormat {
  format_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
}

export interface ProbeResult {
  streams: ProbeStream[];
  format: ProbeFormat;
}

/** `ffprobe -show_streams -show_format` ka JSON. */
export async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await run(ffprobePath(), [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    // Rotation `side_data_list` me aata hai (ffmpeg 7+ ne `tags.rotate` dena
    // band kar diya) — bina iske phone ka portrait video landscape samajh
    // liya jaata hai.
    "-show_entries",
    "stream_side_data=rotation",
    file,
  ]);
  return JSON.parse(stdout) as ProbeResult;
}

export function videoStream(result: ProbeResult): ProbeStream | undefined {
  return result.streams.find((stream) => stream.codec_type === "video");
}

export function audioStream(result: ProbeResult): ProbeStream | undefined {
  return result.streams.find((stream) => stream.codec_type === "audio");
}

/** `"30/1"` -> `30`. ffprobe fps hamesha fraction me deta hai. */
export function parseFrameRate(rate: string | undefined): number | null {
  if (!rate) return null;
  const [num, den] = rate.split("/").map(Number);
  if (!num || !den) return null;
  return num / den;
}

// ---------------------------------------------------------------- faststart

/**
 * `+faststart` — moov atom ko file ke shuru me le aao.
 *
 * Iske bina player poori file utaare bina video shuru nahi kar paata. Phone par
 * Instagram/WhatsApp me isi ka matlab hota hai "video 3 second baad chalu hoga"
 * banaam "turant chalu".
 *
 * **`-c copy` hai — koi re-encode nahi.** Sirf container dobara likha jaata hai,
 * pixels waise ke waise. Section 3A ka single-encode rule isi tarah bachta hai.
 */
export async function remuxFaststart(input: string, output: string): Promise<void> {
  await run(ffmpegPath(), [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-c",
    "copy",
    "-map",
    "0",
    "-movflags",
    "+faststart",
    output,
  ]);
}

// ---------------------------------------------------------------- thumbnail

/** Video se ek frame nikalo (poster / timeline preview ke liye). */
export async function extractFrame(
  input: string,
  output: string,
  atSeconds: number,
): Promise<void> {
  await run(ffmpegPath(), [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    // `-ss` input se pehle = tez seek. Frame-exact nahi hota, par thumbnail ke
    // liye ye farak matlab nahi rakhta.
    "-ss",
    String(Math.max(0, atSeconds)),
    "-i",
    input,
    "-frames:v",
    "1",
    // Scaling hamesha lanczos — Section 3A. (Yahan resize nahi ho raha, par
    // flag rehne se baad me koi chupke se bilinear par nahi girta.)
    "-sws_flags",
    "lanczos",
    "-q:v",
    "3",
    output,
  ]);
}

export async function fileSize(path: string): Promise<number> {
  return (await stat(path)).size;
}

/** FFmpeg + ffprobe dono maujood hain? Worker shuru me yahi poochhta hai. */
export async function checkFfmpegAvailable(): Promise<{ ffmpeg: string; ffprobe: string }> {
  const [ffmpegOut, ffprobeOut] = await Promise.all([
    run(ffmpegPath(), ["-version"]),
    run(ffprobePath(), ["-version"]),
  ]);
  return {
    ffmpeg: ffmpegOut.stdout.split("\n")[0] ?? "",
    ffprobe: ffprobeOut.stdout.split("\n")[0] ?? "",
  };
}
