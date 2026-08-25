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
 * Default model — **2.5**, aur ye 26.26 ka faisla ulta karta hai (26.27).
 *
 * ⚠️ **Ye ek line ₹393 ki thi.** 26.26 me default 3.1 kar diya gaya tha, is
 * dalil par ki har model ka apna free quota hota hai — jo free tier par sach
 * bhi tha. Par account paid (Tier 1) hone ke baad wo dalil bekaar ho gayi aur
 * neeche wali baat bach gayi, jo kisi ne naapi hi nahi thi:
 *
 *     Gemini 3.1 Flash TTS —   9 call  →  ₹393.81   (~₹44 per call)
 *     Gemini 2.5 Flash TTS —  97 call  →  ₹ 16.95   (~₹0.17 per call)
 *
 * Yaani ek hi kaam, **~260 guna** keemat. Ye 24 Aug 2026 ke bill se nikla hai,
 * andaaza nahi hai.
 *
 * ⚠️ Sabse buri baat ye thi ki isme kuch "toota" hua nahi dikhta. Awaaz banti
 * thi, achhi banti thi, koi error nahi aata tha. Farak sirf bill me tha — aur
 * bill koi roz nahi dekhta. Isliye default hamesha **sasta** hona chahiye; jise
 * mehnga chahiye wo `GEMINI_TTS_MODEL` se maange, taaki wo ek soch kar liya gaya
 * faisla ho, chup-chaap laga hua default nahi.
 *
 * ⚠️ Preview model ki keemat bina khabar ke badal sakti hai. Naya model chunne
 * se pehle billing par uska **per-call kharcha** dekh lo — "naya hai" ya "tez
 * hai" iski wajah nahi hai.
 */
const GEMINI_TTS_DEFAULT = "gemini-2.5-flash-preview-tts";

/**
 * Mehnge model — **env var se bhi nahi chalenge** (26.29).
 *
 * ⚠️ Upar wala default theek karna kaafi nahi tha, aur wo isi bill se pata
 * chala. Code me default 2.5 kar dene ke baad bhi kharcha 3.1 par dikhta raha,
 * kyunki asli chunav code me nahi tha — wo **Vercel ke env var me** baitha tha.
 * `?? default` us haalat me kuch nahi karta: env set hai, to env jeetta hai.
 *
 * Isliye ab default sirf khaali jagah nahi bharta, wo ek **hadd** bhi hai. Jis
 * model ka per-call kharcha ₹44 naapa gaya ho, wo chup-chaap kisi dashboard ki
 * setting se wapas nahi aa sakta.
 *
 * ⚠️ Ye "3.x hamesha bura hai" nahi keh raha. Ye keh raha hai ki **is kharche
 * wala faisla likh kar liya jaaye**: jise sach me chahiye wo `GEMINI_TTS_MODEL`
 * ke saath `GEMINI_TTS_ALLOW_COSTLY=yes` bhi rakhe. Do var set karna bhoola
 * nahi jaata; ek var chup-chaap reh jaata hai — 24 Aug ko wahi hua tha.
 */
const GEMINI_TTS_COSTLY = /^gemini-3(\.\d+)?-(flash|pro)-tts/i;

export function pickTtsModel(): string {
  const asked = process.env.GEMINI_TTS_MODEL?.trim();
  if (!asked) return GEMINI_TTS_DEFAULT;

  const allowed = /^(1|yes|true)$/i.test(process.env.GEMINI_TTS_ALLOW_COSTLY?.trim() ?? "");
  if (GEMINI_TTS_COSTLY.test(asked) && !allowed) {
    console.warn(
      `[tts] GEMINI_TTS_MODEL="${asked}" chhod diya gaya — is model ka kharcha ~₹44 per call ` +
        `naapa gaya hai (2.5 par ~₹0.17). "${GEMINI_TTS_DEFAULT}" chal raha hai. ` +
        `Sach me yahi chahiye to GEMINI_TTS_ALLOW_COSTLY=yes bhi set karo.`,
    );
    return GEMINI_TTS_DEFAULT;
  }
  return asked;
}

const GEMINI_TTS_MODEL = pickTtsModel();
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
const GEMINI_CONSISTENCY =
  "Wahi ek narrator har line me — wahi umar, wahi pitch, wahi raftaar. Natural bolo.";

