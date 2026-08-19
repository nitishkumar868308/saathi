/**
 * Phase 19 ka asli saboot (19.12) — captions, MP4 se naapi hui.
 *
 * Chaar sawaal:
 *  1. SRT import -> export ka round-trip exact hai?
 *  2. Cue sach me sahi waqt par aata aur jaata hai?
 *  3. Karaoke ka highlight sach me **badalta** hai frame-dar-frame?
 *  4. Devanagari text render me tootta to nahi?
 *
 * ⚠️ Teesra sawaal sabse zaroori hai. "Karaoke laga diya" ka matlab kuch nahi
 * hota agar highlight ek hi shabd par atka rahe — aur wo galti dekh kar bhi
 * pakadni mushkil hai (video chalti rehti hai, bas ek rang nahi hilta). Isliye
 * highlight ki **jagah** naapi jaati hai, sirf uska hona nahi.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  addItem,
  addTrack,
  createEmptyProject,
  createItem,
  cuesFromParsed,
  cuesToSeconds,
  formatSubtitles,
  parseSubtitles,
  safeParseDoc,
  setCaptionStyle,
  setCues,
  type Doc,
} from "@reel/core";
import { ffmpegPath, run } from "@reel/media";

import { RemotionRenderEngine } from "../src/engines/remotion";

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

/** Ek frame me sabse rangeen (highlight wale) pixel ka **beech** kahan hai. */
async function highlightCenter(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
): Promise<{ center: number | null; count: number }> {
  const raw = resolve(scratchDir, `hl-${Math.round(atSeconds * 1000)}.rgb`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(3),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgb24",
    raw,
  ]);
  const bytes = await readFile(raw);
  await rm(raw, { force: true });

  /*
   * Highlight ka rang `brand.accent` (#E0A458) hai — bahut rangeen. Baaki text
   * `brand.text` (#FFF9F0) hai, jo lagbhag safed hai. Isliye "chroma bada hai"
   * se highlight wale pixel alag ho jaate hain, chahe wo kahin bhi hon.
   */
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * 3;
      const r = bytes[offset] ?? 0;
      const g = bytes[offset + 1] ?? 0;
      const b = bytes[offset + 2] ?? 0;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma > 45 && r > 120) {
        sum += x;
        count += 1;
      }
    }
  }
  return { center: count > 0 ? sum / count : null, count };
}

