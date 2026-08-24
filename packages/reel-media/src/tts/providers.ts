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

/**
 * Default model — **3.1**, aur ye chunav naap kar liya gaya hai (26.26).
 *
 * Dono model ek hi raftaar par jawab dete hain (~3.5s ek line), par har model ka
 * **apna free quota** hota hai (`...PerModel-FreeTier`). Yaani model badalna sirf
 * awaaz ka chunav nahi, ek alag hadd bhi hai.
 *
 * Badalna ho to `GEMINI_TTS_MODEL` se — code chhune ki zaroorat nahi.
 */
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Ek hi reel me ek hi bolne wala — **par bolna asli lage** (26.26).
 *
 * ⚠️ Yahan pehle likha tha "koi acting nahi, koi utaar-chadhav nahi", aur wo
 * seedha galat tha: wo model ko **flat padhne** ka nirdesh hai. Nateeja ek jaisi
 * awaaz to deta hai, par wo reel me machine jaisi sunai deti hai — aur reel ka
 * poora asar wahin mar jaata hai.
 *
 * Ek hi cheez ek rakhni hai: **kaun bol raha hai** (wahi andaaz, wahi raftaar).
 * Bolne ka dhang natural rehna chahiye. Do alag baatein hain, aur unhe ek samajh
 * lena hi wo galti thi.
 *
 * ⚠️ Ye line jaan-boojhkar **chhoti** hai. Har call me ye prompt tokens me billti
 * hai, aur audio ke tokens (~60-90 ek line ke) ke saamne ek lambi Hindi hidayat
 * poore kharche ko lagbhag dugna kar deti hai. Free quota par wo farak seedha
 * "aaj kitni reel ban sakti hai" me dikhta hai.
 */
const GEMINI_CONSISTENCY = "Poori reel me wahi ek narrator, wahi raftaar. Natural bolo.";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/**
 * Provider ne HTTP par mana kiya — **kitni der baad dobara** ke saath.
 *
 * ⚠️ `retryAfterSeconds` is class ki poori wajah hai. 429 par andaaze se dobara
 * bhejna free quota ka sabse tez kharch hai: hadd **per-minute** hoti hai, aur
 * 700ms baad dobara bhejna sirf ek aur 429 kamata hai. Google khud batata hai ki
 * kitni der rukna hai (`RetryInfo.retryDelay`) — wo number yahan tak lana zaroori
 * hai, taaki rukne ka faisla andaaze par na ho.
 */
export class TtsHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds: number | null,
    /** `true` = ye hadd aaj bhar ki hai (per-day), aur rukne se theek nahi hogi. */
    readonly quotaExhausted: boolean,
  ) {
    super(message);
    this.name = "TtsHttpError";
  }
}

interface GoogleErrorBody {
  error?: {
    message?: string;
    details?: {
      "@type"?: string;
      retryDelay?: string;
      violations?: { quotaId?: string; quotaValue?: string }[];
    }[];
  };
}

/**
 * Google ke 429 me se asli kaam ki do cheezein nikaalo.
 *
 * ⚠️ Ye body sirf ek lamba message nahi hai — usme `RetryInfo` aur `QuotaFailure`
 * dono hote hain, aur unme wo jawab hai jo warna andaaze se lagana padta:
 * **kitni der** aur **kis kism ki hadd**. Per-minute hadd ek minute me khul jaati
 * hai; per-day wali aaj khulegi hi nahi. Dono par ek jaisa bartaav karne ka
 * matlab hai ya to bekaar intezaar, ya bekaar koshish.
 */
function readGoogleError(raw: string): { retryAfterSeconds: number | null; perDay: boolean } {
  let body: GoogleErrorBody;
  try {
    body = JSON.parse(raw) as GoogleErrorBody;
  } catch {
    return { retryAfterSeconds: null, perDay: false };
  }

  let retryAfterSeconds: number | null = null;
  let perDay = false;

  for (const detail of body.error?.details ?? []) {
    const type = detail["@type"] ?? "";
    if (type.endsWith("RetryInfo") && detail.retryDelay) {
      const seconds = Number.parseFloat(detail.retryDelay.replace(/s$/, ""));
      if (Number.isFinite(seconds)) retryAfterSeconds = Math.ceil(seconds);
    }
    if (type.endsWith("QuotaFailure")) {
      for (const violation of detail.violations ?? []) {
        if (/PerDay/i.test(violation.quotaId ?? "")) perDay = true;
      }
    }
  }

  return { retryAfterSeconds, perDay };
}

/** Jawab me audio ka hissa — mila to uske saath uska mime bhi chahiye. */
function geminiAudioPart(json: GeminiResponse): { part: GeminiPart; data: string } | null {
  for (const part of json.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) return { part, data: part.inlineData.data };
  }
  return null;
}

/**
 * Audio na aaya to **kya sach me hua**.
 *
 * ⚠️ Wajah dhoondhne ka poora kaam yahan hai, kyunki bina uske error ka message
 * ek andaaza ban jaata hai. Purana message har haalat par ek hi baat kehta tha
 * ("model TTS wala nahi hai — GEMINI_TTS_MODEL dekho"), aur wo aksar galat hoti
 * thi: asli wajah kabhi `finishReason` hoti hai, kabhi model ka likh kar jawab de
 * dena, kabhi bas ek khaali candidate. Teeno ke ilaaj alag hain.
 */
