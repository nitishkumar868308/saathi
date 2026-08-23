import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { checkFfmpegAvailable, run } from "../ffmpeg";

/**
 * TTS ke adapters (22.4 / 22.x).
 *
 * ⚠️ Pehle `voice.ts` **seedha edge-tts par jama** tha: error ke message me
 * uska naam, fallback list me uski voice ids, aur generate karne wala code usi
 * ke command-line flags ke hisaab se. Doosra provider jodne ka matlab hota us
 * poori file ko todna.
 *
 * Ab har provider sirf ek kaam karta hai: **kacchi awaaz ki file banao.** 48kHz
 * stereo WAV me badalna, lambai naapna, cleanup — wo sab `voice.ts` me ek hi
 * jagah hai aur har provider par ek jaisa lagta hai. Isse do faayde hain: naya
 * provider chhota rehta hai, aur "final audio hamesha 48kHz" wala niyam kisi ek
 * provider ke bhool jaane par toot nahi sakta.
 */

/** Adapter ne jo kaccha maal banaya. */
export interface RawSpeech {
  path: string;
  /**
   * Agar file me header hai hi nahi (kaccha PCM), to uska naap yahan aata hai.
   *
   * ⚠️ Gemini raw PCM lautata hai — usme sample rate likha hua nahi hota, wo
   * sirf response ke mime string me hota hai. ffmpeg ko wo number batana padta
   * hai; na batao to wo apna default maan leta hai aur awaaz **galat raftaar**
   * par bajti hai. Bajti hai — isliye ye galti aankh se kabhi nahi dikhti, sirf
   * kaan se pakdi jaati hai.
   */
  pcm?: { sampleRate: number; channels: number };
}

export interface SynthesizeArgs {
  voiceId: string;
  text: string;
  rate: number;
  pitch: number;
  scratchDir: string;
  /** Category ka andaaz — Gemini jaison ko shabdon me batana padta hai. */
  stylePrompt?: string;
}

export interface TtsAdapter {
  id: string;
  /** Chalne layak hai? **Poochha** jaata hai, maan nahi liya jaata. */
  available(): Promise<{ ok: boolean; detail: string }>;
  synthesize(args: SynthesizeArgs): Promise<RawSpeech>;
}

/* ------------------------------------------------------------------ PCM mime */

/**
 * `audio/L16;codec=pcm;rate=24000` → `{ sampleRate: 24000, channels: 1 }`.
 *
 * L16 ka matlab hi 16-bit linear PCM hai, aur Gemini abhi mono deta hai —
 * par channels ko yahin ek jagah rakha hai taaki kal wo badle to sirf yahi
 * function badle.
 */
export function parsePcmMime(mime: string): { sampleRate: number; channels: number } | null {
  if (!/audio\/l16/i.test(mime)) return null;
  const rate = /rate=(\d+)/i.exec(mime);
  if (!rate) return null;
  const channels = /channels=(\d+)/i.exec(mime);
  return {
    sampleRate: Number(rate[1]),
    channels: channels ? Number(channels[1]) : 1,
  };
}

/** Wahi, par na milne par **andaaza nahi lagata** — saaf error deta hai. */
export function requirePcmMime(mime: string): { sampleRate: number; channels: number } {
  const parsed = parsePcmMime(mime);
  if (!parsed) {
    throw new Error(
      `Audio ka mime samajh nahi aaya: "${mime}". ` +
        `Isme rate hona chahiye (jaise audio/L16;codec=pcm;rate=24000). ` +
        `Rate ka andaaza lagana galat hoga — awaaz galat raftaar par bajegi.`,
    );
  }
  return parsed;
}

/* --------------------------------------------------------------- edge-tts */

function pythonPath(): string {
  return process.env.REEL_PYTHON_PATH ?? "python";
}

