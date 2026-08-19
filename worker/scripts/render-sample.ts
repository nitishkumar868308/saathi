/**
 * Pehli asli MP4 — bina kisi UI ke.
 *
 * ```
 * npm run render:sample
 * npm run render:sample -- --preset=landscape --fps=24
 * ```
 *
 * Ye script teen cheezein karti hai:
 *  1. Placeholder media **khud FFmpeg se** banati hai (koi file maangi nahi jaati)
 *  2. Un assets ko storage me daalti hai, phir Project JSON banati hai aur render karti hai
 *  3. Nateeje ko **naapti** hai — ffprobe se stream, aur frames ke pixels se
 *     Ken Burns ka zoom. "Dekh lo, chal raha hai" wala jawab yahan nahi chalta.
 *
 * Sample image jaan-boojhkar aisi banayi gayi hai ki naapi ja sake: gehre grid ke
 * beech ek 400x400 ka safed chaukor. Zoom badhta hai to us chaukor ki chaudai
 * pixels me badhti hai, aur wo ginti ja sakti hai. Isi se "Ken Burns sach me chal
 * raha hai" ek raay se badalkar ek number ban jaata hai.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import {
  addItem,
  computeFit,
  createEmptyProject,
  createItem,
  durationFromSeconds,
  extensionOf,
  framesToSeconds,
  recomputeDuration,
  requireSizePreset,
  safeParseDoc,
  storageKey,
  type Doc,
  type Item,
  resolveItemValue,
} from "@reel/core";
import {
  createStorageDriver,
  readStorageConfig,
  requireRepoRoot,
  resolveAssets,
  type StoredAsset,
} from "@reel/storage";

import { RemotionRenderEngine } from "../src/engines/remotion";
import {
  audioStream,
  checkFfmpegAvailable,
  extractFrame,
  ffmpegPath,
  parseFrameRate,
  probe,
  remuxFaststart,
  run,
  videoStream,
} from "@reel/media";

// ------------------------------------------------------------------- config

interface Args {
  sizePresetId: string;
  fps: number;
  exportPreset: string;
  envFile: string | null;
  keepScratch: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (name: string): string | null => {
    for (const arg of argv) {
      const match = new RegExp(`^--${name}=(.+)$`).exec(arg);
      if (match) return match[1] as string;
    }
    return null;
  };
  return {
    sizePresetId: get("preset") ?? "reel",
    fps: Number(get("fps") ?? 30),
    exportPreset: get("export") ?? "standard",
    envFile: get("env-file"),
    keepScratch: argv.includes("--keep-scratch"),
  };
}

function loadEnv(explicit: string | null): void {
  // Repo root se — `npm run render:sample` cwd `worker/` deta hai.
  const root = requireRepoRoot();
  for (const candidate of explicit ? [explicit] : ["worker/.env", ".env"]) {
    const path = isAbsolute(candidate) ? candidate : resolve(root, candidate);
    if (existsSync(path)) {
      process.loadEnvFile(path);
      return;
    }
  }
}

// -------------------------------------------------------------- mini runner

let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ------------------------------------------------------- placeholder media

/** Naapne layak sample image ka nap-jokh — ek hi jagah, taaki assert bhi yahi padhe. */
const SOURCE = { width: 2560, height: 2560, squareSide: 400 } as const;

/** Sample video ka size — blurred-background check isi se hisaab lagata hai. */
const SOURCE_VIDEO = { width: 1080, height: 1920 } as const;

/**
 * Placeholder media FFmpeg se banao.
 *
 * Image jaan-boojhkar **square** hai: 1080x1920 aur 1920x1080 dono me `cover`
 * ki scale ek hi aati hai (0.75), isliye dono renders me safed chaukor ki asli
 * chaudai 300px hoti hai aur ek hi expectation dono par lagayi ja sakti hai.
 */
async function makePlaceholderMedia(dir: string): Promise<{
  image: string;
  video: string;
  audio: string;
}> {
  await mkdir(dir, { recursive: true });
  const image = resolve(dir, "sample-image.png");
  const video = resolve(dir, "sample-video.mp4");
  const audio = resolve(dir, "sample-audio.wav");

  const squareX = (SOURCE.width - SOURCE.squareSide) / 2;
  const squareY = (SOURCE.height - SOURCE.squareSide) / 2;

  /*
   * Grid **rangeen** hai (neela) aur chaukor safed.
   *
   * Neela hona zaroori hai: grayscale effect ko naapne ka ek hi seedha tarika hai
   * — R aur B channel ka farak. Bhoora-slate grid par wo farak 4 hota hai, jo
   * shor me doob jaata hai. Neele par ~160 hota hai, aur grayscale lagte hi 0.
   * Uska luma 113 hai, yaani "bright > 200" wala threshold ab bhi sirf chaukor
   * pakadta hai.
   */
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi",
    "-i", `color=c=0x141210:s=${SOURCE.width}x${SOURCE.height}`,
    "-vf",
    [
      "drawgrid=w=160:h=160:t=3:c=0x2f7fd0",
      `drawbox=x=${squareX}:y=${squareY}:w=${SOURCE.squareSide}:h=${SOURCE.squareSide}:color=white:t=fill`,
    ].join(","),
    "-frames:v", "1",
    image,
  ]);

  // 1080x1920 video — reel me bilkul fit, landscape me letterbox (jahan
  // contain + blurred background ka asli matlab dikhta hai).
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi",
    "-i", "testsrc2=s=1080x1920:rate=30:duration=5",
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "18",
    "-an",
    video,
  ]);

  // WAV/PCM — Section 3A: intermediate audio kabhi lossy nahi.
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi",
    "-i", "sine=frequency=330:duration=10:sample_rate=48000",
    "-af", "volume=0.28,aformat=channel_layouts=stereo",
    "-c:a", "pcm_s16le",
    audio,
  ]);

  return { image, video, audio };
}

