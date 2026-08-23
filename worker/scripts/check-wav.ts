/**
 * PCM se WAV — bina ffmpeg ke (26.19).
 *
 * Ye jaanch is baat ki hai ki "Awaaz banao" **Vercel par bhi** chale. Wahan
 * ffmpeg hota hi nahi, aur pehle PCM ko WAV banane ke liye wahi maanga jaata
 * tha — yaani feature UI me dikhta tha aur deployed studio par hamesha marta.
 *
 * Header ke number haath se jaanche jaate hain, kyunki ek galat offset par file
 * "ban" jaati hai aur player use bajaata bhi hai — bas raftaar ya awaaz galat
 * hoti hai, aur wo galti kaan tak hi pahunchti hai, kisi error tak nahi.
 */

import { pcmDurationSeconds, pcmToWav } from "@reel/media";

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\npcmToWav");

const format = { sampleRate: 24000, channels: 1 };
const pcm = new Uint8Array(24000 * 2); // 1 second, 16-bit mono
const wav = pcmToWav(pcm, format);
const view = new DataView(wav.buffer);
const ascii = (at: number, len: number) =>
  String.fromCharCode(...Array.from(wav.subarray(at, at + len)));

check("header 44 byte ka hai", wav.length === pcm.length + 44, `${wav.length} byte`);
check("RIFF / WAVE / fmt / data", ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE" && ascii(12, 4) === "fmt " && ascii(36, 4) === "data");
check("RIFF ka naap 8 byte chhod kar", view.getUint32(4, true) === 36 + pcm.length);
check("format PCM (1), koi compression nahi", view.getUint16(20, true) === 1);
check("rate wahi jo source ka", view.getUint32(24, true) === 24000);
check("channels wahi jo source ke", view.getUint16(22, true) === 1);
check("16 bit", view.getUint16(34, true) === 16);
check("byte per second sahi", view.getUint32(28, true) === 24000 * 2, String(view.getUint32(28, true)));
check("block align sahi", view.getUint16(32, true) === 2);
check("data ka naap sahi", view.getUint32(40, true) === pcm.length);

/*
 * Stereo aur doosre rate par bhi ganit theek rehna chahiye — ek din koi provider
 * kuch aur de sakta hai, aur tab ye jaanch hi batayegi ki header sach me bana ya
 * sirf 24000-mono par chalta tha.
 */
const stereo = pcmToWav(new Uint8Array(400), { sampleRate: 48000, channels: 2 });
const sv = new DataView(stereo.buffer);
check("stereo/48k par block align 4", sv.getUint16(32, true) === 4);
check("stereo/48k par byte per second", sv.getUint32(28, true) === 48000 * 4);

console.log("\npcmDurationSeconds");
check("1 second ka PCM = 1.00s", Math.abs(pcmDurationSeconds(pcm.length, format) - 1) < 0.001);
check(
  "stereo me bhi sahi",
  Math.abs(pcmDurationSeconds(48000 * 4, { sampleRate: 48000, channels: 2 }) - 1) < 0.001,
);

/* Galat naap par saaf mana — chup-chaap kachra header likhne se behtar. */
let threw = false;
try {
  pcmToWav(pcm, { sampleRate: 0, channels: 1 });
} catch {
  threw = true;
}
check("rate 0 par saaf error", threw);

console.log(`\n${passed} ok, ${failures.length} fail`);
if (failures.length > 0) {
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
