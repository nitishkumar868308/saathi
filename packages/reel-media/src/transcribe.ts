import { resolve } from "node:path";
import { rm, writeFile } from "node:fs/promises";

import { ffmpegPath, run } from "./ffmpeg";

/**
 * Transcribe — awaaz se shabd, **local aur free** (23.1 / 23.2 / 23.3).
 *
 * ⚠️ Koi cloud API nahi. `faster-whisper` (Python) is machine par chalta hai,
 * bina GPU ke bhi. Cloud transcription har minute ke paise leti hai aur audio
 * kisi aur ke server par bhejti hai — dono is project ke rules ke khilaf hain
 * (README: zero paid services, sab local).
 *
 * ⚠️ Ye module **maanta nahi**, **poochhta** hai (`whisperAvailable()`). Install
 * na ho to UI me saaf "setup chahiye" likha jaata hai — koi aisa button nahi
 * jo dabane par kuch na kare.
 */

export interface WhisperWord {
  text: string;
  startSeconds: number;
  endSeconds: number;
  confidence: number | null;
}

export interface WhisperResult {
  words: WhisperWord[];
  language: string | null;
  durationSeconds: number;
  /** Kitna waqt laga — 23.2 ka measurement isi se aata hai. */
  elapsedMs: number;
  model: string;
}

/**
 * Model ka size (23.2).
 *
 * ⚠️ Default `small` hai. `medium` Hindi par saaf behtar hai par CPU par teen
 * guna waqt leta hai, aur 30 second ki reel ke liye do minute ka intezaar
 * feature ko bekaar bana deta hai. Ye ek **option** hai — jise sabse achha
 * chahiye wo `medium` chun le.
 */
export const WHISPER_MODELS = ["tiny", "base", "small", "medium"] as const;
export type WhisperModel = (typeof WHISPER_MODELS)[number];
export const DEFAULT_WHISPER_MODEL: WhisperModel = "small";

export class WhisperNotAvailable extends Error {
  constructor(detail: string) {
    super(
      `faster-whisper nahi mila — auto captions abhi nahi ban sakti.\n` +
        `Install karo:  pip install faster-whisper\n` +
        `Jaancho:       python -c "import faster_whisper; print(faster_whisper.__version__)"\n\n` +
        `(${detail})`,
    );
    this.name = "WhisperNotAvailable";
  }
}

function pythonPath(): string {
  return process.env.REEL_PYTHON_PATH ?? "python";
}