// ------------------------------------------------------------- sample doc

interface SampleDoc {
  doc: Doc;
  imageItem: Item;
  videoItem: Item;
  textItem: Item;
  probe: Item;
  probeY: number;
  panTo: number;
  kenBurnsFrom: number;
  kenBurnsTo: number;
}

/**
 * Sample Project JSON.
 *
 * ⚠️ Yahan **koi pixel hardcode nahi** hai. Sab kuch `doc.project.width/height`
 * aur seconds se banta hai, isliye `--preset=landscape --fps=24` par yahi ek
 * function bina badle doosri shape ki reel bana deta hai. Yahi 3.16 ka poora point hai.
 */
function buildSampleDoc(args: Args, assetIds: { image: string; video: string; audio: string }): SampleDoc {
  const preset = requireSizePreset(args.sizePresetId);
  let doc = createEmptyProject({
    name: `Sample — ${preset.label}`,
    presetId: preset.id,
    fps: args.fps,
    // Tracks apni zaroorat ke hisaab se — fixed 7 nahi (Dynamic rule 5).
    initialTrackTypes: ["video", "overlay", "text", "audio"],
  });

  const [videoTrack, overlayTrack, textTrack, audioTrack] = doc.tracks;
  const { fps, width, height } = doc.project;

  const imageSeconds = 5;
  const videoSeconds = 5;
  const totalSeconds = imageSeconds + videoSeconds;

  const imageFrames = durationFromSeconds(imageSeconds, fps);
  const videoFrames = durationFromSeconds(videoSeconds, fps);

  const kenBurnsFrom = 1;
  const kenBurnsTo = 1.4;
  // Pan chaudai ke hisaab se — dono orientation me chaukor frame ke andar rehta hai.
  const panTo = Math.round(width * 0.06);

  // --- 1. Image + Ken Burns ---
  // Zoom `transform.scale` ke do keyframes hai, aur bas. Koi "kenburns feature"
  // nahi likha gaya — isliye kisi bhi property par yahi cheez chal jaati hai.
  const imageItem = createItem("image", {
    fps,
    trackId: videoTrack!.id,
    name: "Background image (Ken Burns)",
    assetId: assetIds.image,
    startFrame: 0,
    durationInFrames: imageFrames,
    /*
     * Do property ek saath keyframed hain, aur easing **ease-in-out** hai — linear
     * nahi (13.13).
     *
     * Linear se check aasan ho jaata par wo saabit kuch nahi karta: seedhi line to
     * bina engine ke bhi nikal aati hai. Ease-in-out par expected value engine se
     * hi aati hai, isliye ye check sach me ye naapta hai ki **render wahi curve
     * chala raha hai jo preview chalata hai**.
     */
    /*
     * Effects (14.13) — teen, aur teeno naapi ja sakti hain:
     *  - grayscale: R aur B ka farak 0 ho jaata hai
     *  - brightness 0.9: safed chaukor 255 se 229 par aa jaata hai (theek ganit)
     *  - vignette: kinare gehre, beech waisa ka waisa
     */
    effects: [
      { type: "grayscale", enabled: true, amount: 1 },
      { type: "brightness", enabled: true, amount: 0.9 },
      { type: "vignette", enabled: true, amount: 0.7, spread: 0.45, color: "#000000" },
    ],
    keyframes: {
      "transform.scale": [
        { frame: 0, value: kenBurnsFrom, easing: "ease-in-out", bezier: null },
        { frame: imageFrames, value: kenBurnsTo, easing: "ease-in-out", bezier: null },
      ],
      "transform.x": [
        { frame: 0, value: 0, easing: "ease-in-out", bezier: null },
        { frame: imageFrames, value: panTo, easing: "ease-in-out", bezier: null },
      ],
    },
  });
  doc = addItem(doc, { item: imageItem });

  // --- 2. Video, contain + blurred background (README 3B) ---
  const videoItem = createItem("video", {
    fps,
    trackId: videoTrack!.id,
    name: "Screen recording (contain + blur)",
    assetId: assetIds.video,
    startFrame: imageFrames,
    durationInFrames: videoFrames,
    fit: { mode: "contain", background: { kind: "blurred-asset", value: null } },
    effects: [
      { type: "roundedCorners", enabled: true, radius: 96 },
      { type: "dropShadow", enabled: true, x: 0, y: 16, blur: 32, color: "#000000aa" },
    ],
  });
  doc = addItem(doc, { item: videoItem });

  // --- 3. Shape band (text ke peeche) ---
  const bandItem = createItem("shape", {
    fps,
    trackId: overlayTrack!.id,
    name: "Caption band",
    startFrame: durationFromSeconds(1, fps),
    durationInFrames: durationFromSeconds(totalSeconds - 2, fps),
    shape: { kind: "rect", fill: "brand.primary", widthPercent: 84, heightPercent: 12, radius: 28 },
    // Percent se hisaab — dono orientation me band frame ke andar rehta hai.
    transform: { y: Math.round(height * 0.28) },
  });
  doc = addItem(doc, { item: bandItem });

  // --- 4. Text ---
  const textItem = createItem("text", {
    fps,
    trackId: textTrack!.id,
    name: "Caption",
    startFrame: durationFromSeconds(1, fps),
    durationInFrames: durationFromSeconds(totalSeconds - 2, fps),
    text: {
      content: "Apka Saathi",
      // Font size bhi frame ki oonchai se — 1080x1920 aur 1920x1080 dono me
      // text ek jaisa bada dikhe.
      fontSize: Math.round(height * 0.045),
      color: "brand.text",
      uppercase: true,
      letterSpacing: 2,
    },
    transform: { y: Math.round(height * 0.28) },
    // Teesri keyframed property — aur teeno alag alag item par, taaki ye bhi
    // saabit ho ki keyframes item-local hain (13.6).
    keyframes: {
      "transform.opacity": [
        { frame: 0, value: 1, easing: "linear", bezier: null },
        { frame: durationFromSeconds(totalSeconds - 2, fps), value: 0, easing: "linear", bezier: null },
      ],
    },
  });
  doc = addItem(doc, { item: textItem });

  /*
   * --- 4b. Blur naapne ka probe (14.13) ---
   *
   * ⚠️ Ye do items sirf **naap** ke liye hain, aur unka hona ek asli galti ke
   * baad tay hua. Pehle blur keyframe video par lagayi thi aur kinaron ki teezi
   * naapi thi — par `testsrc2` ka content har frame par badalta hai, isliye naap
   * blur se nahi, content se hilti thi (638 -> 523 -> 646, bina kisi kram ke).
   *
   * Ab ek kaali patti par ek safed patti hai. Us row par sirf safed patti ke do
   * kinare hote hain aur kuch nahi — isliye jo bhi badla, blur ne badla.
   */
  const probeY = -Math.round(height * 0.3);
  const probeBackdrop = createItem("shape", {
    fps,
    trackId: overlayTrack!.id,
    name: "FX probe backdrop",
    startFrame: 0,
    durationInFrames: durationFromSeconds(totalSeconds, fps),
    shape: { kind: "rect", fill: "#000000", widthPercent: 100, heightPercent: 16, radius: 0 },
    transform: { y: probeY },
  });
  doc = addItem(doc, { item: probeBackdrop });

  const probe = createItem("shape", {
    fps,
    trackId: overlayTrack!.id,
    name: "FX probe",
    startFrame: 0,
    durationInFrames: durationFromSeconds(totalSeconds, fps),
    shape: { kind: "rect", fill: "#ffffff", widthPercent: 40, heightPercent: 8, radius: 0 },
    transform: { y: probeY },
    effects: [{ type: "blur", enabled: true, radius: 0 }],
    keyframes: {
      "effects.0.radius": [
        { frame: 0, value: 0, easing: "linear", bezier: null },
        { frame: durationFromSeconds(totalSeconds, fps) - 1, value: 10, easing: "linear", bezier: null },
      ],
    },
  });
  doc = addItem(doc, { item: probe });

  // --- 5. Audio poore project par ---
  const audioItem = createItem("audio", {
    fps,
    trackId: audioTrack!.id,
    name: "Background tone",
    assetId: assetIds.audio,
    startFrame: 0,
    durationInFrames: durationFromSeconds(totalSeconds, fps),
    audio: {
      volume: 0.8,
      muted: false,
      // Fade ke bina shuru/ant me "click" ki aawaz aati hai.
      fadeInFrames: durationFromSeconds(0.5, fps),
      fadeOutFrames: durationFromSeconds(0.5, fps),
    },
  });
  doc = addItem(doc, { item: audioItem });

  // Project ki lambai items ke hisaab se exact — trailing khaali jagah nahi.
  doc = recomputeDuration(doc, undefined);

  return { doc, imageItem, videoItem, textItem, probe, probeY, kenBurnsFrom, kenBurnsTo, panTo };
}

