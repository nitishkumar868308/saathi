import type { TranscriptResult, TranscriptWord } from "./transcript";

/**
 * Forced-alignment-lite — jab text pehle se pata ho (23.5).
 *
 * ⚠️ **Kyun**: TTS se bani awaaz ka text humne khud diya hai. Us par whisper
 * chalana matlab apni hi likhi hui line ko machine se dobara padhwana — CPU
 * bhi jaata hai aur galti aane ka mauka bhi banta hai (whisper "Papa" ko "Bapa"
 * bhi sun sakta hai). Text pakka hai; sirf **timing** nikalni hai.
 *
 * ⚠️ Ye alignment **naap nahi** hai (`source: "aligned"` isliye hi likha jaata
 * hai). Ye do cheezein maan kar chalti hai: (a) shabd apni lambai ke hisaab se
 * waqt lete hain, aur (b) chuppi me koi shabd nahi hota. Doosri baat hi ise
 * seedhe-saade "text ko barabar baant do" se behtar banati hai.
 */

export interface SpeechSegment {
  startSeconds: number;
  endSeconds: number;
}

/**
 * Shabd ka bhaar — kitna waqt lega.
 *
 * ⚠️ Akshar ginna galat hota hai. Devanagari me "श्री" teen akshar ka hai par
 * bolne me ek hi matra jitna waqt leta hai; Latin me "through" saat akshar ka
 * hai aur ek hi syllable. Isliye **syllable** ginte hain — wahi bolne ke waqt
 * ke sabse paas hai.
 */
