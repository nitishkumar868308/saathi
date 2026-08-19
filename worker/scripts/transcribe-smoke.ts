/**
 * Auto-captions ka smoke test (23.11 / 23.12).
 *
 * Teen hisse hain aur unhe alag rakhna zaroori hai:
 *
 *  1. **Alignment** (23.5) — ffmpeg se chalta hai, jo maujood hai. Yahan ek aisi
 *     awaaz banayi jaati hai jiska sach **pehle se pata** hai (paanch tone,
 *     jinke start/end hum khud tay karte hain), aur phir naapa jaata hai ki
 *     alignment kitni door girti hai. Bina jaane-hue sach ke "accuracy" naapna
 *     ho hi nahi sakta — isliye synthetic audio, asli recording nahi.
 *  2. **Cue banana + Hinglish** — poora pure TS, hamesha chalta hai.
 *  3. **whisper** — ise `faster-whisper` chahiye. Na ho to ye hissa **saaf
 *     skip** hota hai. Use fail banana galat hoga: baaki sab uspar nahi tika.
 *
 * Chalao:
 *   npm run transcribe:smoke --workspace @reel/worker
 *   npm run transcribe:smoke --workspace @reel/worker -- --audio voice.wav --lang hi
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  alignWords,
  buildCues,
  cuesToSeconds,
  devanagariToLatin,
  formatSubtitles,
  isLowConfidence,
  removeFillers,
  type TranscriptWord,
} from "@reel/core";
import {
  detectSpeechSegments,
  ffmpegPath,
  run,
  transcribe,
  whisperAvailable,
  DEFAULT_WHISPER_MODEL,
} from "@reel/media";

let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  failures.push(label);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function parseArgs(argv: readonly string[]): { audio: string | null; lang: string } {
  let audio: string | null = null;
  let lang = "hi";
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--audio" && argv[index + 1]) audio = argv[index + 1] as string;
    if (argv[index] === "--lang" && argv[index + 1]) lang = argv[index + 1] as string;
  }
  return { audio, lang };
}

/* ------------------------------------------------------------------ setup */

/** Paanch "shabd" — tone — jinka sach hum khud tay kar rahe hain. */
const LEAD_SILENCE = 1.0;
const BURST = 0.5;
const GAP = 0.5;
const TRUTH = [0, 1, 2, 3, 4].map((index) => ({
  startSeconds: LEAD_SILENCE + index * (BURST + GAP),
  endSeconds: LEAD_SILENCE + index * (BURST + GAP) + BURST,
}));
const WORDS = ["ek", "do", "teen", "chaar", "paanch"];

/**
 * Jaan-boojhkar banayi hui awaaz.
 *
 * ⚠️ Tone hai, bolna nahi — aur wahi chahiye. Asli recording par "kitni door
 * gira" naapne ke liye pehle kisi insaan ko haath se har shabd ka waqt likhna
 * padta; tone me sach ganit se aata hai.
 */
async function makeKnownAudio(dir: string, outPath: string): Promise<void> {
  const parts: string[] = [];

  const silence = resolve(dir, "silence.wav");
  const tone = resolve(dir, "tone.wav");
  const gap = resolve(dir, "gap.wav");

  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `anullsrc=r=48000:cl=mono`,
    "-t", String(LEAD_SILENCE), silence,
  ]);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `sine=frequency=220:sample_rate=48000`,
    "-t", String(BURST), tone,
  ]);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `anullsrc=r=48000:cl=mono`,
    "-t", String(GAP), gap,
  ]);

  parts.push(silence);
  for (let index = 0; index < TRUTH.length; index += 1) {
    parts.push(tone, gap);
  }

  const listPath = resolve(dir, "concat.txt");
  await writeFile(
    listPath,
    parts.map((part) => `file '${part.replace(/\\/g, "/")}'`).join("\n"),
    "utf8",
  );

  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-c", "copy", outPath,
  ]);
}

function maxError(words: readonly TranscriptWord[]): { start: number; end: number } {
  let start = 0;
  let end = 0;
  words.forEach((word, index) => {
    const truth = TRUTH[index];
    if (!truth) return;
    start = Math.max(start, Math.abs(word.startSeconds - truth.startSeconds));
    end = Math.max(end, Math.abs(word.endSeconds - truth.endSeconds));
  });
  return { start, end };
}