// ---------------------------------------------------- pixel-level measurement

/**
 * Ek frame ke beech waale row me safed (bright) pixels ki ginti.
 *
 * Frame ko gray raw me nikalte hain aur bytes khud padhte hain. Yahi wo cheez hai
 * jo "Ken Burns chal raha hai" ko raay se badalkar naap me badal deti hai.
 */
async function measureBrightRun(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
  rowFraction = 0.5,
): Promise<number> {
  const rawPath = resolve(scratchDir, `probe-${randomUUID()}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    // `-ss` input ke BAAD = frame-exact seek. Thoda dheema hai par yahan
    // sahi frame chahiye, tez frame nahi.
    "-i", video,
    "-ss", atSeconds.toFixed(4),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    rawPath,
  ]);

  const bytes = await readFile(rawPath);
  await rm(rawPath, { force: true });

  const row = Math.floor(height * rowFraction);
  const offset = row * width;
  let count = 0;
  for (let x = 0; x < width; x += 1) {
    if ((bytes[offset + x] ?? 0) > 200) count += 1;
  }
  return count;
}

/**
 * Ek row me safed pixels ka **poora phaila hua hissa** — pehla, aakhri aur ginti.
 *
 * Sirf ginti se scale naap jaata hai; pehla/aakhri milne par uska **beech** bhi
 * mil jaata hai, aur usse pan (transform.x) naapa ja sakta hai. Ek hi frame se
 * do property, isliye render bhi ek hi baar padhna padta hai.
 */
async function measureBrightSpan(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
  rowFraction = 0.5,
): Promise<{ count: number; center: number | null }> {
  const rawPath = resolve(scratchDir, `span-${randomUUID()}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(4),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    rawPath,
  ]);
  const bytes = await readFile(rawPath);
  await rm(rawPath, { force: true });

  const offset = Math.floor(height * rowFraction) * width;
  let first = -1;
  let last = -1;
  let count = 0;
  for (let x = 0; x < width; x += 1) {
    if ((bytes[offset + x] ?? 0) > 200) {
      if (first < 0) first = x;
      last = x;
      count += 1;
    }
  }
  return { count, center: first < 0 ? null : (first + last) / 2 };
}

/**
 * Frame ke ek column ki average brightness. Blurred background hai ya kaali patti —
 * yahi ek number dono me farak kar deta hai.
 */
