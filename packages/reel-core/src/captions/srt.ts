/**
 * SRT / VTT import-export (19.4 / 19.5).
 *
 * ⚠️ Do format hain par ek hi parser, aur ye jaan-boojhkar hai. SRT aur VTT me
 * asli farak sirf teen cheezon ka hai: header, timestamp me `,` ya `.`, aur
 * cue ke numbers. Do alag parser rakhne par ek din SRT me ek bug theek hota aur
 * VTT me wahi bug pada rehta — aur user ke liye dono "captions" hi hain.
 */

export interface ParsedCue {
  /** Seconds me — frames me badalna caller ka kaam hai (fps yahan nahi aata). */
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface ParseResult {
  cues: ParsedCue[];
  /** Jo lines samajh nahi aayi — chup-chaap chhodna galat hota. */
  problems: string[];
}

/**
 * `00:01:23,456` ya `00:01:23.456` ya `01:23.456` -> seconds.
 *
 * Ghante wala hissa optional hai: bahut se tools (aur haath se likhi files)
 * chhoti clip ke liye `01:23.456` likhte hain. Use na maanne par poori file
 * "galat format" ban jaati hai jabki wo bilkul theek hai.
 */
export function parseTimestamp(value: string): number | null {
  const cleaned = value.trim().replace(",", ".");
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)$/.exec(cleaned);
  if (!match) return null;

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

/** Seconds -> `00:01:23,456` (SRT) ya `00:01:23.456` (VTT). */
export function formatTimestamp(seconds: number, format: "srt" | "vtt"): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  const whole = Math.floor(rest);
  const millis = Math.round((rest - whole) * 1000);

  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  const separator = format === "srt" ? "," : ".";
  return `${pad(hours)}:${pad(minutes)}:${pad(whole)}${separator}${pad(millis, 3)}`;
}

/**
 * SRT ya VTT padho — format apne aap pehchana jaata hai.
 *
 * ⚠️ **BOM zaroor hataya jaata hai.** UTF-8 BOM (`﻿`) Windows ke tools se
 * aayi har doosri file me hota hai, aur uske rehte pehla cue ka number parse
 * nahi hota — nateeja: poori file ka pehla caption chup-chaap gayab. Ye galti
 * sirf tab dikhti hai jab koi ginti kare.
 */
export function parseSubtitles(input: string): ParseResult {
  const cues: ParsedCue[] = [];
  const problems: string[] = [];

  const text = input
    .replace(/^﻿/, "")
    // CRLF aur akela CR dono — Mac ke purane tools abhi bhi CR bhejte hain.
    .replace(/\r\n?/g, "\n");

  // WEBVTT header aur uske baad ka metadata block chhod do.
  const body = text.startsWith("WEBVTT") ? text.slice(text.indexOf("\n") + 1) : text;

  for (const rawBlock of body.split(/\n{2,}/)) {
    const block = rawBlock.trim();
    if (!block) continue;
    // VTT ke NOTE / STYLE / REGION block — inme cue hota hi nahi.
    if (/^(NOTE|STYLE|REGION)\b/.test(block)) continue;

    const lines = block.split("\n");
    let at = 0;

    // Pehli line sirf ginti ho to wo cue ka number hai (SRT), timing nahi.
    if (lines[at] !== undefined && /^\d+$/.test((lines[at] as string).trim())) at += 1;

    const timingLine = lines[at];
    if (timingLine === undefined) {
      problems.push(`Timing wali line nahi mili: "${block.slice(0, 40)}"`);
      continue;
    }

    const arrow = timingLine.split("-->");
    if (arrow.length !== 2) {
      problems.push(`Timing samajh nahi aayi: "${timingLine.trim()}"`);
      continue;
    }

    const startSeconds = parseTimestamp(arrow[0] as string);
    /*
     * VTT me timing ke baad settings ho sakti hain (`align:start line:90%`).
     *
     * ⚠️ `trim()` pehle zaroori hai. `" 00:00:03,500"` ko seedha `split(/\s+/)`
     * karne par pehla tukda **khaali string** aata hai, aur poori file "timing
     * padhi nahi ja saki" bankar reject ho jaati hai — jabki wo bilkul theek hai.
     */
    const endSeconds = parseTimestamp((arrow[1] as string).trim().split(/\s+/)[0] ?? "");

    if (startSeconds === null || endSeconds === null) {
      problems.push(`Timing padhi nahi ja saki: "${timingLine.trim()}"`);
      continue;
    }

    const cueText = lines
      .slice(at + 1)
      .join("\n")
      .trim();
    if (!cueText) {
      problems.push(`Khaali cue ${formatTimestamp(startSeconds, "srt")} par`);
      continue;
    }

    /*
     * Ulta ya zero-lambai cue chhod dete hain. Wo file me hote hain (tools ki
     * galti se) aur unhe rakhne par timeline par ek aisa block banta hai jise
     * pakadna hi mumkin nahi — user use na hata sakta hai na badal sakta.
     */
    if (endSeconds <= startSeconds) {
      problems.push(
        `Cue ka ant shuruaat se pehle ya barabar hai (${formatTimestamp(startSeconds, "srt")}) — chhod diya`,
      );
      continue;
    }

    cues.push({ startSeconds, endSeconds, text: cueText });
  }

  cues.sort((a, b) => a.startSeconds - b.startSeconds);
  return { cues, problems };
}

/**
 * Cues se SRT / VTT banao.
 *
 * ⚠️ SRT me cue ke numbers **1 se** shuru hote hain aur lagataar hone chahiye.
 * Kuch players 0 se shuru hone par pehla caption chhod dete hain — ye unki galti
 * hai par usse ladna bekaar hai, 1 se shuru karna aasan hai.
 */
export function formatSubtitles(
  cues: readonly { startSeconds: number; endSeconds: number; text: string }[],
  format: "srt" | "vtt",
): string {
  const blocks = cues.map((cue, index) => {
    const timing = `${formatTimestamp(cue.startSeconds, format)} --> ${formatTimestamp(cue.endSeconds, format)}`;
    return format === "srt"
      ? `${index + 1}\n${timing}\n${cue.text}`
      : `${timing}\n${cue.text}`;
  });

  const body = blocks.join("\n\n");
  // Aakhri newline: bahut se parser (aur ffmpeg) uske bina aakhri cue chhod dete hain.
  return format === "vtt" ? `WEBVTT\n\n${body}\n` : `${body}\n`;
}