function geminiWhyNoAudio(json: GeminiResponse): string {
  const blocked = json.promptFeedback?.blockReason;
  if (blocked) {
    return `Google ne ye text hi rok diya (${blocked}) — is line ke shabd badal kar dekho.`;
  }

  const candidate = json.candidates?.[0];
  if (!candidate) return "Jawab me koi candidate hi nahi tha — ye aksar ek pal ki dikkat hoti hai.";

  const finish = candidate.finishReason;
  if (finish && finish !== "STOP") {
    return `Model "${finish}" par ruk gaya — is line ke shabd badal kar dekho.`;
  }

  const said = (candidate.content?.parts ?? [])
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join(" ");
  if (said) {
    return (
      `Model ne awaaz ki jagah likh kar jawab diya: "${said.slice(0, 160)}". ` +
      `Aksar iska matlab hota hai ki wo model TTS wala nahi hai — GEMINI_TTS_MODEL dekho ` +
      `(abhi "${GEMINI_TTS_MODEL}" chal raha hai).`
    );
  }

  return "Jawab khaali tha — na audio, na koi wajah.";
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

  /**
   * Ek call, aur bas.
   *
   * ⚠️ Yahan **koi intezaar nahi hota** — na 429 par, na kisi aur par. Ye function
   * ek serverless request ke andar chalta hai jiski apni hadd (Vercel par 60s)
   * hai, aur us hadd ke andar rukna do tarah se bura hai: request beech me kat
   * jaati hai (client ko HTML ka error page milta hai, JSON nahi), aur rukne ka
   * waqt bhi zaya hota hai. Rukna **client ka kaam** hai — uspar koi hadd nahi.
   *
   * ⚠️ Sirf ek halat me dobara koshish hoti hai: jawab 200 aaya par usme audio na
   * ho. Wo sach me ek pal ki baat hoti hai aur turant dobara bhejne par ban jaati
   * hai. Baaki har halat (429, 4xx, 5xx) seedha upar jaati hai, apni wajah ke
   * saath — kyunki unme dobara bhejna sirf quota aur waqt kharch karta hai.
   */
  async synthesize(args) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GEMINI_API_KEY set nahi hai");

    /*
     * Gemini me rate/pitch ka koi parameter hai hi nahi — andaaz **shabdon me**
     * batana padta hai.
     *
     * ⚠️ Ye ek asli hadd hai aur ise chhupana nahi chahiye: slider se rate 1.5
     * karne par Gemini ki awaaz theek 1.5x tez **nahi** hogi. Jise sach me exact
     * raftaar chahiye wo `voiceRate` se karega, jo naapa hua hai.
     */
    const speed = args.rate > 1.15 ? " Thoda tez." : args.rate < 0.85 ? " Thoda dheere." : "";
    const style = `${args.stylePrompt ?? ""}${speed} ${GEMINI_CONSISTENCY}`.trim();
    const prompt = `${style}\nBolo: "${args.text}"`;

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        /*
         * ⚠️ 0.35 — jaan-boojhkar na 0, na default.
         *
         * 0 par har call bilkul ek jaisi aati hai (jo chahiye tha) par bolna
         * chapta aur machine jaisa ho jaata hai. Default par har call apna andaaz
         * chun leti hai aur poori reel me bolne wala badalta hua sunai deta hai —
         * wahi shikayat jisse ye poora daur shuru hua. Neeche wali jagah dono se
         * bachati hai: awaaz aur raftaar tikti hai, par line apni saans ke saath
         * boli jaati hai.
         */
        temperature: 0.35,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: args.voiceId } },
        },
      },
    });

    const url = `${GEMINI_BASE}/${GEMINI_TTS_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

    /** Sirf "200 par audio nadaarad" wali halat ke liye — 2 se aage kabhi nahi. */
    const EMPTY_AUDIO_TRIES = 2;
    let lastEmpty = "";

    for (let attempt = 1; attempt <= EMPTY_AUDIO_TRIES; attempt += 1) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!response.ok) {
        const raw = await response.text();
        const { retryAfterSeconds, perDay } = readGoogleError(raw);

        if (response.status === 429) {
          throw new TtsHttpError(
            429,
            perDay
              ? `Aaj ka free quota khatam ho gaya (${GEMINI_TTS_MODEL}). Kal reset hoga — ` +
                `tab tak apni awaaz upload kar sakte ho.`
              : `Ek minute me itni awaazein nahi ban sakti (free quota ki hadd). ` +
                `${retryAfterSeconds ?? 30} second baad apne aap dobara koshish hogi.`,
            retryAfterSeconds,
            perDay,
          );
        }

        throw new TtsHttpError(
          response.status,
          `Gemini ne mana kiya — HTTP ${response.status}. ${raw.slice(0, 300)}`,
          retryAfterSeconds,
          false,
        );
      }

      const json = (await response.json()) as GeminiResponse;
      const audio = geminiAudioPart(json);

      if (audio) {
        // Raw PCM — iska naap sirf mime me hota hai, isliye wahin se padha jaata hai.
        const pcm = requirePcmMime(audio.part.inlineData?.mimeType ?? "");
        const raw = resolve(args.scratchDir, `tts-gemini-${Date.now()}-${attempt}.pcm`);
        await writeFile(raw, Buffer.from(audio.data, "base64"));
        return { path: raw, pcm };
      }

      lastEmpty = geminiWhyNoAudio(json);

      /*
       * ⚠️ Kuch wajahein dobara bhejne se theek nahi hoti — Google ne text hi rok
       * diya ho, ya model TTS wala hi na ho. Un par dobara bhejna sirf quota
       * kharch karta hai, aur free tier par wo quota ginti ka hai.
       */
      if (lastEmpty.includes("rok diya") || lastEmpty.includes("GEMINI_TTS_MODEL")) break;
    }

    throw new Error(`Gemini se awaaz nahi bani. ${lastEmpty}`);
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