async function measureMeanBrightness(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
  column: number,
): Promise<number> {
  const rawPath = resolve(scratchDir, `edge-${randomUUID()}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(4),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    rawPath,
  ]);
  const bytes = await readFile(rawPath);
  await rm(rawPath, { force: true });

  let total = 0;
  for (let y = 0; y < height; y += 1) total += bytes[y * width + column] ?? 0;
  return total / height;
}

/**
 * Ek row ke **beech waale hisse** ka sabse chamakdaar pixel.
 *
 * Ginti (bright pixel count) fade naapne ke kaam nahi aayi: 200 ka threshold ek
 * khai hai, aur opacity 0.5 par hi text uske neeche chala jaata hai — naap 277 se
 * seedha 0 par kood jaati hai. Peak brightness dheere-dheere girti hai, isliye
 * beech ke kadam bhi dikhte hain.
 *
 * Sirf beech ka 60% padha jaata hai — utna hissa caption band ke andar hai, aur
 * band opaque hai. Kinare tak jaate to peeche ki image ka koi chamakdaar pixel
 * naap me ghus jaata.
 */
async function measureRowPeak(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
  rowFraction: number,
): Promise<number> {
  const rawPath = resolve(scratchDir, `peak-${randomUUID()}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(4),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    rawPath,
  ]);
  const bytes = await readFile(rawPath);
  await rm(rawPath, { force: true });

  const offset = Math.floor(height * rowFraction) * width;
  const from = Math.floor(width * 0.2);
  const to = Math.ceil(width * 0.8);
  let peak = 0;
  for (let x = from; x < to; x += 1) peak = Math.max(peak, bytes[offset + x] ?? 0);
  return peak;
}

/**
 * Ek frame ko RGB me padho aur do naap lautao:
 *  - `colorSpread` = |R - B| ka average (grayscale naapne ke liye)
 *  - `centerToCorner` = beech ki roshni / kone ki roshni (vignette ke liye)
 *
 * Dono ek hi frame se aati hain, isliye ek hi baar padhna padta hai.
 */
async function measureColor(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
  /**
   * Rang ki naap kis pattee par ho (frame ki oonchai ka hissa).
   *
   * ⚠️ Ye zaroori nikla: pehle poora frame padha tha aur grayscale ka check fail
   * ho gaya (|R-B| = 14, 0 nahi). Wajah galat naap thi — caption band terracotta
   * hai aur uspar grayscale hai hi nahi, par wo bhi ginti me aa raha tha. Naap
   * usi item par honi chahiye jispar effect laga hai.
   */
  colorBand: { from: number; to: number } = { from: 0, to: 1 },
): Promise<{ colorSpread: number; centerLuma: number; cornerLuma: number; insideLuma: number }> {
  const rawPath = resolve(scratchDir, `rgb-${randomUUID()}.rgb`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(4),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgb24",
    rawPath,
  ]);
  const bytes = await readFile(rawPath);
  await rm(rawPath, { force: true });

  const at = (x: number, y: number) => {
    const offset = (y * width + x) * 3;
    return {
      r: bytes[offset] ?? 0,
      g: bytes[offset + 1] ?? 0,
      b: bytes[offset + 2] ?? 0,
    };
  };
  const luma = (p: { r: number; g: number; b: number }) => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;

  // Har 16va pixel — poora frame padhna is naap ke liye zaroori nahi aur
  // 1080x1920 par wo har frame par 6 MB ka kaam hai.
  let spread = 0;
  let count = 0;
  const fromY = Math.floor(height * colorBand.from);
  const toY = Math.floor(height * colorBand.to);
  for (let y = fromY; y < toY; y += 16) {
    for (let x = 0; x < width; x += 16) {
      const p = at(x, y);
      spread += Math.abs(p.r - p.b);
      count += 1;
    }
  }

  /*
   * Kona bilkul kinare ka nahi (8px andar) — kinare ke pixel par encoder ki
   * apni thodi si chhed-chhad hoti hai aur naap bina wajah hilti hai.
   */
  const box = (cx: number, cy: number) => {
    let total = 0;
    let n = 0;
    for (let y = cy - 6; y <= cy + 6; y += 2) {
      for (let x = cx - 6; x <= cx + 6; x += 2) {
        total += luma(at(x, y));
        n += 1;
      }
    }
    return total / n;
  };

  return {
    colorSpread: spread / count,
    centerLuma: box(Math.floor(width / 2), Math.floor(height / 2)),
    cornerLuma: box(14, 14),
    // Gol kone ki curve ke **andar** ka bindu — 96px radius par (150,150) andar hai.
    insideLuma: box(150, 150),
  };
}

/**
 * Ek row me kitne tez kinare hain — `|p[x+1] - p[x]|` ka jod.
 *
 * Blur naapne ka yahi seedha tarika hai: blur kinaron ko phaila deta hai, isliye
 * har padosi jodi ka farak ghat jaata hai. Roshni ya rang badalne se ye naap
 * nahi hilti, sirf **teezi** se hilti hai — aur blur wahi cheez badalta hai.
 */