/**
 * Temperature — **0.6, aur 0 ek asli bug tha** (26.29).
 *
 * ⚠️ Ye number naapa gaya hai, chuna nahi gaya. 26.27 me ise 0 kar diya gaya
 * tha is dalil par ki "temperature bolne wale ki pehchaan badal deta hai". Wo
 * dalil dono taraf se galat nikli. Upar wale prompt ke saath ek hi line par
 * temperature badal-badal kar chalaya gaya (`gemini-2.5-flash-preview-tts`,
 * voice `Charon`, wahi text):
 *
 *     temperature   nateeja
 *     0             2/2 call kabhi lauti hi nahi (30s+)
 *     0.05          2/2 kabhi nahi lauti
 *     0.1           2/2 kabhi nahi lauti
 *     0.2           1/2 nahi lauti, doosri 21s
 *     0.35          1/4 nahi lauti, baaki ~6s
 *     0.6           9/9 lauti, 5-8s
 *     1.0 (default) 9/9 lauti, 5-15s
 *
 * Yaani neeche jaane par model **atak jaata hai** — audio tokens greedy decode
 * par apne aap ko dohrata rehta hai aur generation kabhi khatam nahi hoti.
 * Google 429 nahi deta, error nahi deta; wo bas rok kar baitha rehta hai.
 *
 * ⚠️ **Isi ek line se do aur "bug" bane the, jo bug the hi nahi:**
 *
 *   1. "Gemini ek ke baad ek call par dheema hota jaata hai (3.3s → 6.7s → 40s
 *      → atak gaya)" — ye 26.28 me naapa gaya tha, par temperature 0 lage hue.
 *      Wo ramp nahi thi; wo yahi atakna tha, alag-alag line par alag-alag
 *      shiddat se. 0.6 par 6 call **bina kisi gap ke** ek ke baad ek chalayi
 *      gayi: 7.8s, 6.2s, 7.7s, 7.6s, 5.8s, 5.2s. Koi ramp nahi.
 *   2. "45s me jawab nahi aaya" — wahi atakna, sirf timeout ki taraf se dikhta
 *      hua. Aadmi ne ek hi scene par "Awaaz banao" dabaya tha aur use ye error
 *      mila, jo "ek ke baad ek call" ko dosh de raha tha. Wo dosh jhootha tha.
 *
 * ⚠️ Aur pehchaan (jiske liye 0 laaya gaya tha) neeche jaane se **bigadti** hai,
 * sudharti nahi. Ek hi reel ki teen line par bolne wale ki pitch naapi gayi —
 * jitna kam temperature, utna zyada farak:
 *
 *     0.35 → 42.7 Hz ka farak
 *     0.6  → 11-16 Hz
 *     1.0  → 13-67 Hz
 *
 * ⚠️ `seed` se ye theek nahi hota — 0.6 aur 1.0 dono par seed daal kar dekha
 * gaya, farak wahi ka wahi raha. Pehchaan `prebuiltVoiceConfig.voiceName` se
 * bandhti hai (wo har scene par ek hi hai), is number se nahi.
 *
 * ⚠️ Ise phir se neeche mat le jaana, aur iske liye **env var bhi nahi hai** —
 * jaan-boojhkar. Ye wahi galti hai jo `GEMINI_TTS_MODEL` ne ₹393 me karayi:
 * ek number jo chup-chaap badal jaaye aur kuch "toota" hua na dikhe. Jo badle
 * wo yahin badle, aur pehle ek hi line par 3 call chala kar dekh le ki wo lauti
 * bhi hain ya nahi — ye galti browser me "atak gaya" jaisi dikhti hai, error ki
 * tarah nahi.
 */
export const GEMINI_TEMPERATURE = 0.6;

/**
 * Isse neeche jaana model ko atka deta hai — `check-tts.ts` isi par khada hai.
 *
 * ⚠️ 0.35 par 4 me se 1 call nahi lauti thi, isliye hadd usse upar hai. Ye
 * "safe" nahi, **naapa hua** number hai.
 */
