import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { ffmpegPath, run } from "./ffmpeg";
import { measureEbur128 } from "./loudness";

/**
 * Voice: TTS + cleanup (22.4 / 22.6 / 22.7 / 22.8).
 *
 * ⚠️ **Ek hi resample** (22.6). edge-tts 24kHz deta hai aur humein 48kHz chahiye.
 * Beech me kisi bhi kadam par sample rate badalna do baar resample ban jaata hai,
 * aur har resample thodi si tez frequency kha jaata hai — do baar ke baad "s"
 * aur "sh" ki awaaz halki bhajti hai. Isliye rate sirf aakhri encode me badalta
 * hai, aur `soxr` se (FFmpeg ka sabse achha resampler; default `swr` se saaf
 * behtar).
 *
 * ⚠️ Beech ki har file **WAV/PCM** hai, mp3 nahi. Lossy se lossy chain me har
 * kadam thodi si quality khaata hai, aur voice par wo sabse jaldi sunai deta hai.
 */

/** Section 3A: final audio hamesha 48kHz. */
export const VOICE_TARGET_RATE = 48000;

export interface TtsVoice {
  id: string;
  label: string;
  language: string;
  gender: string;
}

/**
 * Hindi/Hinglish ke liye kaam ki voices.
 *
 * ⚠️ Ye ek **fallback** list hai. Asli list `listVoices()` edge-tts se laati hai
 * (`edge-tts --list-voices`), aur wahi chalti hai jab wo maujood ho. Yahan wali
 * sirf tab dikhti hai jab edge-tts install na ho — taaki UI khaali dropdown na
 * dikhaye aur user ko pata chale ki kya milne wala hai.
 */
export const FALLBACK_VOICES: readonly TtsVoice[] = [
  { id: "hi-IN-MadhurNeural", label: "Madhur (Hindi, purush)", language: "hi-IN", gender: "Male" },
  { id: "hi-IN-SwaraNeural", label: "Swara (Hindi, mahila)", language: "hi-IN", gender: "Female" },
  { id: "en-IN-PrabhatNeural", label: "Prabhat (English-India, purush)", language: "en-IN", gender: "Male" },
  { id: "en-IN-NeerjaNeural", label: "Neerja (English-India, mahila)", language: "en-IN", gender: "Female" },
];

export class TtsNotAvailable extends Error {
  constructor(detail: string) {
    super(
      `edge-tts nahi mila — voice generate nahi ho sakti.\n` +
        `Install karo:  pip install edge-tts\n` +
        `Phir jaancho:  python -m edge_tts --list-voices\n\n` +
        `(${detail})`,
    );
    this.name = "TtsNotAvailable";
  }
}

/** Python ka raasta — `REEL_PYTHON_PATH` se badla ja sakta hai. */
function pythonPath(): string {
  return process.env.REEL_PYTHON_PATH ?? "python";
}

/**
 * edge-tts hai ya nahi.
 *
 * ⚠️ Ye **poochha** jaata hai, maan nahi liya jaata. Bina jaanche button dikhane
 * par user dabata hai, kuch nahi hota, aur wo sochta hai app toota hua hai —
 * jabki sirf ek `pip install` baaki tha. UI is jawab se hi tay karti hai ki
 * Generate wala tab dikhana hai ya nahi.
 */