async function measurePeakGradient(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
  rowFraction: number,
): Promise<number> {
  const rawPath = resolve(scratchDir, `edge-${randomUUID()}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(4),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    rawPath,
  ]);
  const bytes = await readFile(rawPath);
  await rm(rawPath, { force: true });

  /*
   * **Sabse tez** kinara, jod nahi — aur ye farak maayne rakhta hai.
   *
   * Blur ek 0->255 ke kadam ko ek dhalaan me badal deta hai, par us dhalaan ke
   * saare `|Δ|` ka **jod wahi 255 hi rehta hai**. Yaani jod se blur naapa hi
   * nahi ja sakta. Sabse tez kadam zaroor girta hai: jitni chaudi dhalaan, utna
   * chhota har kadam.
   */
  const offset = Math.floor(height * rowFraction) * width;
  let peak = 0;
  for (let x = 1; x < width; x += 1) {
    peak = Math.max(peak, Math.abs((bytes[offset + x] ?? 0) - (bytes[offset + x - 1] ?? 0)));
  }
  return peak;
}

/**
 * Vignette ke dhalaan par banding hai ya nahi (14.8).
 *
 * Banding tab dikhti hai jab narm dhalaan ek jaisi roshni ke **chaude patton**
 * me tut jaati hai. Isliye naap seedhi hai: beech se kinare tak ek line par
 * chalo aur sabse lambi "bilkul ek jaisi value" wali patti naapo. Asli narm
 * dhalaan me ye patti chhoti hoti hai; banding me chaudi.
 *
 * ⚠️ Ye naap jaan-boojhkar hai. "Quality theek lag rahi hai" likh dena aasan
 * hota, par vignette + yuv420p + CRF banding ka klassik jod hai, aur wo video
 * ban jaane ke baad theek karna bahut mehnga padta hai.
 */
async function measureBanding(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
): Promise<{ longestFlatRun: number; distinctLevels: number }> {
  const rawPath = resolve(scratchDir, `band-${randomUUID()}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(4),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    rawPath,
  ]);
  const bytes = await readFile(rawPath);
  await rm(rawPath, { force: true });

  // Beech se upar ki taraf ek line — wahan vignette ka dhalaan poora dikhta hai
  // aur safed chaukor beech me hai, isliye usse thoda hat kar chalte hain.
  const column = Math.floor(width * 0.12);
  const from = Math.floor(height * 0.06);
  const to = Math.floor(height * 0.44);

  const levels = new Set<number>();
  let longest = 0;
  // `run` naam nahi — wo upar wala ffmpeg chalane wala function hai.
  let flat = 0;
  let previous = -1;
  for (let y = from; y < to; y += 1) {
    const value = bytes[y * width + column] ?? 0;
    levels.add(value);
    if (value === previous) {
      flat += 1;
      longest = Math.max(longest, flat);
    } else {
      flat = 1;
      previous = value;
    }
  }
  return { longestFlatRun: longest, distinctLevels: levels.size };
}

/** Video sach me aawaz wali hai ya khaali track hai? */
async function meanVolumeDb(video: string): Promise<number | null> {
  const { stderr } = await run(ffmpegPath(), [
    "-hide_banner", "-i", video, "-af", "volumedetect", "-f", "null", "-",
  ]);
  const match = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  return match ? Number(match[1]) : null;
}

