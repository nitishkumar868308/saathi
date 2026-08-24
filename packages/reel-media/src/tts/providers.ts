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

/**
 * Kitni baar dobara koshish — aur kyun (26.25).
 *
 * ⚠️ Gemini ka TTS model kabhi-kabhi audio ki jagah **text** lauta deta hai, ya
 * ek khaali candidate. Wo aksar ek pal ki baat hoti hai: wahi text turant dobara
 * bhejne par awaaz aa jaati hai. Pehle yahan koi retry nahi tha, isliye ek scene
 * par wo ek pal poore batch ko tod deta tha — aur upar se message ye kehta tha ki
 * `GEMINI_TTS_MODEL` galat hai, jabki usi model se baaki chhe scene ki awaaz
 * abhi-abhi ban chuki hoti thi. Aadmi env file kholta tha, jahan kuch galat tha
 * hi nahi.
 *
 * ⚠️ Rok-tok (429) par bhi dobara koshish hoti hai, par lambe intezaar ke saath —
 * "Sab ki awaaz banao" saat request ek ke baad ek bhejta hai, aur muft wali key
 * par wo hadd aam hai.
 */
const GEMINI_ATTEMPTS = 3;
const GEMINI_RETRY_MS = [700, 2500] as const;

/**
 * Ek hi reel me har scene par **ek jaisi** awaaz (26.25).
 *
 * ⚠️ Ye sirf shabdon ka khel nahi hai, ek asli shikayat ka ilaaj hai: aadmi ne
 * saare scene ek hi awaaz (`Charon`) par banaye the, phir bhi sunne me har scene
 * ka bolne wala thoda alag lagta tha. Wajah ye hai ki har scene ek **alag call**
 * hai, aur model har call me apne hisaab se andaaz chun leta hai — ek line par
 * utsaahi, agli par thehra hua. Voice ka naam ek hone se sirf gala ek rehta hai,
 * andaaz nahi.
 *
 * Do cheezein ise baandhti hain, aur dono zaroori hain:
 *
 *  1. Har call me saaf likha jaata hai ki ye **ek hi narration ka ek hissa** hai
 *     aur andaaz har hisse me ek jaisa rehna chahiye.
 *  2. `temperature: 0` — yaani model ke paas "aaj thoda alag padhta hoon" wali
 *     jagah bachti hi nahi. Yahi wo ek line hai jo scene-dar-scene ke utaar-
 *     chadhav ko sabse zyada kam karti hai.
 *
 * ⚠️ Nirdesh aur bola jaane wala text ek hi line me, quotes ke saath jaate hain —
 * yahi Gemini ka apna documented tarika hai. Pehle nirdesh alag paragraph me upar
 * likha jaata tha, aur us shakl me model use kabhi-kabhi **sawaal** samajh kar
 * uska jawab likh deta tha — yaani theek wahi halat jisme "koi audio nahi tha"
 * wala error aata hai.
 */
const GEMINI_CONSISTENCY =
  "Ye ek hi reel ke narration ka ek hissa hai. Har hisse me bilkul EK JAISI awaaz, " +
  "ek jaisa andaaz aur ek jaisi raftaar rakho — koi acting nahi, koi utaar-chadhav nahi.";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
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
 * dena, kabhi bas ek khaali candidate. Teeno ke ilaaj alag hain, isliye teeno ki
 * line alag hai.
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

  async synthesize(args) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GEMINI_API_KEY set nahi hai");

    /*
     * Gemini me rate/pitch ka koi parameter hai hi nahi — andaaz **shabdon me**
     * batana padta hai. Isliye style ka nirdesh text ke saath jaata hai.
     *
     * ⚠️ Ye ek asli hadd hai aur ise chhupana nahi chahiye: slider se rate 1.5
     * karne par Gemini ki awaaz theek 1.5x tez **nahi** hogi, wo bas "tez bolo"
     * samajhta hai. Jise sach me exact raftaar chahiye wo baad me speed change
     * (Phase 15) se karega, jo naapa hua hai.
     */
    const speed =
      args.rate > 1.15 ? " Thoda tez bolo." : args.rate < 0.85 ? " Thoda dheeme bolo." : "";
    const style = `${args.stylePrompt ?? ""}${speed} ${GEMINI_CONSISTENCY}`.trim();
    const prompt = `${style}\nYe line bilkul jaisi likhi hai waisi bolo: "${args.text}"`;

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        /*
         * ⚠️ 0 — aur ye sajawat nahi hai. Isse hi scene-dar-scene andaaz badalna
         * band hota hai; default par har call apni marzi ka utaar-chadhav chunti
         * hai, aur poori reel me bolne wala badalta hua sunai deta hai.
         */
        temperature: 0,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: args.voiceId } },
        },
      },
    });

    let lastError = "";
    for (let attempt = 1; attempt <= GEMINI_ATTEMPTS; attempt += 1) {
      const response = await fetch(
        `${GEMINI_BASE}/${GEMINI_TTS_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );

      if (response.ok) {
        const json = (await response.json()) as GeminiResponse;
        const audio = geminiAudioPart(json);

        if (audio) {
          // Raw PCM — iska naap sirf mime me hota hai, isliye wahin se padha jaata hai.
          const pcm = requirePcmMime(audio.part.inlineData?.mimeType ?? "");
          const raw = resolve(args.scratchDir, `tts-gemini-${Date.now()}-${attempt}.pcm`);
          await writeFile(raw, Buffer.from(audio.data, "base64"));
          return { path: raw, pcm };
        }

        lastError = geminiWhyNoAudio(json);

        /*
         * ⚠️ Kuch wajahein dobara koshish se theek nahi hoti — Google ne text hi
         * rok diya ho, ya model TTS wala hi na ho. Un par teen baar wahi call
         * bhejna sirf waqt aur paisa hai, aur aadmi ko teen guna der intezaar
         * karwata hai.
         */
        if (lastError.includes("rok diya") || lastError.includes("GEMINI_TTS_MODEL")) break;
      } else {
        const text = await response.text();
        lastError = `HTTP ${response.status}. ${text.slice(0, 300)}`;
        // 4xx (429 ke alawa) dobara bhejne par bhi wahi jawab dega.
        if (response.status !== 429 && response.status < 500) break;
      }

      const wait = GEMINI_RETRY_MS[attempt - 1];
      if (attempt < GEMINI_ATTEMPTS && wait !== undefined) await sleep(wait);
    }

    throw new Error(`Gemini se awaaz nahi bani (${GEMINI_ATTEMPTS} koshish). ${lastError}`);
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