/** faster-whisper hai ya nahi — poochh kar, maan kar nahi (23.3). */
export async function whisperAvailable(): Promise<{ ok: boolean; detail: string }> {
  try {
    const { stdout } = await run(pythonPath(), [
      "-c",
      "import faster_whisper, sys; sys.stdout.write(faster_whisper.__version__)",
    ]);
    const version = stdout.trim();
    if (version) return { ok: true, detail: `faster-whisper ${version}` };
    return { ok: false, detail: "module mila par version nahi bataya" };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/*
 * Python ka chhota program — JSON stdout par.
 *
 * ⚠️ File me likh kar chalate hain, `-c` se nahi: Windows par lambi command
 * line me quotes ka hisaab bigadta hai aur galti "syntax error" ban kar aati
 * hai, jiska asli wajah se koi rishta nahi dikhta.
 *
 * ⚠️ `word_timestamps=True` hi is poore phase ki jaan hai (23.6) — iske bina
 * sirf cue milte hain aur karaoke/highlight styles andaaze par chalte hain.
 */
export const WHISPER_SCRIPT = `
import json, sys
from faster_whisper import WhisperModel

# Windows par stdout default cp1252 hota hai aur usme Devanagari likha hi nahi
# ja sakta. Bina is line ke Hindi transcription hamesha phatti hai — aur sabse
# gumrah karne wale tarike se: whisper poora chal chuka hota hai, shabd nikal
# chuke hote hain, aur wo sirf unhe *likhte waqt* marti hai.
sys.stdout.reconfigure(encoding="utf-8")

audio, model_name, language = sys.argv[1], sys.argv[2], sys.argv[3]

# int8 = CPU par sabse tez, aur Hindi par farak kaan se pakda nahi jaata.
model = WhisperModel(model_name, device="cpu", compute_type="int8")

segments, info = model.transcribe(
    audio,
    language=None if language == "auto" else language,
    word_timestamps=True,
    vad_filter=True,
)

words = []
for segment in segments:
    for word in (segment.words or []):
        words.append({
            "text": word.word.strip(),
            "start": float(word.start),
            "end": float(word.end),
            "probability": float(word.probability) if word.probability is not None else None,
        })

json.dump({
    "words": words,
    "language": info.language,
    "duration": float(info.duration),
}, sys.stdout, ensure_ascii=False)
`;

export interface TranscribeOptions {
  audioPath: string;
  /** `auto` = whisper khud pehchane (23.4). */
  language?: string;
  model?: WhisperModel;
  /** Python script kahan likhi jaaye. */
  scratchDir: string;
}

/** Awaaz → shabd, per-word timing ke saath (23.1). */
export async function transcribe(options: TranscribeOptions): Promise<WhisperResult> {
  const check = await whisperAvailable();
  if (!check.ok) throw new WhisperNotAvailable(check.detail);

  const model = options.model ?? DEFAULT_WHISPER_MODEL;
  const scriptPath = resolve(options.scratchDir, "whisper-run.py");
  await writeFile(scriptPath, WHISPER_SCRIPT, "utf8");

  const startedAt = Date.now();
  try {
    const { stdout } = await run(pythonPath(), [
      scriptPath,
      options.audioPath,
      model,
      options.language ?? "auto",
    ]);

    const parsed = JSON.parse(stdout) as {
      words: { text: string; start: number; end: number; probability: number | null }[];
      language: string | null;
      duration: number;
    };

    return {
      words: parsed.words.map((word) => ({
        text: word.text,
        startSeconds: word.start,
        endSeconds: word.end,
        confidence: word.probability,
      })),
      language: parsed.language,
      durationSeconds: parsed.duration,
      elapsedMs: Date.now() - startedAt,
      model,
    };
  } finally {
    await rm(scriptPath, { force: true }).catch(() => {});
  }
}

/* ------------------------------------------------------- speech segments */

export interface SpeechSegment {
  startSeconds: number;
  endSeconds: number;
}

/**
 * Awaaz me bolne wale hisse — chuppi ke beech ke tukde.
 *
 * ⚠️ Ye alignment (23.5) ke liye hai, transcribe ke liye nahi. TTS ka text
 * pehle se pata hota hai; sirf ye pata karna hota hai ki bolna **kab** ho raha
 * hai. Bina iske shabd chuppi me bhi baant diye jaate hain aur shuruaati
 * khaamoshi ke baad ke saare shabd aage khisak jaate hain.
 *
 * ffmpeg ka `silencedetect` — koi model nahi, koi download nahi, milliseconds
 * me chal jaata hai.
 */
export async function detectSpeechSegments(
  audioPath: string,
  options: { noiseDb?: number; minSilenceSeconds?: number } = {},
): Promise<{ segments: SpeechSegment[]; durationSeconds: number }> {
  const noise = options.noiseDb ?? -35;
  const minSilence = options.minSilenceSeconds ?? 0.25;

  // `-f null -` — bina output ke ffmpeg exit 1 deta hai, chahe file theek ho.
  const { stderr } = await run(ffmpegPath(), [
    "-hide_banner",
    "-i",
    audioPath,
    "-af",
    `silencedetect=noise=${noise}dB:d=${minSilence}`,
    "-f",
    "null",
    "-",
  ]);

  const durationMatch = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
  const durationSeconds = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : 0;

  /*
   * silencedetect chuppi batata hai, bolna nahi. Bolne wale hisse ulta kar ke
   * nikalte hain: file ki shuruaat se pehli chuppi tak, phir har do chuppiyon
   * ke beech, phir aakhri chuppi se ant tak.
   */
  const silences: SpeechSegment[] = [];
  let pendingStart: number | null = null;

  for (const line of stderr.split(/\r?\n/)) {
    const start = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (start) {
      pendingStart = Math.max(0, Number(start[1]));
      continue;
    }
    const end = /silence_end:\s*([\d.]+)/.exec(line);
    if (end && pendingStart !== null) {
      silences.push({ startSeconds: pendingStart, endSeconds: Number(end[1]) });
      pendingStart = null;
    }
  }
  if (pendingStart !== null) {
    silences.push({ startSeconds: pendingStart, endSeconds: durationSeconds });
  }

  const segments: SpeechSegment[] = [];
  let at = 0;
  for (const silence of silences) {
    if (silence.startSeconds - at > 0.01) {
      segments.push({ startSeconds: at, endSeconds: silence.startSeconds });
    }
    at = Math.max(at, silence.endSeconds);
  }
  if (durationSeconds - at > 0.01) {
    segments.push({ startSeconds: at, endSeconds: durationSeconds });
  }

  /*
   * Poori file chup ho to khaali list lautana galat hoga — caller ke paas phir
   * koi raasta nahi bachta. Poori lambai ek segment maan lete hain; alignment
   * tab bhi seedhi baant ki tarah chalti hai (yaani pehle se bura nahi hota).
   */
  if (segments.length === 0 && durationSeconds > 0) {
    return { segments: [{ startSeconds: 0, endSeconds: durationSeconds }], durationSeconds };
  }

  return { segments, durationSeconds };
}