export const GEMINI_MIN_TEMPERATURE = 0.5;

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
        temperature: GEMINI_TEMPERATURE,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: args.voiceId } },
        },
      },
    });

    const url = `${GEMINI_BASE}/${GEMINI_TTS_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

    /** Sirf "200 par audio nadaarad" wali halat ke liye — 2 se aage kabhi nahi. */
    const EMPTY_AUDIO_TRIES = 2;

    /**
     * Ek call ko kitna waqt — dekho neeche wala ⚠️.
     *
     * Vercel ka function 60s par marta hai, client 70s par haar maanta hai. 45
     * dono se pehle hai, taaki rukne ki wajah hum likhen — koi platform apne
     * HTML error page se nahi.
     */
    const GEMINI_TIMEOUT_MS = 45_000;
    let lastEmpty = "";

    for (let attempt = 1; attempt <= EMPTY_AUDIO_TRIES; attempt += 1) {
      /*
       * ⚠️ **Timeout — aur iska na hona ek asli, poore feature ko todne wala
       * bug tha (26.28).**
       *
       * Ye naap kar pakda gaya, andaaza nahi hai. Studio ke through ek call
       * chala kar dekha to route `200 in 114988ms` par lauta — yaani 115 second.
       * Usi waqt seedha Gemini ko wahi maang bheji to wo 3.3s me jawab de rahi
       * thi. Timing daal kar dekha to poora waqt yahin, is fetch me tha:
       *
       *     findAssetByCacheKey:  787ms
       *     overDailyLimit:      1401ms
       *     adapter.available:   1401ms
       *     synthesize:          ← 113 second
       *
       * ⚠️ Us waqt is atakne ki wajah "ek ke baad ek call par Google ka dheema
       * hona" samajhi gayi thi (3.3s → 6.7s → 40s → atak gaya). Wo galat thi —
       * asli wajah `GEMINI_TEMPERATURE` par likhi hai, aur 26.29 me theek ho
       * chuki hai. Timeout phir bhi rehta hai, kyunki wo ek **jaal** hai kisi
       * ek wajah ka ilaaj nahi: kal koi doosri wajah se call atke to Vercel ka
       * HTML error page nahi, hamara likha hua jawab jaana chahiye.
       *
       * Bina timeout ke ye intezaar kabhi khatam hi nahi hota tha, aur uske do
       * nateeje the:
       *
       *   1. Vercel apna function beech me maar deta tha aur client ko JSON ki
       *      jagah HTML milta tha — wahi "Server ne jawab beech me chhod diya"
       *      wala message, jisse na wajah pata chalti thi na ilaaj.
       *   2. Bani hui awaaz (agar ban chuki hoti) kabhi save hi nahi hoti,
       *      kyunki uske aage ka code chalta hi nahi tha — paisa lag chuka hota
       *      aur maal kuch nahi.
       *
       * ⚠️ 45 second hai, aur ye do haddon ke **beech** me chuna gaya hai:
       * Vercel ka function 60s par marta hai aur client 70s par haar maanta
       * hai. Yahan pehle rukne ka matlab hai ki wajah **hum** likhte hain, koi
       * platform apne HTML page se nahi. Aam call 3-7 second ki hai, isliye ye
       * hadd sirf usi ko kaat'ti hai jo waise bhi kabhi nahi lautne wala tha.
       */
      const controller = new AbortController();
      const cutoff = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });
      } catch (cause) {
        if (controller.signal.aborted) {
          /*
           * ⚠️ 503 hai, 500 nahi — aur wo farak client ke liye maayne rakhta
           * hai. Ye "kuch toot gaya" nahi hai; ye "provider abhi jawab nahi de
           * raha" hai, jispar dobara koshish karna sahi hai. `voiceGen` isi
           * darje par peek + retry chalata hai.
           *
           * ⚠️ Message me **wajah ka andaaza nahi lagaya jaata**, aur ye ek
           * naapi hui galti ka ilaaj hai. Pehle yahan likha tha "ye ek ke baad
           * ek awaaz banane par hota hai" — aadmi ne sirf **ek** scene par
           * dabaya tha aur use yahi mila. Galat wajah batana koi wajah na batane
           * se bura hai: wo aadmi ko us cheez ko badalne bhejti hai jo tooti hi
           * nahi (usne awaazein ek-ek karke banani shuru kar di thi, jabki
           * dikkat temperature me thi).
           */
          throw new TtsHttpError(
            503,
            `Gemini ne is line par ${Math.round(GEMINI_TIMEOUT_MS / 1000)}s me jawab nahi diya ` +
              `(${GEMINI_TTS_MODEL}). Aam call 5-8s ki hoti hai. Dobara dabao — ` +
              `baar-baar ho to ye line ke shabd badal kar dekho.`,
            null,
            false,
          );
        }
        throw cause;
      } finally {
        clearTimeout(cutoff);
      }

      if (!response.ok) {
        const raw = await response.text();
        const { retryAfterSeconds, perDay } = readGoogleError(raw);

        if (response.status === 429) {
          /*
           * ⚠️ Yahan pehle "free quota" likha tha, aur wo **jhooth** tha (26.27).
           *
           * Account paid hai (Tier 1, prepay credits). 429 ka matlab paisa
           * khatam hona nahi hai — ye Google ki **rate limit** hai, jo paid tier
           * par bhi lagti hai aur paise se nahi khulti:
           *
           *     TTS model par Tier 1 — 10 request/minute, 100 request/din
           *
           * "Free quota khatam" padh kar aadmi billing par jaata tha, credit
           * dekhta tha (jo pade the), aur use kuch samajh nahi aata tha. Galat
           * wajah batana koi wajah na batane se bura hai — wo aadmi ko us cheez
           * ko theek karne bhejti hai jo tooti hi nahi.
           *
           * ⚠️ Din **Pacific time** par badalta hai, tumhare aadhi raat par nahi
           * — ye likhna zaroori hai warna aadmi 12 baje baith kar intezaar karta
           * hai aur hadd khulti hi nahi.
           *
           * ⚠️ Har model ka apna RPD hai. Ye baat sach hai par yahan salah ke
           * roop me nahi likhi jaati: doosra model chunna sasta lagta hai aur
           * mehnga nikal sakta hai (3.1 wala ~₹44/call tha). Model badalne ki
           * salah tabhi jab uska per-call kharcha dekh liya gaya ho.
           */
          throw new TtsHttpError(
            429,
            perDay
              ? `Aaj ki hadd poori ho gayi — ${GEMINI_TTS_MODEL} par 100 awaaz/din ` +
                `(ye Google ki rate limit hai, paise ki nahi — tumhare credit bache hue hain). ` +
                `Ye Pacific time ki aadhi raat par khulti hai. Tab tak apni awaaz upload kar sakte ho.`
              : `Ek minute me 10 se zyada awaaz nahi ban sakti (Google ki rate limit). ` +
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
