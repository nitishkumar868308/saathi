import { z } from "zod";

import { FrameSchema } from "../schema/project";
import { secondsToFrames } from "../time";
import type { ParsedCue } from "./srt";

/**
 * Caption cues (19.1 / 19.8).
 *
 * ⚠️ Cue ke frames **item-local** hain, doc ke nahi — bilkul keyframes ki tarah.
 * Doc ke frames rakhne par subtitle item ko timeline par khiskane se saare cues
 * apni jagah reh jaate aur captions video se alag ho jaate. Item-local hone se
 * khiskana apne aap sahi rehta hai.
 */

export const CaptionWordSchema = z.object({
  text: z.string(),
  startFrame: FrameSchema,
  endFrame: FrameSchema,
});

export const CaptionCueSchema = z.object({
  id: z.string().min(1),
  startFrame: FrameSchema,
  endFrame: FrameSchema,
  text: z.string(),
  /**
   * Per-word timing (karaoke ke liye).
   *
   * Khaali hone par `estimateWords()` andaaza lagata hai — aur UI me wo saaf
   * likha jaata hai ki ye andaaza hai. Andaaze ko asli timing ki tarah dikhana
   * sabse bura hota: user use theek karne ki koshish nahi karta aur video me
   * highlight hamesha thoda aage-peeche rehta hai.
   */
  words: z.array(CaptionWordSchema).default([]),
});

export type CaptionWord = z.infer<typeof CaptionWordSchema>;
export type CaptionCue = z.infer<typeof CaptionCueSchema>;

/** Reels ke liye default hadd — config se, kahin likhi hui nahi. */
export const CAPTION_MAX_LINES = 2;
export const CAPTION_MAX_CHARS_PER_LINE = 32;

/**
 * Cue padhne layak hai? (19.2)
 *
 * ⚠️ Ye **hadd nahi lagata**, sirf batata hai. Reels me lambi caption ek asli
 * dikkat hai (do line se zyada padhne ka waqt hi nahi milta), par user ko rokna
 * galat hoga — kabhi-kabhi lambi line hi sahi hoti hai. Batana aur rokna do alag
 * cheezein hain.
 */
export function cueProblems(cue: { text: string }): string[] {
  const problems: string[] = [];
  const lines = cue.text.split("\n");

  if (lines.length > CAPTION_MAX_LINES) {
    problems.push(`${lines.length} line hain — reels me ${CAPTION_MAX_LINES} se zyada padhi nahi jaati`);
  }
  for (const line of lines) {
    if (line.length > CAPTION_MAX_CHARS_PER_LINE) {
      problems.push(`Ek line ${line.length} akshar ki hai (${CAPTION_MAX_CHARS_PER_LINE} tak theek)`);
      break;
    }
  }
  return problems;
}

/**
 * Word timing ka andaaza (19.8).
 *
 * ⚠️ Ye **andaaza** hai, naap nahi — aur ye baat UI me bhi likhi hai. Har shabd
 * ko uski lambai ke hisaab se waqt milta hai, kyunki lamba shabd bolne me zyada
 * waqt leta hai. Har shabd ko barabar waqt dena aur bhi kharab hota: "aur" aur
 * "vyavastha" ko ek jitna waqt dene par highlight saaf peeche chalta dikhta hai.
 *
 * Asli word timing Phase 23 (auto-captions) me aayegi.
 */
export function estimateWords(cue: {
  text: string;
  startFrame: number;
  endFrame: number;
}): CaptionWord[] {
  const words = cue.text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const total = Math.max(1, cue.endFrame - cue.startFrame);
  // Har shabd ke saath ek "saans" — bina iske lambe shabd poora waqt kha jaate
  // hain aur chhote shabd ek frame me nikal jaate hain.
  const weights = words.map((word) => word.length + 1);
  const sum = weights.reduce((a, b) => a + b, 0);

  const out: CaptionWord[] = [];
  let at = cue.startFrame;

  words.forEach((word, index) => {
    const share = (weights[index] as number) / sum;
    // Aakhri shabd theek `endFrame` par khatam ho — jodte-jodte aane wali
    // rounding ki galti wahin sudhar jaati hai.
    const end =
      index === words.length - 1 ? cue.endFrame : Math.round(at + total * share);
    out.push({ text: word, startFrame: at, endFrame: Math.max(at + 1, end) });
    at = Math.max(at + 1, end);
  });

  return out;
}