export const edgeTtsAdapter: TtsAdapter = {
  id: "edge",

  async available() {
    try {
      const result = await run(pythonPath(), ["-m", "edge_tts", "--help"]);
      const text = `${result.stdout}${result.stderr}`;
      if (/usage|edge-tts/i.test(text)) return { ok: true, detail: "python -m edge_tts" };
      return { ok: false, detail: "edge_tts module chala par jawab pehchana nahi gaya" };
    } catch (error) {
      return {
        ok: false,
        detail:
          `edge-tts nahi mila. Install karo:  pip install edge-tts\n` +
          `Phir jaancho:  python -m edge_tts --list-voices\n` +
          `(${error instanceof Error ? error.message : String(error)})`,
      };
    }
  },

  async synthesize(args) {
    const raw = resolve(args.scratchDir, `tts-edge-${Date.now()}.mp3`);

    /*
     * edge-tts rate/pitch ko `+10%` / `-2Hz` jaisi likhawat me leta hai. Number
     * seedha bhejne par wo chup-chaap default par chala jaata hai — aur user ko
     * lagta hai slider kaam hi nahi kar raha.
     */
    const ratePercent = Math.round((args.rate - 1) * 100);
    const pitchHz = Math.round(args.pitch * 10);

    await run(pythonPath(), [
      "-m", "edge_tts",
      "--voice", args.voiceId,
      "--text", args.text,
      "--rate", `${ratePercent >= 0 ? "+" : ""}${ratePercent}%`,
      "--pitch", `${pitchHz >= 0 ? "+" : ""}${pitchHz}Hz`,
      "--write-media", raw,
    ]);

    if (!existsSync(raw)) throw new Error("edge-tts chala par koi file nahi bani.");
    return { path: raw };
  },
};

/* ----------------------------------------------------------------- Gemini */

const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  inlineData?: { mimeType?: string; data?: string };
}

export const geminiTtsAdapter: TtsAdapter = {
  id: "gemini",

  async available() {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      return {
        ok: false,
        detail:
          "GEMINI_API_KEY set nahi hai — Gemini se awaaz nahi ban sakti.\n" +
          "studio/.env.local me GEMINI_API_KEY=... daalo aur dev server dobara chalao.",
      };
    }
    /*
     * WARNING: Yahan pehle ffmpeg ki bhi jaanch lagayi gayi thi, aur wo galat
     * ilaaj tha. Asli masla ye tha ki PCM se WAV banane ke liye ffmpeg maanga ja
     * raha tha - jabki us kaam ko 44 byte ka header likh kar poora kiya ja sakta
     * hai (`tts/wav.ts`). Wo ho jaane ke baad Gemini ki awaaz ko ffmpeg ki
     * zaroorat hai hi nahi, aur ye ab Vercel par bhi chalti hai.
     */
    return { ok: true, detail: `gemini (${GEMINI_TTS_MODEL})` };
  },

  async synthesize(args) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GEMINI_API_KEY set nahi hai");

    /*
     * Gemini me rate/pitch ka koi parameter hai hi nahi — andaaz **shabdon me**
     * batana padta hai. Isliye style ka nirdesh text ke aage lagta hai.
     *
     * ⚠️ Ye ek asli hadd hai aur ise chhupana nahi chahiye: slider se rate 1.5
     * karne par Gemini ki awaaz theek 1.5x tez **nahi** hogi, wo bas "tez bolo"
     * samajhta hai. Jise sach me exact raftaar chahiye wo baad me speed change
     * (Phase 15) se karega, jo naapa hua hai.
     */
    const speed =
      args.rate > 1.15 ? " Thoda tez bolo." : args.rate < 0.85 ? " Thoda dheeme bolo." : "";
    const style = args.stylePrompt ? `${args.stylePrompt}${speed}\n\n` : speed ? `${speed.trim()}\n\n` : "";

    const response = await fetch(
      `${GEMINI_BASE}/${GEMINI_TTS_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${style}${args.text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: args.voiceId } },
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Gemini TTS ne mana kiya — HTTP ${response.status}. ${body.slice(0, 400)}`,
      );
    }

    const json = (await response.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const data = part?.inlineData?.data;
    if (!data) {
      throw new Error(
        "Gemini se jawab to aaya par usme koi audio nahi tha. " +
          "(Aksar iska matlab hota hai ki model TTS wala nahi hai — GEMINI_TTS_MODEL dekho.)",
      );
    }

    // Raw PCM — iska naap sirf mime me hota hai, isliye wahin se padha jaata hai.
    const pcm = requirePcmMime(part?.inlineData?.mimeType ?? "");
    const raw = resolve(args.scratchDir, `tts-gemini-${Date.now()}.pcm`);
    await writeFile(raw, Buffer.from(data, "base64"));

    return { path: raw, pcm };
  },
};

/* --------------------------------------------------------------- registry */

const ADAPTERS: readonly TtsAdapter[] = [geminiTtsAdapter, edgeTtsAdapter];

export function getTtsAdapter(id: string): TtsAdapter {
  const adapter = ADAPTERS.find((a) => a.id === id);
  if (!adapter) {
    throw new Error(
      `TTS provider "${id}" ka adapter nahi mila. Maujood hain: ${ADAPTERS.map((a) => a.id).join(", ")}`,
    );
  }
  return adapter;
}

export function ttsAdapterIds(): string[] {
  return ADAPTERS.map((a) => a.id);
}
