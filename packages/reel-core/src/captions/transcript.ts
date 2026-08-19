import { z } from "zod";

import { secondsToFrames } from "../time";
import type { CaptionCue, CaptionWord } from "./cues";

/**
 * Transcript — awaaz se aaye shabd, aur unse cues (23.1 / 23.6 / 23.7 / 23.9).
 *
 * ⚠️ Yahan sab kuch **seconds** me hai, frames me nahi. Transcribe karne wala
 * (whisper) frames ke baare me kuch nahi jaanta — usse fps poochhna hi galat
 * hai. Frames me badalna ek hi jagah hota hai: `buildCues()`, jahan fps aur item
 * ka offset dono maujood hain.
 *
 * ⚠️ Aur yahan har shabd ke saath `confidence` chalti hai. Bina uske transcript
 * "sab kuch pakka" jaisa dikhta hai, jabki hakikat me kuch shabd machine ne
 * andaaze se likhe hote hain — aur wahi do-teen shabd hote hain jo user ko haath
 * se theek karne hote hain (23.9).
 */

export const TranscriptWordSchema = z.object({
  text: z.string(),
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  /** 0..1. `null` = machine ne bataya hi nahi (aligned raaste me aisa hota hai). */
  confidence: z.number().min(0).max(1).nullable().default(null),
});

export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;

/**
 * Transcript kahan se aaya.
 *
 * ⚠️ Ye field UI me dikhti hai aur dikhni chahiye. `aligned` wala transcript
 * **naapa hua nahi** hai — wo humare apne text ko awaaz ki lambai par baant kar
 * banaya gaya hai (23.5). Dono ko ek jaisa dikhana sabse bura hota: user aligned
 * timing ko sach maan kar karaoke lagata hai aur highlight halka sa aage-peeche
 * chalta rehta hai, aur wajah kabhi pakad me nahi aati.
 */
export type TranscriptSource = "whisper" | "aligned";

export interface TranscriptResult {
  words: TranscriptWord[];
  /** Jo bhasha pakdi gayi (`hi`, `en`…). `null` = pata nahi chala. */
  language: string | null;
  durationSeconds: number;
  source: TranscriptSource;
}

/* ------------------------------------------------------------- confidence */

/**
 * Isse neeche wale shabd UI me highlight hote hain (23.9).
 *
 * 0.6 tajurbe se hai, kisi kitaab se nahi: whisper ke aam Hindi transcript me
 * theek shabd 0.8+ par hote hain aur galat shabd 0.5 ke aas-paas. 0.9 rakhne par
 * aadhi caption peeli ho jaati hai aur highlight ka matlab hi khatam.
 */
export const LOW_CONFIDENCE_BELOW = 0.6;

export function isLowConfidence(word: { confidence: number | null }): boolean {
  return word.confidence !== null && word.confidence < LOW_CONFIDENCE_BELOW;
}

/* ------------------------------------------------------------ filler words */

/**
 * Filler (hichkichahat) — registry, kahin likhi hui list nahi (23.7).
 *
 * ⚠️ Isme sirf wo cheezein hain jinka **koi matlab nahi** hota. "matlab",
 * "yaani", "waise" jaise shabd yahan jaan-boojhkar **nahi** hain — wo asli shabd
 * hain aur unhe hatane se vaakya ka matlab badal jaata hai. Ek baar aisi safai
 * ho jaaye to user ko pata bhi nahi chalta ki uski baat me se kya gaya.
 */
export const FILLER_WORDS: readonly string[] = [
  "um", "umm", "uhh", "uh", "erm", "er", "hmm", "hmmm", "mmm",
  "aa", "aaa", "ah", "ahh", "eh", "hm",
  "अं", "अँ", "हम्म", "आं",
];

const FILLER_SET = new Set(FILLER_WORDS);

