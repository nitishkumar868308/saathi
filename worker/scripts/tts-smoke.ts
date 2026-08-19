/**
 * Voice ka smoke test (22.15).
 *
 * Do hisse hain aur unhe alag rakhna zaroori hai:
 *
 *  1. **Cleanup chain** — ye ffmpeg se chalti hai, jo maujood hai. Ye hissa
 *     hamesha chalta hai aur asli numbers deta hai (LUFS pehle/baad).
 *  2. **TTS** — ise `edge-tts` chahiye (Python). Na ho to ye hissa **saaf skip**
 *     hota hai aur install ka tarika chapta hai. Use fail banana galat hoga:
 *     cleanup ka poora sawaal uspar nahi tika hai.
 *
 * Chalao:
 *   npm run tts:smoke --workspace @reel/worker
 *   npm run tts:smoke --workspace @reel/worker -- --text "Papa, zaroori documents" --voice hi-IN-MadhurNeural
 */

import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CLEANUP_STEPS, DEFAULT_CLEANUP, cleanupFilterString, type CleanupStepId } from "@reel/core";
import {
  cleanupVoice,
  ffmpegPath,
  generateSpeech,
  listVoices,
  measureEbur128,
  run,
  ttsAvailable,
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

function parseArgs(argv: readonly string[]): { text: string; voice: string } {
  let text = "Papa, aapke zaroori documents ab ek hi jagah par rahenge.";
  let voice = "hi-IN-MadhurNeural";

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--text" && argv[index + 1]) text = argv[index + 1] as string;
    if (argv[index] === "--voice" && argv[index + 1]) voice = argv[index + 1] as string;
  }
  return { text, voice };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../..");
  const outDir = resolve(root, "render-out", "voice");
  const scratchDir = resolve(root, "render-out", ".scratch-voice");

  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  section("1. cleanup chain — data hai, pipeline nahi (22.7)");

  const chain = cleanupFilterString(DEFAULT_CLEANUP);
  console.log(`  .. default chain: ${chain}`);
  check("default me kuch kadam chalu hain", Boolean(chain));

  /*
   * Limiter hamesha aakhir me — chahe user use kahin bhi rakhe. Uske baad kuch
   * bhi lagane par peak dobara upar ja sakta hai aur `-1 dBTP` ka vaada toot
   * jaata hai.
   */
  const shuffled = cleanupFilterString({
    enabled: { limiter: true, highpass: true, normalize: true },
    order: ["limiter", "highpass", "normalize"] as CleanupStepId[],
  });
  check(
    "limiter zabardasti aakhir me jaata hai",
    Boolean(shuffled?.endsWith("level=false")),
    shuffled ?? "—",
  );

  check(
    "sab kadam band karne par chain khaali hoti hai",
    cleanupFilterString({ enabled: {} }) === null,
  );

  section("2. cleanup sach me chalti hai (22.7 / 22.8)");

  /*
   * Ek jaan-boojh kar kharab awaaz: dheemi (−30 dB), 40 Hz ka rumble, aur
   * dono taraf 1-1 second ki chuppi. Yahi teen cheezein cleanup ko theek karni
   * hain, aur teeno naapi ja sakti hain.
   */
  const dirty = resolve(scratchDir, "dirty.wav");
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "sine=frequency=220:duration=3:sample_rate=48000",
    "-f", "lavfi", "-i", "sine=frequency=40:duration=3:sample_rate=48000",
    "-filter_complex",
    // Awaaz + rumble ko milao, dheema karo, aur dono taraf chuppi lagao.
    "[0:a]volume=0.05[v];[1:a]volume=0.25[r];[v][r]amix=inputs=2:duration=first[m];" +
      "[m]adelay=1000|1000,apad=pad_dur=1[out]",
    "-map", "[out]",
    "-c:a", "pcm_s16le",
    dirty,
  ]);
  check("kharab awaaz ban gayi", existsSync(dirty));

  const before = await measureEbur128(dirty);
  console.log(
    `  .. pehle : ${before.integratedLufs?.toFixed(1) ?? "—"} LUFS, peak ${before.truePeakDb?.toFixed(1) ?? "—"} dBTP`,
  );

  const cleaned = resolve(outDir, "cleaned.wav");
  const result = await cleanupVoice({
    input: dirty,
    outPath: cleaned,
    filters: cleanupFilterString(DEFAULT_CLEANUP),
  });

  console.log(
    `  .. baad  : ${result.after.integratedLufs?.toFixed(1) ?? "—"} LUFS, peak ${result.after.truePeakDb?.toFixed(1) ?? "—"} dBTP`,
  );

  check(
    "voice apne target (-16 LUFS) ke paas aa gayi",
    result.after.integratedLufs !== null && Math.abs(result.after.integratedLufs + 16) <= 2,
    `${result.after.integratedLufs?.toFixed(1)} LUFS`,
  );
  check(
    "true peak chhat ke neeche hai",
    result.after.truePeakDb !== null && result.after.truePeakDb <= -0.9,
    `${result.after.truePeakDb?.toFixed(2)} dBTP`,
  );
  check(
    "cleanup ne sach me level uthaya",
    result.before.integratedLufs !== null &&
      result.after.integratedLufs !== null &&
      result.after.integratedLufs - result.before.integratedLufs > 5,
    `${result.before.integratedLufs?.toFixed(1)} -> ${result.after.integratedLufs?.toFixed(1)} LUFS`,
  );

  /*
   * Chuppi sach me kati? Dono taraf 1-1 second thi, yaani 5 second ki file me se
   * lagbhag 2 second jaana chahiye.
   */
  /*
   * `-f null -` zaroori hai: bina output ke ffmpeg exit 1 deta hai (chahe sab
   * theek ho), aur `run()` use galti samajh kar phat jaata hai.
   */
  const { stderr } = await run(ffmpegPath(), ["-hide_banner", "-i", cleaned, "-f", "null", "-"]);
  const match = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
  const seconds = match
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : 0;
  console.log(`  .. lambai: 5.0s -> ${seconds.toFixed(2)}s`);
  check("shuru aur ant ki chuppi kat gayi", seconds < 4, `${seconds.toFixed(2)}s`);

  section("3. rumble (40 Hz) hata ya nahi");
  /*
   * Bandpass se 40 Hz ke aas-paas ka level naapo — pehle aur baad. Highpass ke
   * baad wo bahut neeche hona chahiye.
   */
  async function bandLevel(file: string, hz: number): Promise<number | null> {
    const { stderr: out } = await run(ffmpegPath(), [
      "-hide_banner", "-i", file,
      "-af", `bandpass=f=${hz}:width_type=h:w=15,volumedetect`,
      "-f", "null", "-",
    ]);
    const found = /mean_volume:\s*(-?[\d.]+) dB/.exec(out);
    return found ? Number(found[1]) : null;
  }

  const rumbleBefore = await bandLevel(dirty, 40);
  const rumbleAfter = await bandLevel(cleaned, 40);
  console.log(
    `  .. 40 Hz: ${rumbleBefore?.toFixed(1) ?? "—"} dB -> ${rumbleAfter?.toFixed(1) ?? "—"} dB`,
  );

  const voiceBefore = await bandLevel(dirty, 220);
  const voiceAfter = await bandLevel(cleaned, 220);
  console.log(
    `  .. 220 Hz (asli awaaz): ${voiceBefore?.toFixed(1) ?? "—"} dB -> ${voiceAfter?.toFixed(1) ?? "—"} dB`,
  );

  check(
    "rumble asli awaaz ke muqable neeche gaya",
    rumbleBefore !== null &&
      rumbleAfter !== null &&
      voiceBefore !== null &&
      voiceAfter !== null &&
      voiceAfter - voiceBefore - (rumbleAfter - rumbleBefore) > 10,
    `awaaz ${(voiceAfter! - voiceBefore!).toFixed(1)} dB upar, rumble ${(rumbleAfter! - rumbleBefore!).toFixed(1)} dB`,
  );

  section("4. har cleanup kadam ka apna filter hai");
  for (const step of CLEANUP_STEPS) {
    const filter = step.filter(step.defaults);
    check(`${step.id} ka filter banta hai`, Boolean(filter), filter ?? "—");
  }

  section("5. TTS (22.4)");
  const tts = await ttsAvailable();
  if (!tts.ok) {
    /*
     * ⚠️ Ye **fail nahi** hai. edge-tts ek alag cheez hai jise user install
     * karta hai; uske na hone par cleanup ka poora sawaal waise ka waisa rehta
     * hai. Yahan sirf saaf batana hai ki kya karna hai.
     */
    console.log("  SKIP edge-tts nahi mila — voice generate nahi ho sakti.");
    console.log(`       wajah: ${tts.detail.split("\n")[0]}`);
    console.log("       install:  pip install edge-tts");
    console.log("       jaancho:  python -m edge_tts --list-voices");

    const { voices, live } = await listVoices();
    console.log(`       abhi ki list: ${voices.length} voice (${live ? "asli" : "fallback"})`);
  } else {
    const voicePath = resolve(outDir, "voice.wav");
    const speech = await generateSpeech({
      text: args.text,
      voiceId: args.voice,
      outPath: voicePath,
      scratchDir,
    });
    check("voice ban gayi", existsSync(voicePath), `${speech.durationSeconds.toFixed(2)}s`);

    const { stderr: probe } = await run(ffmpegPath(), ["-hide_banner", "-i", voicePath, "-f", "null", "-"]);
    check("48kHz par hai (ek hi resample)", /48000 Hz/.test(probe), "48000 Hz");

    const voiceClean = resolve(outDir, "voice-clean.wav");
    const voiceResult = await cleanupVoice({
      input: voicePath,
      outPath: voiceClean,
      filters: cleanupFilterString(DEFAULT_CLEANUP),
    });
    console.log(
      `  .. voice: ${voiceResult.before.integratedLufs?.toFixed(1)} -> ${voiceResult.after.integratedLufs?.toFixed(1)} LUFS`,
    );
    check(
      "generated voice bhi target par aa gayi",
      voiceResult.after.integratedLufs !== null &&
        Math.abs(voiceResult.after.integratedLufs + 16) <= 2,
    );
  }

  await rm(scratchDir, { recursive: true, force: true });

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (voice)`);
}

void main();