/** Kis shabd par abhi highlight hai? `-1` = kisi par nahi. */
export function activeWordIndex(words: readonly CaptionWord[], localFrame: number): number {
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] as CaptionWord;
    if (localFrame >= word.startFrame && localFrame < word.endFrame) return index;
  }
  return -1;
}

/** Is frame par kaun sa cue dikh raha hai? */
export function cueAt(cues: readonly CaptionCue[], localFrame: number): CaptionCue | null {
  return (
    cues.find((cue) => localFrame >= cue.startFrame && localFrame < cue.endFrame) ?? null
  );
}

/**
 * SRT/VTT se aaye cues ko item ke frames me badlo (19.4).
 *
 * ⚠️ Rounding ka niyam saaf hona chahiye aur wo yahan likha hai: **shuruaat
 * neeche (floor), ant upar (ceil)**. Dono ko `round` karne par do paas-paas cue
 * ek hi frame par aa sakte hain aur ek chup-chaap gayab ho jaata hai. Neeche-upar
 * karne se cue kabhi chhota nahi hota — zyada se zyada ek frame lamba hota hai,
 * jo dikhta bhi nahi.
 */
export function cuesFromParsed(
  parsed: readonly ParsedCue[],
  args: { fps: number; offsetSeconds?: number; makeId: () => string },
): CaptionCue[] {
  const offset = args.offsetSeconds ?? 0;

  return parsed.map((cue) => {
    const startFrame = Math.max(
      0,
      Math.floor(secondsToFrames(cue.startSeconds - offset, args.fps)),
    );
    const endFrame = Math.max(
      startFrame + 1,
      Math.ceil(secondsToFrames(cue.endSeconds - offset, args.fps)),
    );
    return { id: args.makeId(), startFrame, endFrame, text: cue.text, words: [] };
  });
}

/** Cues ko wapas seconds me — export ke liye (19.5). */
export function cuesToSeconds(
  cues: readonly CaptionCue[],
  args: { fps: number; offsetSeconds?: number },
): { startSeconds: number; endSeconds: number; text: string }[] {
  const offset = args.offsetSeconds ?? 0;
  return [...cues]
    .sort((a, b) => a.startFrame - b.startFrame)
    .map((cue) => ({
      startSeconds: offset + cue.startFrame / args.fps,
      endSeconds: offset + cue.endFrame / args.fps,
      text: cue.text,
    }));
}

/**
 * Cue ko playhead par todo (19.2).
 *
 * Text ko bhi baantna padta hai, sirf timing ko nahi — warna dono tukdon par
 * poori line dikhti hai aur wo saaf galat lagta hai. Baantne ki jagah shabdon ke
 * hisaab se nikalti hai: cue me kitna waqt beeta, utne hi shabd pehle tukde me.
 */
export function splitCue(
  cue: CaptionCue,
  atFrame: number,
  makeId: () => string,
): [CaptionCue, CaptionCue] | null {
  if (atFrame <= cue.startFrame || atFrame >= cue.endFrame) return null;

  const words = cue.text.split(/\s+/).filter(Boolean);
  const progress = (atFrame - cue.startFrame) / (cue.endFrame - cue.startFrame);
  const at = Math.max(1, Math.min(words.length - 1, Math.round(words.length * progress)));

  const left: CaptionCue = {
    ...cue,
    endFrame: atFrame,
    text: words.slice(0, at).join(" ") || cue.text,
    words: [],
  };
  const right: CaptionCue = {
    id: makeId(),
    startFrame: atFrame,
    endFrame: cue.endFrame,
    text: words.slice(at).join(" ") || cue.text,
    words: [],
  };
  return [left, right];
}

/** Do cue jodo — beech ka gap bhi jud jaata hai. */
export function mergeCues(first: CaptionCue, second: CaptionCue): CaptionCue {
  const [a, b] = first.startFrame <= second.startFrame ? [first, second] : [second, first];
  return {
    ...a,
    endFrame: Math.max(a.endFrame, b.endFrame),
    text: `${a.text} ${b.text}`.trim(),
    // Jude hue cue ka word timing bekaar ho jaata hai — dobara andaaza lagega.
    words: [],
  };
}