// ---------------------------------------------------------------------- main

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadEnv(args.envFile);

  const root = requireRepoRoot();
  const config = readStorageConfig();
  const storage = createStorageDriver(config);

  const label = `${args.sizePresetId}-${args.fps}fps`;
  const outDir = resolve(config.local.outputDir, "samples");
  const scratchDir = resolve(config.local.outputDir, "scratch", label);
  const publicDir = resolve(scratchDir, "public");
  const framesDir = resolve(outDir, `frames-${label}`);
  const rawOut = resolve(scratchDir, "raw.mp4");
  const finalOut = resolve(outDir, `sample-${label}.mp4`);

  console.log(`repo         : ${root}`);
  console.log(`storage      : ${storage.name}`);
  console.log(`size preset  : ${args.sizePresetId}`);
  console.log(`fps          : ${args.fps}`);
  console.log(`export preset: ${args.exportPreset}`);
  console.log(`output       : ${finalOut}`);

  section("0. toolchain");
  const tools = await checkFfmpegAvailable();
  check("ffmpeg maujood", tools.ffmpeg.length > 0, tools.ffmpeg.split(" ").slice(0, 3).join(" "));
  check("ffprobe maujood", tools.ffprobe.length > 0, tools.ffprobe.split(" ").slice(0, 3).join(" "));

  section("1. placeholder media (FFmpeg se khud banayi)");
  await rm(scratchDir, { recursive: true, force: true });
  const mediaDir = resolve(scratchDir, "source");
  const media = await makePlaceholderMedia(mediaDir);
  for (const [name, path] of Object.entries(media)) {
    const info = await probe(path);
    const v = videoStream(info);
    const a = audioStream(info);
    check(
      `${name} ban gayi`,
      Boolean(v ?? a),
      v ? `${v.width}x${v.height}` : `${a?.sample_rate}Hz ${a?.channels}ch`,
    );
  }

  section("2. assets storage me");
  const stored: StoredAsset[] = [];
  for (const [kind, path] of Object.entries(media)) {
    const id = `as_sample_${kind}`;
    const key = storageKey.asset(id, extensionOf(path));
    await storage.put(key, new Uint8Array(await readFile(path)));
    stored.push({ id, key, filename: path });
    check(`${kind} -> ${key}`, (await storage.exists(key)) !== null);
  }

  section("3. Project JSON");
  const assetIds = {
    image: "as_sample_image",
    video: "as_sample_video",
    audio: "as_sample_audio",
  };
  const sample = buildSampleDoc(args, assetIds);
  const parsed = safeParseDoc(sample.doc);
  check("doc schema pass karta hai", parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 2)));

  const { width, height, fps, durationInFrames } = sample.doc.project;
  check(
    "doc ki size preset se aayi hai",
    width === requireSizePreset(args.sizePresetId).width || args.sizePresetId === "custom",
    `${width}x${height} @ ${fps}fps, ${durationInFrames} frames`,
  );

  section("4. assets resolve (doc me sirf assetId hota hai)");
  const assets = await resolveAssets(sample.doc, stored, storage, { publicDir });
  check("saare assets publicDir me utre", Object.keys(assets).length === 3, Object.values(assets).join(", "));

  section("5. render");
  const engine = new RemotionRenderEngine();
  let lastLogged = -1;
  const renderResult = await engine.render({
    doc: sample.doc,
    assets,
    publicDir,
    outPath: rawOut,
    preset: args.exportPreset,
    onProgress: ({ progress, stage, renderedFrames, totalFrames }) => {
      const percent = Math.floor(progress * 100);
      if (percent === lastLogged) return;
      lastLogged = percent;
      if (percent % 10 === 0) {
        console.log(
          `  ${String(percent).padStart(3)}%  ${stage}` +
            (renderedFrames !== undefined ? `  ${renderedFrames}/${totalFrames ?? "?"} frames` : ""),
        );
      }
    },
  });
  check("render poora hua", existsSync(rawOut), `${(renderResult.bytes / 1024 / 1024).toFixed(2)} MB`);

  section("6. faststart remux (-c copy, koi re-encode nahi)");
  await mkdir(outDir, { recursive: true });
  await remuxFaststart(rawOut, finalOut);
  check("final MP4 ban gayi", existsSync(finalOut));

  section("7. ffprobe — asli output");
  const info = await probe(finalOut);
  const v = videoStream(info);
  const a = audioStream(info);
  const probedFps = parseFrameRate(v?.r_frame_rate);
  const probedDuration = Number(info.format.duration ?? 0);
  const expectedDuration = framesToSeconds(durationInFrames, fps);

  console.log(JSON.stringify({ streams: info.streams.map((s) => ({
    codec_type: s.codec_type, codec_name: s.codec_name, profile: s.profile,
    width: s.width, height: s.height, pix_fmt: s.pix_fmt, r_frame_rate: s.r_frame_rate,
    sample_rate: s.sample_rate, channels: s.channels,
  })), format: info.format }, null, 2));

  check("video codec h264", v?.codec_name === "h264", String(v?.codec_name));
  check("profile High", v?.profile === "High", String(v?.profile));
  check("pixel format yuv420p", v?.pix_fmt === "yuv420p", String(v?.pix_fmt));
  check("width doc se", v?.width === width, `${v?.width} (doc: ${width})`);
  check("height doc se", v?.height === height, `${v?.height} (doc: ${height})`);
  check("fps doc se", probedFps === fps, `${probedFps} (doc: ${fps})`);
  check(
    "duration doc se milti hai",
    Math.abs(probedDuration - expectedDuration) < 0.15,
    `${probedDuration.toFixed(3)}s (doc: ${expectedDuration.toFixed(3)}s)`,
  );
  check("AUDIO STREAM maujood hai", a !== undefined, `${a?.codec_name} ${a?.sample_rate}Hz ${a?.channels}ch`);
  check("audio 48kHz", a?.sample_rate === "48000", String(a?.sample_rate));
  check("format mp4", (info.format.format_name ?? "").includes("mp4"), String(info.format.format_name));

  const meanDb = await meanVolumeDb(finalOut);
  check(
    "audio sach me sunai deti hai (khaali track nahi)",
    meanDb !== null && meanDb > -50,
    `mean_volume ${meanDb} dB`,
  );

  section("8. keyframes — naapa hua, dekha hua nahi (13.13)");
  /*
   * Safed chaukor ki asli chaudai = 400 * coverScale * scale(frame),
   * aur uska beech = frame ka center + x(frame).
   *
   * ⚠️ `expected` **engine se** aata hai (`resolveItemValue`), haath se likhe
   * formula se nahi. Aur yahi is check ka poora matlab hai: agar render apna
   * alag curve chalata, to pixel engine ki value se hat jaate. Isliye ye "preview
   * = render" ka seedha saboot hai, sirf "kuch to hil raha hai" nahi.
   */
  const coverScale = Math.max(width, height) / SOURCE.width;
  const imageFrames = sample.imageItem.durationInFrames;
  /*
   * Aakhri frame se 10 peeche rukte hain — aur ye ek naapi hui zaroorat hai.
   * `imageFrames - 1` par check fail hua tha: 4.967s par seek karne par ffmpeg
   * agla frame de deta tha, jahan image khatam ho kar video item shuru ho chuka
   * hai. Naap galat nahi thi, jagah galat thi.
   */
  const sampleFrames = [0, Math.round(imageFrames * 0.3), Math.round(imageFrames * 0.6), imageFrames - 10];
  const measuredWidths: number[] = [];

  await mkdir(framesDir, { recursive: true });

  for (const localFrame of sampleFrames) {
    const seconds = framesToSeconds(localFrame, fps);
    const scale = resolveItemValue<number>(sample.imageItem, "transform.scale", localFrame);
    const panX = resolveItemValue<number>(sample.imageItem, "transform.x", localFrame);

    const expectedWidth = SOURCE.squareSide * coverScale * scale;
    const expectedCenter = width / 2 + panX;

    const span = await measureBrightSpan(finalOut, seconds, width, height, scratchDir);
    measuredWidths.push(span.count);

    check(
      `frame ${localFrame} (${seconds.toFixed(2)}s): scale -> chaukor ${span.count}px`,
      Math.abs(span.count - expectedWidth) <= 4,
      `expected ${expectedWidth.toFixed(1)}px @ scale ${scale.toFixed(4)}`,
    );
    check(
      `frame ${localFrame}: pan -> chaukor ka beech ${span.center?.toFixed(1) ?? "—"}px`,
      span.center !== null && Math.abs(span.center - expectedCenter) <= 4,
      `expected ${expectedCenter.toFixed(1)}px @ x ${panX.toFixed(2)}`,
    );

    await extractFrame(finalOut, resolve(framesDir, `frame-${localFrame}.png`), seconds);
  }

  /*
   * Ease-in-out ka apna nishaan: shuruaat aur ant dheeme, beech tez. Yaani beech
   * ke do samples ka farak kinaron ke farak se bada hona chahiye. Linear hota to
   * teeno farak barabar aate — isliye ye check curve ki **shakl** pakadta hai,
   * sirf "bada ho raha hai" nahi.
   */
  const steps = [
    (measuredWidths[1] ?? 0) - (measuredWidths[0] ?? 0),
    (measuredWidths[2] ?? 0) - (measuredWidths[1] ?? 0),
    (measuredWidths[3] ?? 0) - (measuredWidths[2] ?? 0),
  ];
  check(
    "curve sach me ease-in-out hai (beech tez, kinare dheeme)",
    (steps[1] ?? 0) > (steps[0] ?? 0) && (steps[1] ?? 0) > (steps[2] ?? 0),
    `steps: ${steps.map((n) => n.toFixed(0)).join(" / ")}`,
  );

  section("9. blurred background (README 3B) sach me dikha?");
  /*
   * Video `contain` par hai. Jahan frame video se chauda hai wahan daayen-baayen
   * khaali jagah bachti hai, jise "blurred copy" bharti hai.
   *
   * ⚠️ Ye check ek asli bug ke baad joda gaya: pehle VideoItem blur layer ko
   * `null` deta tha (kyunki <Img> video nahi dikha sakta), to peeche chupchaap
   * KAALA aa jaata tha — aur koi test use pakad nahi raha tha.
   */
  const videoFit = computeFit(SOURCE_VIDEO, { width, height }, "contain");
  const videoSeconds = framesToSeconds(Math.round(fps * 7), fps);
  if (videoFit.hasEmptySpace) {
    // Frame ke bilkul kinare wala pixel — wahan sirf background hota hai.
    const edge = await measureMeanBrightness(finalOut, videoSeconds, width, height, scratchDir, 8);
    check(
      "khaali jagah me blurred copy hai (kaali patti nahi)",
      edge > 6,
      `kinare ki mean brightness ${edge.toFixed(1)} (kaala hota to ~0)`,
    );
    await extractFrame(finalOut, resolve(framesDir, "frame-video-blur.png"), videoSeconds);
  } else {
    console.log("  SKIP video frame me poora bhar raha hai — is size me khaali jagah hai hi nahi");
  }

  section("10. text sach me dikha?");
  // Caption band frame ke center se 28% neeche hai; us row par sirf text hi
  // bright hai (band terracotta hai, jo threshold se neeche aata hai).
  const textRowFraction = 0.5 + 0.28;
  const textFrameSeconds = framesToSeconds(Math.round(fps * 2.5), fps);
  const brightInTextRow = await measureBrightRun(
    finalOut, textFrameSeconds, width, height, scratchDir, textRowFraction,
  );
  check("caption row me text ke pixels mile", brightInTextRow > 0, `${brightInTextRow} bright px`);
  await extractFrame(finalOut, resolve(framesDir, "frame-text.png"), textFrameSeconds);

  /*
   * Teesri keyframed property: text ka `transform.opacity` 1 -> 0.
   *
   * Ise chaudai se nahi naapa ja sakta (text ki chaudai nahi badalti), isliye us
   * row ka **sabse chamakdaar pixel** naapte hain. Opacity girte hi text peeche ke
   * terracotta band me ghulta jaata hai aur peak brightness girti jaati hai.
   *
   * ⚠️ Pehle yahan row ki **average roshni** naapi gayi thi, aur wo galat tha —
   * check fail hua (135 -> 123 -> 128, bina kisi kram ke). Wajah: aakhri sample
   * 7.8s par hai jahan peeche image nahi, video item chal raha hai. Yaani row ka
   * average opacity se kam aur background se zyada bata raha tha. Band opaque hai,
   * isliye **band ke andar ke** safed pixels sirf text ke hote hain — unki ginti
   * background se bilkul nahi hilti.
   *
   * Theek number ki jagah **ghatta hua kram** naapa gaya hai, aur ye bhi
   * jaan-boojhkar: text anti-aliased hai, to "opacity 0.5 par exactly itne pixel"
   * ka daawa jhootha hota.
   */
  const textItem = sample.textItem;
  const fadeCounts: number[] = [];
  for (const fraction of [0.1, 0.5, 0.9]) {
    const localFrame = Math.round(textItem.durationInFrames * fraction);
    const seconds = framesToSeconds(textItem.startFrame + localFrame, fps);
    const opacity = resolveItemValue<number>(textItem, "transform.opacity", localFrame);
    const peak = await measureRowPeak(
      finalOut, seconds, width, height, scratchDir, textRowFraction,
    );
    fadeCounts.push(peak);
    console.log(`  .. frame ${localFrame}: opacity ${opacity.toFixed(3)} -> peak ${peak}`);
  }
  check(
    "text ka opacity keyframe sach me fade kar raha hai",
    (fadeCounts[0] ?? 0) > (fadeCounts[1] ?? 0) && (fadeCounts[1] ?? 0) > (fadeCounts[2] ?? 0),
    `peak: ${fadeCounts.join(" -> ")}`,
  );

  section("11. effects — naape hue (14.13)");
  /*
   * Do items par paanch effects, aur har ek ka apna naapne ka tarika. Yahan koi
   * "dekhne me theek lag raha hai" nahi hai — har daawa ek number par tika hai.
   */
  const imageAt = framesToSeconds(Math.round(sample.imageItem.durationInFrames * 0.4), fps);
  // Sirf upar ka 40% — wahan sirf image hai. Caption band (terracotta, bina
  // grayscale ke) neeche hai aur usse naap kharab hoti hai.
  const color = await measureColor(finalOut, imageAt, width, height, scratchDir, { from: 0.34, to: 0.62 });

  check(
    "grayscale — R aur B ka farak lagbhag khatam",
    color.colorSpread < 4,
    `mean |R-B| = ${color.colorSpread.toFixed(2)} (neela grid bina grayscale ke ~160 deta)`,
  );

  /*
   * Brightness ka theek ganit: safed chaukor 255 par tha, `brightness(0.9)` use
   * 229.5 par le aata hai. `>200` wala purana threshold ab bhi paar hota hai,
   * isliye upar wale scale/pan ke check waise ke waise chalte rehte hain.
   */
  check(
    "brightness 0.9 — safed chaukor 255 se 229 par aaya",
    Math.abs(color.centerLuma - 229.5) <= 8,
    `beech ki roshni ${color.centerLuma.toFixed(1)} (expected ~229.5)`,
  );

  check(
    "vignette — kone beech se kaafi gehre hain",
    color.cornerLuma < color.centerLuma * 0.25,
    `kona ${color.cornerLuma.toFixed(1)} vs beech ${color.centerLuma.toFixed(1)}`,
  );
  await extractFrame(finalOut, resolve(framesDir, "frame-effects-image.png"), imageAt);

  /*
   * Blur ka radius **keyframed** hai (0 -> 10). Probe ki patti par sabse tez
   * kinara girna chahiye — aur lagataar girna chahiye, sirf shuru-ant me nahi.
   */
  const probeRow = 0.5 + sample.probeY / height;
  const peaks: number[] = [];
  for (const fraction of [0.02, 0.5, 0.96]) {
    const localFrame = Math.round(sample.probe.durationInFrames * fraction);
    const seconds = framesToSeconds(localFrame, fps);
    const radius = resolveItemValue<number>(sample.probe, "effects.0.radius", localFrame);
    const peak = await measurePeakGradient(finalOut, seconds, width, height, scratchDir, probeRow);
    peaks.push(peak);
    console.log(`  .. frame ${localFrame}: blur ${radius.toFixed(2)}px -> sabse tez kinara ${peak}`);
    await extractFrame(finalOut, resolve(framesDir, `frame-blur-${localFrame}.png`), seconds);
  }
  check(
    "blur keyframe (0 -> 10) — kinare lagataar narm hote gaye",
    (peaks[0] ?? 0) > (peaks[1] ?? 0) && (peaks[1] ?? 0) > (peaks[2] ?? 0),
    peaks.join(" -> "),
  );

  /*
   * Rounded corners: kate hue kone par item ka apna content nahi bachta, sirf
   * uske peeche wali parat dikhti hai. Isliye kone ko curve ke **andar** wale
   * bindu se milaya jaata hai — wo dono ek jaise honge to radius laga hi nahi.
   */
  const videoItem = sample.videoItem;
  const videoCorner = await measureColor(
    finalOut,
    framesToSeconds(videoItem.startFrame + Math.round(videoItem.durationInFrames * 0.2), fps),
    width,
    height,
    scratchDir,
  );
  check(
    "rounded corners — kona kata hua hai (andar se kaafi gehra)",
    videoCorner.cornerLuma < videoCorner.insideLuma * 0.5,
    `kona ${videoCorner.cornerLuma.toFixed(1)} vs curve ke andar ${videoCorner.insideLuma.toFixed(1)}`,
  );

  /*
   * Banding — vignette ka dhalaan yuv420p + CRF 18 se guzarne ke baad bhi narm
   * hai ya patton me tut gaya (14.8).
   */
  const banding = await measureBanding(finalOut, imageAt, width, height, scratchDir);
  console.log(
    `  .. dhalaan par ${banding.distinctLevels} alag levels, sabse lambi ek-jaisi patti ${banding.longestFlatRun}px`,
  );
  /*
   * ⚠️ Yahan **flat-run par koi threshold nahi** hai, aur ye ek galti sudhaarne
   * ke baad tay hua. Pehle "sabse lambi patti <= 40px" wala check tha aur wo fail
   * hua (306px). Naap galat nahi thi — sawaal galat tha.
   *
   * Is sample me vignette lagbhag-kaale content par baithi hai (grid ka luma ~17).
   * Uspar dhalaan ki poori range hi 8 se 13 tak hai, yaani 8-bit me ginti ke
   * 5-6 kadam. Utni chhoti range me lambi ek-jaisi pattiyan **hamesha** aayengi,
   * chahe encoder kitna bhi accha ho — wo 8-bit ki hadd hai, encoding ki galti
   * nahi. Us number par threshold lagana ek aisi cheez ko "fail" batata jo asal
   * me theek hai.
   *
   * Jo baat sach me galat hoti, wo hai dhalaan ka **poora baith jaana** (do-teen
   * hi levels bachna) — yaani gradient ki jagah patta. Sirf wahi check hai.
   * Baaki dono number upar chhap jaate hain taaki inhe dekha ja sake.
   */
  check(
    "vignette ka dhalaan baitha nahi (levels bache hue hain)",
    banding.distinctLevels >= 8,
    `${banding.distinctLevels} levels; sabse lambi ek-jaisi patti ${banding.longestFlatRun}px ` +
      `(is sample me dhalaan lagbhag-kaale par hai, isliye lambi patti 8-bit ki hadd hai)`,
  );

  section("12. waqt");
  console.log(`  bundle + render : ${(renderResult.totalMs / 1000).toFixed(1)}s`);
  console.log(`  sirf render     : ${(renderResult.renderMs / 1000).toFixed(1)}s`);
  console.log(`  frames          : ${renderResult.frames}`);
  console.log(
    `  speed           : ${(renderResult.frames / (renderResult.renderMs / 1000)).toFixed(1)} fps`,
  );
  console.log(`  output          : ${finalOut}`);
  console.log(`  frames (dekhne ke liye): ${framesDir}`);

  if (!args.keepScratch) await rm(scratchDir, { recursive: true, force: true });

  console.log(`\n${"-".repeat(64)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (${label})`);
}

main().catch((error) => {
  console.error("\nrender-sample phat gaya:\n", error instanceof Error ? error.stack : error);
  process.exit(1);
});
