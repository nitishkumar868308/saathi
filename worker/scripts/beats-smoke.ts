/**
 * Beat detection aur chuppi-trim ka smoke test (24.7).
 *
 * ⚠️ Yahan bhi awaaz aisi banayi jaati hai jiska **sach pehle se pata hai**: ek
 * click track jiske click theek 0.5 second par hain (yaani 120 BPM). Kisi asli
 * gaane par "beat sahi pakde ya nahi" naapne ke liye pehle kisi insaan ko haath
 * se har beat ka waqt likhna padta — aur wo naap khud ek andaaza hoti.
 *
 * Chalao:
 *   npm run beats:smoke --workspace @reel/worker
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bpmFromTimes, detectBeats, nearestBeatFrame, speechTrimRange } from "@reel/core";
import { audioEnergy, detectSpeechSegments, ffmpegPath, run } from "@reel/media";

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

/** 120 BPM = har 0.5 second par ek click. */
const BPM = 120;
const BEAT_GAP = 60 / BPM;
const CLICK = 0.04;
const BEATS = 8;

async function makeClickTrack(dir: string, outPath: string): Promise<void> {
  const click = resolve(dir, "click.wav");
  const gap = resolve(dir, "gap.wav");

  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=48000",
    "-t", String(CLICK), click,
  ]);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
    "-t", String(BEAT_GAP - CLICK), gap,
  ]);

  const parts: string[] = [];
  for (let index = 0; index < BEATS; index += 1) parts.push(click, gap);

  const listPath = resolve(dir, "clicks.txt");
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

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../..");
  const scratchDir = resolve(root, "render-out", ".scratch-beats");

  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });

  const clickPath = resolve(scratchDir, "clicks.wav");
  await makeClickTrack(scratchDir, clickPath);

  /* ------------------------------------------------------ 1. beat detection */

  section("1. beat pakde gaye? (24.7)");

  const energy = await audioEnergy(clickPath, { windowSeconds: 0.025 });
  console.log(`  .. ${energy.length} window naapi gayi`);

  const beats = detectBeats(energy);
  console.log(`  .. ${beats.times.length} beat mile, BPM ${beats.bpm}`);
  console.log(`  .. waqt: ${beats.times.map((time) => time.toFixed(3)).join(", ")}`);

  check("saare beat mile", beats.times.length === BEATS, `${beats.times.length}/${BEATS}`);
  check("BPM sahi nikla", beats.bpm === BPM, `${beats.bpm} (sach ${BPM})`);

  let worst = 0;
  beats.times.forEach((time, index) => {
    worst = Math.max(worst, Math.abs(time - index * BEAT_GAP));
  });
  console.log(`  .. sabse badi galti: ${(worst * 1000).toFixed(0)}ms`);
  check("beat ka waqt sach ke paas hai", worst < 0.05, `${(worst * 1000).toFixed(0)}ms`);

  /*
   * ⚠️ Ek drum hit paanch-chhe window tak tez rehti hai. Har window ko beat maan
   * lene par ek hit ke paanch beat ban jaate hain — aur uspar lagaye gaye cut
   * kaanpte hue dikhte hain. 8 click par theek 8 beat aana isi ka saboot hai.
   */
  check("ek click ke kai beat nahi bane", beats.times.length <= BEATS);

  /* ------------------------------------------------------------ 2. snapping */

  section("2. snap — sirf paas wale beat par (24.7)");

  const fps = 30;
  // 1.02s par lagaya hua cut — 1.0s wale beat se sirf ek frame door.
  const close = nearestBeatFrame(Math.round(1.02 * fps), beats.times, { fps });
  check("paas ka cut beat par chala gaya", close === Math.round(1.0 * fps), `${close}`);

  /*
   * ⚠️ Door ke cut ko haath nahi lagta. Iske bina ye har cut ko kisi na kisi
   * beat par kheench leta hai aur user ka soch-samajh kar lagaya hua cut
   * chup-chaap kahin aur chala jaata hai.
   */
  const far = nearestBeatFrame(Math.round(1.25 * fps), beats.times, {
    fps,
    maxDistanceFrames: 3,
  });
  check("door ka cut chhoot gaya (null)", far === null, `${far}`);

  check("do se kam beat par BPM null hota hai", bpmFromTimes([1]) === null);

  /* ---------------------------------------------------- 3. chuppi auto-trim */

  section("3. chuppi auto-trim (24.7)");

  /*
   * Ek jaan-boojhkar banayi hui file: 1s chuppi, 2s awaaz, 1s chuppi. Kaatne ke
   * baad 2s (+ dono taraf thoda pad) bachna chahiye.
   */
  const voicePath = resolve(scratchDir, "voice.wav");
  {
    const silence = resolve(scratchDir, "s1.wav");
    const tone = resolve(scratchDir, "t1.wav");
    await run(ffmpegPath(), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "1", silence,
    ]);
    await run(ffmpegPath(), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000", "-t", "2", tone,
    ]);
    const listPath = resolve(scratchDir, "voice.txt");
    await writeFile(
      listPath,
      [silence, tone, silence].map((part) => `file '${part.replace(/\\/g, "/")}'`).join("\n"),
      "utf8",
    );
    await run(ffmpegPath(), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", voicePath,
    ]);
  }

  const detected = await detectSpeechSegments(voicePath);
  const range = speechTrimRange(detected.segments, {
    durationSeconds: detected.durationSeconds,
  });
  console.log(
    `  .. poori file ${detected.durationSeconds.toFixed(2)}s -> ` +
      `${range ? `${range.startSeconds.toFixed(2)}–${range.endSeconds.toFixed(2)}s` : "kuch nahi katna"}`,
  );

  check("kaatne layak hissa mila", range !== null);
  check(
    "shuru ki chuppi kati (thoda pad chhod kar)",
    range !== null && Math.abs(range.startSeconds - 0.92) < 0.06,
    `${range?.startSeconds.toFixed(3)}`,
  );
  check(
    "ant ki chuppi kati",
    range !== null && Math.abs(range.endSeconds - 3.08) < 0.06,
    `${range?.endSeconds.toFixed(3)}`,
  );

  /*
   * ⚠️ Poori file me bolna hi bolna ho to `null` aana chahiye — warna har baar
   * ek bekaar ka undo step banta hai jo kuch badalta hi nahi.
   */
  const nothing = speechTrimRange([{ startSeconds: 0, endSeconds: 3 }], { durationSeconds: 3 });
  check("kaatne ko kuch na ho to null", nothing === null);

  await rm(scratchDir, { recursive: true, force: true }).catch(() => {});

  console.log("");
  if (failures.length > 0) {
    console.log(`FAIL: ${failures.length} — ${failures.join(" | ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (beats)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
