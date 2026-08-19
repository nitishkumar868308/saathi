/**
 * Checklist 8.17 ka sequence — **frame numbers ke saath**.
 *
 * ```
 * npm run edit-sequence --workspace @reel/core
 * ```
 *
 * Doc me likha hua sequence:
 *   ek 20s video clip -> 5s-12s keep selection -> 10s pe split -> ek clip
 *   duplicate -> ek move -> undo 5 baar -> redo 5 baar
 *
 * Ye script wahi karti hai aur har step ke baad har clip ki asli jagah chhaapti
 * hai. Aankh se "theek lag raha hai" wala jawab yahan chalta nahi — is phase ki
 * galtiyaan ek frame ki hoti hain, aur ek frame sirf ginti me dikhta hai.
 *
 * ⚠️ Ye UI ka vikalp nahi hai. Ye saabit karta hai ki **ops** sahi hain; button
 * sach me chalte hain ya nahi wo dev server par hi dikhega.
 */

import assert from "node:assert/strict";

import {
  addItem,
  createEmptyProject,
  createHistory,
  createItem,
  duplicateItems,
  framesToTimecode,
  itemEndFrame,
  keepRange,
  moveItems,
  recomputeDuration,
  secondsToFrames,
  splitAtFrame,
  type Doc,
} from "../src/index";

const FPS = 30;

function line(doc: Doc, label: string): void {
  const clips = [...doc.items]
    .sort((a, b) => a.startFrame - b.startFrame)
    .map((item) => {
      const start = framesToTimecode(item.startFrame, FPS, { compact: true });
      const end = framesToTimecode(itemEndFrame(item), FPS, { compact: true });
      return `${item.startFrame}-${itemEndFrame(item)} (${start}->${end}, trim@${item.trimStartFrame})`;
    });

  console.log(`\n${label}`);
  console.log(`  clips  : ${clips.length}`);
  for (const clip of clips) console.log(`         : ${clip}`);
  console.log(`  project: ${doc.project.durationInFrames} frames`);
}

// ---------------------------------------------------------------- shuruaat

const base = createEmptyProject({ name: "8.17 sequence", fps: FPS });
const trackId = base.tracks[0]!.id;

const clip = createItem("video", {
  fps: FPS,
  trackId,
  name: "20 second ka video",
  assetId: "as_demo",
  startFrame: 0,
  durationInFrames: secondsToFrames(20, FPS),
});

const history = createHistory<Doc>({ limit: 50 });
let doc = recomputeDuration(addItem(base, { item: clip }), undefined as never);
const startDoc = JSON.parse(JSON.stringify(doc)) as Doc;

line(doc, "0. Shuruaat — ek 20s clip");

function step(label: string, recipe: (draft: Doc) => void): void {
  const before = doc;
  doc = history.apply(doc, recipe as never, { label });
  assert.notEqual(doc, before, `step "${label}" ne kuch badla hi nahi`);
  line(doc, label);
}

// 1. keep selection 5s - 12s (ripple: bacha hua hissa 0 par aa jaata hai)
const inFrame = secondsToFrames(5, FPS);
const outFrame = secondsToFrames(12, FPS);
step(`1. Keep selection ${inFrame}-${outFrame} (5s-12s, ripple)`, (draft) => {
  keepRange.recipe(draft as never, { fromFrame: inFrame, toFrame: outFrame, ripple: true });
  recomputeDuration.recipe(draft as never, undefined as never);
});

// 2. 10s par split. Keep ke baad clip 0 se shuru hai, isliye asli 10s ab
//    timeline ke 5s par hai — yahi baat script se saaf ho jaati hai.
const splitAt = secondsToFrames(5, FPS);
step(`2. Split @ frame ${splitAt} (keep ke baad wala 10s)`, (draft) => {
  splitAtFrame.recipe(draft as never, { frame: splitAt });
  recomputeDuration.recipe(draft as never, undefined as never);
});

// 3. daayein wale tukde ko duplicate
const rightId = [...doc.items].sort((a, b) => a.startFrame - b.startFrame)[1]!.id;
step("3. Daayein wala tukda duplicate", (draft) => {
  duplicateItems.recipe(draft as never, { itemIds: [rightId] });
  recomputeDuration.recipe(draft as never, undefined as never);
});

// 4. duplicate ko 60 frame aage sarkao
const copyId = [...doc.items].sort((a, b) => a.startFrame - b.startFrame)[2]!.id;
step("4. Copy ko +60 frame aage sarkao", (draft) => {
  moveItems.recipe(draft as never, { itemIds: [copyId], deltaFrames: 60 });
  recomputeDuration.recipe(draft as never, undefined as never);
});

// 5. ek aur move — taaki undo/redo ke liye paanch entries ho jaayein
step("5. Copy ko +30 frame aur aage", (draft) => {
  moveItems.recipe(draft as never, { itemIds: [copyId], deltaFrames: 30 });
  recomputeDuration.recipe(draft as never, undefined as never);
});

const afterAll = JSON.parse(JSON.stringify(doc)) as Doc;

// ------------------------------------------------------------- undo / redo

console.log("\n--- undo x5 ---");
for (let i = 0; i < 5; i += 1) {
  assert.equal(history.canUndo(), true, `undo ${i + 1} par history khaali`);
  doc = history.undo(doc);
}
line(doc, "undo x5 ke baad");
assert.deepEqual(doc, startDoc, "paanch undo ke baad doc shuruaati jaisa nahi hai");
console.log("  ok   doc bilkul shuruaati jaisa hai (deep equal)");

console.log("\n--- redo x5 ---");
for (let i = 0; i < 5; i += 1) {
  assert.equal(history.canRedo(), true, `redo ${i + 1} par kuch bacha hi nahi`);
  doc = history.redo(doc);
}
line(doc, "redo x5 ke baad");
assert.deepEqual(doc, afterAll, "paanch redo ke baad doc paanch ops wala nahi hai");
console.log("  ok   doc bilkul paanch ops wala hai (deep equal)");

console.log(`\n${"-".repeat(60)}`);
console.log("SEQUENCE OK — 5 ops, 5 undo, 5 redo, dono taraf deep-equal");