/** Filler ya nahi — viraam chinh hata kar, chhote akshar me. */
export function isFillerWord(text: string): boolean {
  const clean = text.toLowerCase().replace(/[.,!?;:—–…"'`।॥]/g, "").trim();
  return clean.length > 0 && FILLER_SET.has(clean);
}

/**
 * Filler nikaalo, aur saath me lagataar dohraya hua shabd bhi ("the the").
 *
 * ⚠️ Default **band** hai (`buildCues` ka option), aur ye soch kar hai: bolne ka
 * andaaz filler se hi banta hai. Sab hata dene par caption saaf to lagti hai par
 * awaaz se milti nahi — video me hont kuch aur kehte hain aur neeche kuch aur
 * likha hota hai.
 */
export function removeFillers(words: readonly TranscriptWord[]): TranscriptWord[] {
  const out: TranscriptWord[] = [];
  for (const word of words) {
    if (isFillerWord(word.text)) continue;
    const previous = out[out.length - 1];
    if (previous && normalizeForRepeat(previous.text) === normalizeForRepeat(word.text)) {
      // Dohraya hua shabd — pehle wale ko hi lamba kar do, taaki karaoke me
      // highlight beech me na atke.
      out[out.length - 1] = { ...previous, endSeconds: word.endSeconds };
      continue;
    }
    out.push(word);
  }
  return out;
}

function normalizeForRepeat(text: string): string {
  return text.toLowerCase().replace(/[.,!?;:—–…"'`।॥]/g, "").trim();
}

/* ----------------------------------------------------------- line wrapping */

/**
 * Ek cue ka text line me toda hua (23.7).
 *
 * Greedy hai — shabd bhar bhar ke line banti hai. "Balanced" tarika (dono line
 * barabar) dekhne me behtar lagta hai par reels me caption neeche hoti hai aur
 * padhne ka waqt bahut kam; wahan lambi pehli line aur chhoti doosri line aankh
 * ke liye aasan padti hai.
 */
export function wrapLines(text: string, maxCharsPerLine: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (line.length === 0) {
      line = word;
      continue;
    }
    if (line.length + 1 + word.length <= maxCharsPerLine) {
      line = `${line} ${word}`;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line.length > 0) lines.push(line);
  return lines.join("\n");
}

/* ------------------------------------------------------------- cue banana */

export interface BuildCuesOptions {
  fps: number;
  /** Subtitle item timeline par kahan se shuru hota hai — cue frames item-local hote hain. */
  offsetSeconds?: number;
  maxCharsPerLine?: number;
  maxLines?: number;
  /** Ek cue kitni lambi ho sakti hai. */
  maxCueSeconds?: number;
  /** Itni chuppi par nayi cue shuru — bolne ka natural break. */
  breakOnGapSeconds?: number;
  /** Filler hatane hain? Default `false` — dekho `removeFillers()` ka note. */
  dropFillers?: boolean;
  makeId: (index: number) => string;
}

/** Reels ke liye default — sab badle ja sakte hain. */
export const DEFAULT_BUILD_CUES = {
  maxCharsPerLine: 32,
  maxLines: 2,
  maxCueSeconds: 3.5,
  breakOnGapSeconds: 0.45,
} as const;

const SENTENCE_END = /[.!?।॥]$/;

/**
 * Shabdon se cues (23.6).
 *
 * ⚠️ Cue ke frames **item-local** hain (Phase 19 ka niyam) — isliye
 * `offsetSeconds` ghata kar frame nikalta hai. Doc ke frames rakhne par subtitle
 * item ko khiskane se captions video se alag ho jaate.
 *
 * ⚠️ Aur har cue me `words[]` **asli timing** ke saath jaata hai, andaaza nahi.
 * Yahi Phase 19 ke `estimateWords()` se asli farak hai, aur karaoke isi par
 * tikta hai.
 */
export function buildCues(
  words: readonly TranscriptWord[],
  options: BuildCuesOptions,
): CaptionCue[] {
  const maxChars = options.maxCharsPerLine ?? DEFAULT_BUILD_CUES.maxCharsPerLine;
  const maxLines = options.maxLines ?? DEFAULT_BUILD_CUES.maxLines;
  const maxSeconds = options.maxCueSeconds ?? DEFAULT_BUILD_CUES.maxCueSeconds;
  const gap = options.breakOnGapSeconds ?? DEFAULT_BUILD_CUES.breakOnGapSeconds;
  const offset = options.offsetSeconds ?? 0;
  const budget = maxChars * maxLines;

  const source = options.dropFillers ? removeFillers(words) : [...words];
  if (source.length === 0) return [];

  /* ------------------------------------------------- pehle groups banao */

  const groups: TranscriptWord[][] = [];
  let group: TranscriptWord[] = [];
  let chars = 0;

  for (const word of source) {
    const previous = group[group.length - 1];
    const wouldBeChars = chars + (chars === 0 ? 0 : 1) + word.text.length;

    const breakHere =
      previous !== undefined &&
      (word.startSeconds - previous.endSeconds >= gap ||
        wouldBeChars > budget ||
        word.endSeconds - (group[0] as TranscriptWord).startSeconds > maxSeconds ||
        SENTENCE_END.test(previous.text.trim()));

    if (breakHere) {
      groups.push(group);
      group = [];
      chars = 0;
    }

    group.push(word);
    chars += (chars === 0 ? 0 : 1) + word.text.length;
  }
  if (group.length > 0) groups.push(group);

  /* ------------------------------------------ phir unhe cue me badlo */

  return groups.map((words_, index) => {
    const first = words_[0] as TranscriptWord;
    const last = words_[words_.length - 1] as TranscriptWord;

    /*
     * ⚠️ Shuruaat neeche (floor), ant upar (ceil) — Phase 19 wala hi niyam.
     * Dono ko `round` karne par do paas-paas cue ek hi frame par aa sakti hain
     * aur ek chup-chaap gayab ho jaati hai.
     */
    const startFrame = Math.max(
      0,
      Math.floor(secondsToFrames(first.startSeconds - offset, options.fps)),
    );
    const endFrame = Math.max(
      startFrame + 1,
      Math.ceil(secondsToFrames(last.endSeconds - offset, options.fps)),
    );

    const cueWords: CaptionWord[] = words_.map((word) => {
      const wordStart = Math.max(
        startFrame,
        Math.floor(secondsToFrames(word.startSeconds - offset, options.fps)),
      );
      const wordEnd = Math.min(
        endFrame,
        Math.max(wordStart + 1, Math.ceil(secondsToFrames(word.endSeconds - offset, options.fps))),
      );
      return {
        text: word.text,
        startFrame: wordStart,
        endFrame: wordEnd,
        // 23.9 — doc me chalti hai taaki editor kam bharose wale shabd dikha sake.
        confidence: word.confidence,
      };
    });

    return {
      id: options.makeId(index),
      startFrame,
      endFrame,
      text: wrapLines(words_.map((word) => word.text).join(" "), maxChars),
      words: cueWords,
    };
  });
}