/* ------------------------------------------------------------------- main */

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../..");
  const outDir = resolve(root, "render-out", "captions");
  const scratchDir = resolve(root, "render-out", ".scratch-captions");

  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const audioPath = resolve(scratchDir, "known.wav");
  await makeKnownAudio(scratchDir, audioPath);

  /* --------------------------------------------------- 1. speech segments */

  section("1. bolne wale hisse pakde gaye? (23.5)");

  const detected = await detectSpeechSegments(audioPath, { noiseDb: -35, minSilenceSeconds: 0.2 });
  console.log(`  .. lambai: ${detected.durationSeconds.toFixed(2)}s, ${detected.segments.length} segment`);
  for (const [index, segment] of detected.segments.entries()) {
    const truth = TRUTH[index];
    console.log(
      `  .. ${index + 1}: ${segment.startSeconds.toFixed(3)}–${segment.endSeconds.toFixed(3)}s` +
        (truth ? `   (sach: ${truth.startSeconds.toFixed(3)}–${truth.endSeconds.toFixed(3)})` : ""),
    );
  }

  check("paanch bolne wale hisse mile", detected.segments.length === TRUTH.length, `${detected.segments.length}`);

  let segmentError = 0;
  detected.segments.forEach((segment, index) => {
    const truth = TRUTH[index];
    if (!truth) return;
    segmentError = Math.max(
      segmentError,
      Math.abs(segment.startSeconds - truth.startSeconds),
      Math.abs(segment.endSeconds - truth.endSeconds),
    );
  });
  check("segment ki seemaayein sach ke paas hain", segmentError < 0.06, `sabse badi galti ${(segmentError * 1000).toFixed(0)}ms`);

  /* ---------------------------------------------------- 2. alignment (23.5) */

  section("2. alignment — chuppi ka naksha kitna farak laata hai (23.5 / 23.12)");

  const text = WORDS.join(" ");

  const naive = alignWords({ text, durationSeconds: detected.durationSeconds });
  const smart = alignWords({
    text,
    durationSeconds: detected.durationSeconds,
    segments: detected.segments,
  });

  const naiveError = maxError(naive);
  const smartError = maxError(smart);

  console.log(`  .. seedhi baant (chuppi nahi dekhi): start ${(naiveError.start * 1000).toFixed(0)}ms, end ${(naiveError.end * 1000).toFixed(0)}ms`);
  console.log(`  .. chuppi ka naksha lagakar    : start ${(smartError.start * 1000).toFixed(0)}ms, end ${(smartError.end * 1000).toFixed(0)}ms`);
  for (const [index, word] of smart.entries()) {
    const truth = TRUTH[index] as { startSeconds: number; endSeconds: number };
    console.log(
      `  .. ${word.text.padEnd(6)} ${word.startSeconds.toFixed(3)}–${word.endSeconds.toFixed(3)}s   (sach: ${truth.startSeconds.toFixed(3)}–${truth.endSeconds.toFixed(3)})`,
    );
  }

  check("chuppi ka naksha lagane se timing sudhri", smartError.start < naiveError.start, `${(naiveError.start * 1000).toFixed(0)}ms -> ${(smartError.start * 1000).toFixed(0)}ms`);
  check("har shabd apne hi tone par baitha", smartError.start < 0.08 && smartError.end < 0.08, `sabse badi galti ${(Math.max(smartError.start, smartError.end) * 1000).toFixed(0)}ms`);
  check(
    "shabd chuppi me nahi gire",
    smart.every((word) =>
      detected.segments.some(
        (segment) => word.startSeconds >= segment.startSeconds - 0.02 && word.startSeconds < segment.endSeconds + 0.02,
      ),
    ),
  );
  check("aligned transcript me confidence jhooth nahi bolta", smart.every((word) => word.confidence === null));

  /* -------------------------------------------------- 3. cue banana (23.6) */

  section("3. shabdon se cues (23.6 / 23.7)");

  const fps = 30;
  const cues = buildCues(smart, { fps, makeId: (index) => `cue_${index}` });
  console.log(`  .. ${cues.length} cue bani`);

  check("cue bani", cues.length > 0, `${cues.length}`);
  check(
    "har cue me asli word timing hai (andaaza nahi)",
    cues.every((cue) => cue.words.length > 0),
  );
  check(
    "cue ke andar hi shabd hain",
    cues.every((cue) => cue.words.every((word) => word.startFrame >= cue.startFrame && word.endFrame <= cue.endFrame)),
  );
  check(
    "cue aapas me nahi takraatin",
    cues.every((cue, index) => index === 0 || cue.startFrame >= (cues[index - 1] as { endFrame: number }).endFrame),
  );

  const srt = formatSubtitles(cuesToSeconds(cues, { fps }), "srt");
  const srtPath = resolve(outDir, "known.srt");
  await writeFile(srtPath, srt, "utf8");
  console.log("  .. bani hui SRT:");
  for (const line of srt.trimEnd().split("\n")) console.log(`     ${line}`);

  const withFillers: TranscriptWord[] = [
    { text: "um", startSeconds: 0, endSeconds: 0.2, confidence: 0.4 },
    { text: "Papa", startSeconds: 0.2, endSeconds: 0.6, confidence: 0.95 },
    { text: "Papa", startSeconds: 0.6, endSeconds: 0.9, confidence: 0.9 },
    { text: "suno", startSeconds: 0.9, endSeconds: 1.3, confidence: 0.5 },
  ];
  const cleaned = removeFillers(withFillers);
  check("filler nikla aur dohraya shabd juda", cleaned.length === 2, cleaned.map((word) => word.text).join(" "));
  check("kam bharose wale shabd pakde gaye (23.9)", withFillers.filter(isLowConfidence).length === 2);

  /* ------------------------------------------------------- 4. Hinglish (23.4) */

  section("4. Devanagari se Hinglish (23.4)");

  const samples: [string, string][] = [
    ["नमस्ते", "namaste"],
    ["कमल", "kamal"],
    ["राम", "raam"],
    ["घर", "ghar"],
    ["दस्तावेज़", "dastaavez"],
    ["आज", "aaj"],
    ["क्या", "kya"],
    ["मैं ghar जा रहा हूँ", "main ghar ja raha hoon"],
  ];
  let matched = 0;
  for (const [deva, expected] of samples) {
    const got = devanagariToLatin(deva);
    const ok = got === expected;
    if (ok) matched += 1;
    console.log(`  .. ${deva.padEnd(20)} -> ${got}${ok ? "" : `   (socha tha: ${expected})`}`);
  }
  check("Hinglish transliteration ke namoone mile", matched === samples.length, `${matched}/${samples.length}`);

  /* --------------------------------------------------------- 5. whisper */

  section(`5. whisper (23.2 / 23.3)`);

  const available = await whisperAvailable();
  if (!available.ok) {
    console.log("  SKIP faster-whisper nahi mila — auto captions abhi nahi ban sakti.");
    console.log("       install:  pip install faster-whisper");
    console.log('       jaancho:  python -c "import faster_whisper; print(faster_whisper.__version__)"');
    console.log(`       (${available.detail.split("\n")[0]})`);
  } else if (!args.audio) {
    console.log(`  SKIP faster-whisper mila (${available.detail}) par koi asli awaaz nahi di gayi.`);
    console.log("       chalao:  npm run transcribe:smoke --workspace @reel/worker -- --audio voice.wav --lang hi");
  } else {
    const result = await transcribe({
      audioPath: args.audio,
      language: args.lang,
      model: DEFAULT_WHISPER_MODEL,
      scratchDir,
    });
    console.log(`  .. model ${result.model}, bhasha ${result.language}, ${result.words.length} shabd`);
    console.log(`  .. ${result.durationSeconds.toFixed(1)}s audio par ${(result.elapsedMs / 1000).toFixed(1)}s laga (${(result.elapsedMs / 1000 / Math.max(0.001, result.durationSeconds)).toFixed(2)}x)`);
    const low = result.words.filter(isLowConfidence).length;
    console.log(`  .. ${low} shabd kam bharose ke (23.9)`);

    const realCues = buildCues(
      result.words.map((word) => ({ ...word })),
      { fps, makeId: (index) => `w_${index}` },
    );
    const realSrt = formatSubtitles(cuesToSeconds(realCues, { fps }), "srt");
    await writeFile(resolve(outDir, "whisper.srt"), realSrt, "utf8");
    console.log(`  .. ${realCues.length} cue → render-out/captions/whisper.srt`);

    check("whisper se shabd aaye", result.words.length > 0);
    check("per-word timing aayi", result.words.every((word) => word.endSeconds > word.startSeconds));
  }

  /* ----------------------------------------------------------------- end */

  await rm(scratchDir, { recursive: true, force: true }).catch(() => {});

  console.log("");
  if (failures.length > 0) {
    console.log(`FAIL: ${failures.length} — ${failures.join(" | ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (captions)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
