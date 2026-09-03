/**
 * Bolti tasveer ka scene doc me sach me lagta hai? (bina browser ke)
 *
 * ```
 * npm run check:talking --workspace @reel/studio
 * ```
 *
 * ⚠️ Ye jaanch ek asli galti ke baad likhi gayi. Panel me ek `"voice"` naam ki
 * track type maan li gayi thi jo hai hi nahi — `TRACK_TYPES` me sirf `audio` hai.
 * `tsc` bilkul chup raha, kyunki track ka type ek **string** hai aur har string
 * compile ho jaati hai. Wo galti tabhi milti jab aadmi "Bana do" dabata, aur
 * uske pehle ek TTS call ka paisa bhi lag chuka hota.
 *
 * Isliye doc banane ka poora hissa panel se alag hai (`lib/face/buildTalkingScene.ts`)
 * aur yahan chala kar dekha jaata hai.
 */

import {
  DEFAULT_EMOTION,
  buildVisemeTrack,
  createEmptyProject,
  safeParseDoc,
  sampleFace,
  visemesFromText,
  type Doc,
} from "@reel/core";

import { buildTalkingScene } from "../lib/face/buildTalkingScene";

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

const face = sampleFace();
const track = buildVisemeTrack({
  steps: visemesFromText("namaste dosto"),
  envelope: new Array(50).fill(0.8),
  durationSeconds: 3,
});

const base = (): Doc => createEmptyProject({ name: "Bolti tasveer test", fps: 30 });

const common = {
  imageAssetId: "as_image",
  voiceAssetId: "as_voice",
  face,
  sourceSize: { width: 1080, height: 1350 },
  track,
  emotionId: DEFAULT_EMOTION,
  durationSeconds: 3,
};

console.log("\nscene banta hai");

const made = buildTalkingScene({ doc: base(), ...common });
const parsed = safeParseDoc(made);
check(
  "bana hua doc schema se guzar jaata hai",
  parsed.success,
  parsed.success ? "" : JSON.stringify(parsed.error.issues[0]),
);

const photo = made.items.find((item) => item.type === "talking_photo");
check("bolti tasveer ka item bana", photo !== undefined);
check("uspar tasveer lagi hai", photo?.assetId === "as_image");
check("uspar poora data hai", photo?.talkingPhoto?.track.length === track.length);
check("uspar chehra hai", (photo?.talkingPhoto?.face.lipsOuter.length ?? 0) > 0);

const voice = made.items.find((item) => item.type === "audio");
check("awaaz ka item bana", voice?.assetId === "as_voice");
check(
  "dono ek saath shuru hote hain",
  photo?.startFrame === voice?.startFrame,
  "alag shuru hone par muh awaaz se aage-peeche chalta hai",
);
check(
  "dono ek jitne lambe hain",
  photo?.durationInFrames === voice?.durationInFrames,
);

check(
  "project ki lambai badh jaati hai",
  made.project.durationInFrames >= (photo?.durationInFrames ?? 0),
  "chhoti reh jaane par clip MP4 me aata hi nahi",
);

console.log("\ntrack ka istemal");

check(
  "har item apni sahi kism ki track par hai",
  made.items.every((item) => {
    const lane = made.tracks.find((t) => t.id === item.trackId);
    return lane !== undefined;
  }),
  "yahi wo jaanch hai jo 'voice' naam ki na-maujood track type pakad leti",
);

const twice = buildTalkingScene({ doc: made, ...common });
check(
  "doosri baar nayi track nahi banti",
  twice.tracks.length === made.tracks.length,
  `${made.tracks.length} track — har baar nayi banane par timeline khaali qataron se bhar jaata hai`,
);
check(
  "doosra scene pehle ke BAAD lagta hai",
  (twice.items.find((i) => i.type === "talking_photo" && i.id !== photo?.id)?.startFrame ?? 0) >=
    (photo?.durationInFrames ?? 0),
  "frame 0 par daalne se purana kaam dab jaata hai aur gayab lagta hai",
);

console.log("\nchunav sach me lagte hain");

const plain = buildTalkingScene({ doc: base(), ...common, showText: false });
check(
  "text na maangne par text ka item nahi banta",
  !plain.items.some((item) => item.type === "text"),
);

const withText = buildTalkingScene({ doc: base(), ...common, showText: true, text: "namaste dosto" });
const caption = withText.items.find((item) => item.type === "text");
check("text maangne par item banta hai", caption !== undefined);
check(
  "usme wahi likha hai jo bola ja raha hai",
  caption?.text?.content === "namaste dosto",
  "ek toggle jo kuch na kare wo toota hua button hai",
);
check(
  "khaali text par toggle ke bawajood kuch nahi banta",
  !buildTalkingScene({ doc: base(), ...common, showText: true, text: "   " }).items.some(
    (item) => item.type === "text",
  ),
);

const moved = buildTalkingScene({ doc: base(), ...common, animationId: "kenburns-slow" });
const movedPhoto = moved.items.find((item) => item.type === "talking_photo");
check(
  "harkat chunne par wo sach me lagti hai",
  (movedPhoto?.animations.length ?? 0) > 0,
  "warna 'Harkat' ka chunav ek aisa dabba hai jo kuch nahi karta",
);

console.log(`\n${passed} ok, ${failures.length} fail`);
if (failures.length > 0) {
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