/** Ek row me kitne pixel text ke hain (background se alag). */
async function textPixels(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
): Promise<number> {
  const raw = resolve(scratchDir, `tx-${Math.round(atSeconds * 1000)}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(3),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    raw,
  ]);
  const bytes = await readFile(raw);
  await rm(raw, { force: true });

  let count = 0;
  for (let index = 0; index < width * height; index += 1) {
    if ((bytes[index] ?? 0) > 150) count += 1;
  }
  return count;
}

const SAMPLE_SRT = [
  "1",
  "00:00:00,500 --> 00:00:03,000",
  "Papa ka pension ka kaam",
  "",
  "2",
  "00:00:03,000 --> 00:00:05,500",
  "ab ghar baithe ho jaata hai",
  "",
].join("\n");

const HINDI_SRT = [
  "1",
  "00:00:00,500 --> 00:00:04,000",
  "आपका साथी — मुफ़्त में",
  "",
].join("\n");

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../..");
  const outDir = resolve(root, "render-out", "captions");
  const scratchDir = resolve(root, "render-out", ".scratch-captions");

  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  const publicDir = resolve(scratchDir, "public");
  await mkdir(publicDir, { recursive: true });

  section("1. SRT round-trip (19.5 / 19.12)");
  const parsed = parseSubtitles(SAMPLE_SRT);
  check("SRT padhi gayi", parsed.cues.length === 2 && parsed.problems.length === 0);

  const fps = 30;
  let counter = 0;
  const cues = cuesFromParsed(parsed.cues, { fps, makeId: () => `cue_${(counter += 1)}` });

  const exported = formatSubtitles(cuesToSeconds(cues, { fps }), "srt");
  const back = parseSubtitles(exported).cues;

  const same =
    back.length === parsed.cues.length &&
    back.every(
      (cue, index) =>
        Math.abs(cue.startSeconds - (parsed.cues[index]?.startSeconds ?? -1)) < 1e-6 &&
        Math.abs(cue.endSeconds - (parsed.cues[index]?.endSeconds ?? -1)) < 1e-6 &&
        cue.text === parsed.cues[index]?.text,
    );
  check("import -> export -> import me timing bilkul wahi", same);

  section("2. doc — karaoke captions");
  let doc = createEmptyProject({ name: "Captions test", presetId: "reel", fps });
  doc = addTrack(doc, { typeId: "subtitle" });
  const track = doc.tracks[doc.tracks.length - 1]!;

  const item = createItem("subtitle", {
    fps,
    trackId: track.id,
    name: "Captions",
    startFrame: 0,
    durationInFrames: Math.round(fps * 6),
  });
  doc = addItem(doc, { item });
  doc = setCues(doc, { itemId: item.id, cues });
  doc = setCaptionStyle(doc, { itemId: item.id, styleId: "karaoke" });

  check("doc schema pass karta hai", safeParseDoc(doc).success);

  section("3. render");
  const engine = new RemotionRenderEngine();
  const output = resolve(outDir, "karaoke.mp4");
  await engine.render({
    doc: doc as Doc,
    assets: {},
    publicDir,
    outPath: output,
    preset: "standard",
  });
  check("render hua", existsSync(output), output);

  const { width, height } = doc.project;

  section("4. cue sahi waqt par aata aur jaata hai");
  const before = await textPixels(output, 0.2, width, height, scratchDir);
  const during = await textPixels(output, 1.5, width, height, scratchDir);
  const after = await textPixels(output, 5.8, width, height, scratchDir);

  console.log(`  .. text ke pixels: ${before} (0.2s) -> ${during} (1.5s) -> ${after} (5.8s)`);
  check("pehle cue se pehle koi caption nahi", before < 200, `${before} px`);
  check("cue ke dauraan caption dikhti hai", during > 1000, `${during} px`);
  check("aakhri cue ke baad caption chali jaati hai", after < 200, `${after} px`);

  section("5. karaoke ka highlight sach me badalta hai (19.12)");
  /*
   * Highlight baayein se daayein chalna chahiye. Sirf "highlight hai" naapna
   * kaafi nahi — wo ek hi shabd par atka bhi ho sakta hai, aur video chalti
   * rehti hai to koi pakad nahi paata.
   */
  const samples: { at: number; center: number | null; count: number }[] = [];
  for (const at of [0.7, 1.2, 1.7, 2.2, 2.7]) {
    const measured = await highlightCenter(output, at, width, height, scratchDir);
    samples.push({ at, ...measured });
    console.log(
      `  .. ${at.toFixed(1)}s: highlight ${measured.count} px, beech ${measured.center?.toFixed(0) ?? "—"}`,
    );
  }

  const found = samples.filter((sample) => sample.center !== null);
  check("har sample par highlight mila", found.length === samples.length, `${found.length}/${samples.length}`);

  const centers = found.map((sample) => sample.center as number);
  const moved = Math.max(...centers) - Math.min(...centers);
  check(
    "highlight ek jagah atka nahi — sach me shabd badalta hai",
    moved > width * 0.08,
    `sabse door do jagah ${moved.toFixed(0)}px alag (frame ${width}px chauda)`,
  );

  section("6. Devanagari (19.12)");
  let hindiDoc = createEmptyProject({ name: "Hindi captions", presetId: "reel", fps });
  hindiDoc = addTrack(hindiDoc, { typeId: "subtitle" });
  const hindiTrack = hindiDoc.tracks[hindiDoc.tracks.length - 1]!;

  const hindiItem = createItem("subtitle", {
    fps,
    trackId: hindiTrack.id,
    name: "Hindi captions",
    startFrame: 0,
    durationInFrames: Math.round(fps * 5),
  });
  hindiDoc = addItem(hindiDoc, { item: hindiItem });

  let hindiCounter = 0;
  hindiDoc = setCues(hindiDoc, {
    itemId: hindiItem.id,
    cues: cuesFromParsed(parseSubtitles(HINDI_SRT).cues, {
      fps,
      makeId: () => `hcue_${(hindiCounter += 1)}`,
    }),
  });

  const hindiOut = resolve(outDir, "devanagari.mp4");
  await engine.render({
    doc: hindiDoc as Doc,
    assets: {},
    publicDir,
    outPath: hindiOut,
    preset: "standard",
  });

  const hindiPixels = await textPixels(hindiOut, 2.0, width, height, scratchDir);
  console.log(`  .. Devanagari text ke pixels: ${hindiPixels}`);
  /*
   * ⚠️ Ye check ye **nahi** keh sakta ki akshar sahi bane hain — uske liye aankh
   * chahiye. Par wo ek asli galti zaroor pakadta hai: font me Devanagari na ho to
   * browser tofu (□□□) draw karta hai ya kuch bhi nahi, aur dono me pixels bahut
   * kam aate hain.
   */
  check(
    "Devanagari render me aaya (khaali ya tofu nahi)",
    hindiPixels > 800,
    `${hindiPixels} px — bahut kam hota to font me Devanagari nahi hai`,
  );

  await rm(scratchDir, { recursive: true, force: true });

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (captions)`);
}

void main();