export async function ttsAvailable(): Promise<{ ok: boolean; detail: string }> {
  try {
    const result = await run(pythonPath(), ["-m", "edge_tts", "--help"]);
    const text = `${result.stdout}${result.stderr}`;
    if (/usage|edge-tts/i.test(text)) return { ok: true, detail: "python -m edge_tts" };
    return { ok: false, detail: "edge_tts module chala par jawab pehchana nahi gaya" };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/** Voices ki asli list — na mile to fallback. */
export async function listVoices(): Promise<{ voices: TtsVoice[]; live: boolean }> {
  try {
    const { stdout } = await run(pythonPath(), ["-m", "edge_tts", "--list-voices"]);

    /*
     * Output ek table hai, JSON nahi. Har line: `Name  Gender  ...`. Sirf wahi
     * voices rakhte hain jo Hindi ya Indian-English ki hon — poori list 300+ ki
     * hai aur usme se chunna user ke liye sazaa ban jaata hai.
     */
    const voices: TtsVoice[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      const match = /^([a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural)\s+(Male|Female)/.exec(line.trim());
      if (!match) continue;
      const id = match[1] as string;
      if (!id.startsWith("hi-IN") && !id.startsWith("en-IN")) continue;
      voices.push({
        id,
        label: id.split("-")[2]?.replace("Neural", "") ?? id,
        language: id.slice(0, 5),
        gender: match[2] as string,
      });
    }

    if (voices.length === 0) return { voices: [...FALLBACK_VOICES], live: false };
    return { voices, live: true };
  } catch {
    return { voices: [...FALLBACK_VOICES], live: false };
  }
}

export interface GenerateSpeechOptions {
  text: string;
  voiceId: string;
  /** 1 = normal. edge-tts ise percent me leta hai. */
  rate?: number;
  /** Semitones. */
  pitch?: number;
  outPath: string;
  /** Beech ki files kahan banein. */
  scratchDir: string;
}

export interface GenerateSpeechResult {
  outPath: string;
  /** Kitni lambi awaaz bani — scene ki lambai isse set hoti hai (22.11). */
  durationSeconds: number;
}

/**
 * Text se awaaz (22.4).
 *
 * Do kadam: edge-tts se mp3, phir ek hi baar 48kHz WAV me. edge-tts seedha WAV
 * nahi deta — ye uski hadd hai. Par uske baad hum lossy me wapas nahi jaate.
 */
export async function generateSpeech(
  options: GenerateSpeechOptions,
): Promise<GenerateSpeechResult> {
  const check = await ttsAvailable();
  if (!check.ok) throw new TtsNotAvailable(check.detail);

  const text = options.text.trim();
  if (!text) throw new Error("Bolne ke liye kuch to likho — khaali text par awaaz nahi banti.");

  const raw = resolve(options.scratchDir, `tts-${Date.now()}.mp3`);

  /*
   * edge-tts rate/pitch ko `+10%` / `-2Hz` jaisi likhawat me leta hai. Number ko
   * seedha bhejne par wo chup-chaap default par chala jaata hai — aur user ko
   * lagta hai slider kaam nahi kar raha.
   */
  const ratePercent = Math.round(((options.rate ?? 1) - 1) * 100);
  const pitchHz = Math.round((options.pitch ?? 0) * 10);

  await run(pythonPath(), [
    "-m",
    "edge_tts",
    "--voice",
    options.voiceId,
    "--text",
    text,
    "--rate",
    `${ratePercent >= 0 ? "+" : ""}${ratePercent}%`,
    "--pitch",
    `${pitchHz >= 0 ? "+" : ""}${pitchHz}Hz`,
    "--write-media",
    raw,
  ]);

  if (!existsSync(raw)) throw new Error("edge-tts chala par koi file nahi bani.");

  /*
   * ⚠️ Yahi **ekmatra** resample hai (22.6). `soxr` se, aur seedha 48kHz par.
   * Mono ko stereo banate hain `pan` se, `-ac 2` se nahi: `-ac 2` dono channel
   * me wahi signal daal deta hai jo theek hai, par `pan` se ye saaf likha hota
   * hai ki hum jaan-boojhkar dono taraf ek hi awaaz rakh rahe hain.
   */
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", raw,
    "-af", "pan=stereo|c0=c0|c1=c0",
    "-ar", String(VOICE_TARGET_RATE),
    "-resampler", "soxr",
    "-c:a", "pcm_s16le",
    options.outPath,
  ]);

  await rm(raw, { force: true });

  // `-f null -` — bina output ke ffmpeg exit 1 deta hai, chahe file bilkul theek ho.
  const { stderr } = await run(ffmpegPath(), [
    "-hide_banner",
    "-i",
    options.outPath,
    "-f",
    "null",
    "-",
  ]);
  const match = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
  const durationSeconds = match
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : 0;

  return { outPath: options.outPath, durationSeconds };
}

export interface CleanupResult {
  outPath: string;
  before: { integratedLufs: number | null; truePeakDb: number | null };
  after: { integratedLufs: number | null; truePeakDb: number | null };
  /** Jo filter chain sach me chali — doc me likhne ke liye. */
  filters: string;
}

/**
 * Cleanup chalao aur **pehle/baad dono naapo** (22.7 / 22.8).
 *
 * ⚠️ Naap dono taraf li jaati hai, aur ye is function ki sabse zaroori baat hai.
 * "Cleanup ho gaya" ek daawa hai; `-24.1 LUFS se -16.0 LUFS` ek **saboot** hai.
 * Chup-chaap process karna mana hai (22.8) — user ko farak dikhna chahiye,
 * warna wo har baar sochta rehta hai ki kuch hua bhi ya nahi.
 */
export async function cleanupVoice(args: {
  input: string;
  outPath: string;
  /** `@reel/core` ke `cleanupFilterString()` se. `null` = kuch nahi karna. */
  filters: string | null;
}): Promise<CleanupResult> {
  const before = await measureEbur128(args.input);

  if (!args.filters) {
    /*
     * Koi kadam chalu na ho to bhi file **copy** hoti hai — kyunki caller ko ek
     * output path chahiye hi hota hai. Use skip kar dene par har caller ko
     * "kabhi input, kabhi output" wala hisaab rakhna padta.
     */
    await run(ffmpegPath(), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", args.input,
      "-c:a", "copy",
      args.outPath,
    ]);
    return {
      outPath: args.outPath,
      before: { integratedLufs: before.integratedLufs, truePeakDb: before.truePeakDb },
      after: { integratedLufs: before.integratedLufs, truePeakDb: before.truePeakDb },
      filters: "",
    };
  }

  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", args.input,
    "-af", args.filters,
    // Beech me hamesha PCM — lossy se lossy chain voice par sabse jaldi sunai
    // deti hai (22.6).
    "-c:a", "pcm_s16le",
    "-ar", String(VOICE_TARGET_RATE),
    args.outPath,
  ]);

  const after = await measureEbur128(args.outPath);
  return {
    outPath: args.outPath,
    before: { integratedLufs: before.integratedLufs, truePeakDb: before.truePeakDb },
    after: { integratedLufs: after.integratedLufs, truePeakDb: after.truePeakDb },
    filters: args.filters,
  };
}