export function syllableWeight(word: string): number {
  const clean = word.replace(/[.,!?;:—–…"'`()]/g, "");
  if (clean.length === 0) return 1;

  // Devanagari: vyanjan gino, halant ghatao (halant matlab agla akshar juda hua).
  const consonants = (clean.match(/[क-हक़-य़]/g) ?? []).length;
  if (consonants > 0) {
    const halants = (clean.match(/्/g) ?? []).length;
    const independentVowels = (clean.match(/[अ-औ]/g) ?? []).length;
    return Math.max(1, consonants - halants + independentVowels);
  }

  // Latin: vowel ke group gino. "kamal" -> a,a = 2. "through" -> ou = 1.
  const groups = clean.toLowerCase().match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

/**
 * Viraam chinh ke baad thodi si saans.
 *
 * Iske bina "Namaste. Aaj hum..." me poornviraam ke baad wala rukna kahin nahi
 * jaata, aur uske aage ke saare shabd apne asli waqt se pehle highlight hone
 * lagte hain — galti jodti chali jaati hai.
 */
const PAUSE_WEIGHT: Record<string, number> = {
  ",": 0.5,
  ";": 0.7,
  ":": 0.7,
  ".": 1.2,
  "।": 1.2,
  "॥": 1.2,
  "!": 1.2,
  "?": 1.2,
  "…": 1.5,
};

function pauseAfter(word: string): number {
  const last = word.trim().slice(-1);
  return PAUSE_WEIGHT[last] ?? 0;
}

export interface AlignOptions {
  text: string;
  /** Poori awaaz kitni lambi hai. */
  durationSeconds: number;
  /** Awaaz kahan se shuru hoti hai (default 0). */
  startSeconds?: number;
  /**
   * Awaaz ke wo hisse jinme bolna hai (ffmpeg `silencedetect` se).
   *
   * Milne par shabd sirf inhi ke andar baithte hain — chuppi me koi shabd nahi
   * jaata. Na milne par poori lambai ek hi segment maan li jaati hai.
   */
  segments?: readonly SpeechSegment[];
}

/**
 * Text + lambai (+ chuppi ka naksha) se word timing.
 *
 * Kaam do kadam me hota hai:
 *   1. har shabd ko bhaar do (syllable + uske baad ka rukna)
 *   2. saare **bolne wale** waqt ko us bhaar ke hisaab se baanto
 *
 * Doosra kadam hi asli baat hai. Bina segments ke chuppi bhi baant di jaati hai
 * aur shuruaati khaamoshi ke saare shabd aage khisak jaate hain.
 */
export function alignWords(options: AlignOptions): TranscriptWord[] {
  const tokens = options.text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const start = options.startSeconds ?? 0;
  const fallback: SpeechSegment[] = [
    { startSeconds: start, endSeconds: start + Math.max(0.001, options.durationSeconds) },
  ];
  const segments = (options.segments && options.segments.length > 0 ? [...options.segments] : fallback)
    .filter((segment) => segment.endSeconds > segment.startSeconds)
    .sort((a, b) => a.startSeconds - b.startSeconds);
  if (segments.length === 0) return [];

  // Bolne ka kul waqt — chuppi chhod kar.
  const speechTotal = segments.reduce(
    (sum, segment) => sum + (segment.endSeconds - segment.startSeconds),
    0,
  );

  const weights = tokens.map(
    (token, index) => syllableWeight(token) + (index === tokens.length - 1 ? 0 : pauseAfter(token)),
  );
  const weightTotal = weights.reduce((a, b) => a + b, 0);

  /*
   * Kaam do kadam me: pehle **kaun sa shabd kis segment ka**, phir har segment
   * ke andar uske apne shabdon ko baanto.
   *
   * ⚠️ Pehle ye ek hi kadam me hota tha — saare shabdon ko ek lambi "sirf bolne
   * wali" line par rakh kar, aur phir har point ko asli waqt me badal kar. Wo
   * tarika seema par toot-ta hai: shabd theek wahin khatam hota hai jahan agla
   * shuru hota hai, aur us point ka jodta-jodta aaya hua hisaab kabhi 0.4999
   * nikalta hai to shabd pichhli chuppi se **pehle** chala jaata hai. Naapa
   * gaya tha: 500ms ki galti, aur wo bhi ek-do shabd par — yaani dekhne me
   * "kabhi-kabhi" wali gadbad, jo sabse mushkil se pakdi jaati hai.
   *
   * Segment ke hisaab se baantne par ye ho hi nahi sakta: ek shabd hamesha ek
   * hi segment ke andar rehta hai. Wo bolne ke hisaab se bhi sahi hai — koi
   * shabd chuppi ke aar-paar nahi bolta.
   */
  const perSegment: number[][] = segments.map(() => []);
  let cumulative = 0;

  weights.forEach((weight, index) => {
    // Shabd ka beech ka point — isse tay hota hai wo kis segment ka hai.
    const middle = (cumulative + weight / 2) / weightTotal;
    cumulative += weight;

    let share = 0;
    let chosen = segments.length - 1;
    for (let s = 0; s < segments.length; s += 1) {
      const segment = segments[s] as SpeechSegment;
      share += (segment.endSeconds - segment.startSeconds) / speechTotal;
      if (middle < share) {
        chosen = s;
        break;
      }
    }
    (perSegment[chosen] as number[]).push(index);
  });

  const out: TranscriptWord[] = new Array(tokens.length);

  segments.forEach((segment, segmentIndex) => {
    const indices = perSegment[segmentIndex] as number[];
    if (indices.length === 0) return;

    const span = segment.endSeconds - segment.startSeconds;
    const localTotal = indices.reduce((sum, index) => sum + (weights[index] as number), 0);

    let at = segment.startSeconds;
    indices.forEach((index, position) => {
      const share = ((weights[index] as number) / localTotal) * span;
      // Aakhri shabd theek segment ke ant par — jodte-jodte aayi rounding wahin
      // sudhar jaati hai.
      const to = position === indices.length - 1 ? segment.endSeconds : at + share;
      out[index] = {
        text: tokens[index] as string,
        startSeconds: at,
        endSeconds: to,
        /*
         * ⚠️ `null` — machine ne kuch bataya hi nahi. Yahan koi bana hua number
         * (jaise 1.0 ya 0.9) daalna jhooth hota: UI usse "pakka hai" samajhti
         * aur user kabhi jaanch hi nahi karta.
         */
        confidence: null,
      };
      at = to;
    });
  });

  return out.filter(Boolean);
}

/**
 * TTS wala shortcut — poora transcript, bina whisper ke (23.5).
 *
 * `source: "aligned"` yahin set hota hai aur UI use dikhati hai.
 */
export function alignTranscript(options: AlignOptions & { language?: string | null }): TranscriptResult {
  return {
    words: alignWords(options),
    language: options.language ?? null,
    durationSeconds: options.durationSeconds,
    source: "aligned",
  };
}
