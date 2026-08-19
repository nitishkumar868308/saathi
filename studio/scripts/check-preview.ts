/**
 * Preview player ke ganit ka check — bina browser ke.
 *
 * Player khud browser me hi chal sakta hai, par uske peeche ka **poora ganit**
 * yahan chalta hai, aur yahi wo hissa hai jo chupchaap galat ho sakta hai:
 *
 *   - zoom / draft ki scale (aspect toota to preview jhooth bolne lagta hai)
 *   - seek ka throttle (60fps se tez seek karne par drag chipchipa hota hai)
 *   - stutter naapna (andaaza nahi, asli fps)
 *   - shared audio tags (kam pade to awaaz chup ho jaati hai)
 *   - safe-area guide project ke naap ke hisaab se
 *
 * ⚠️ Yahan waqt nakli hai (`fakeClock`), asli nahi. `setTimeout` par test
 * likhne se wo dheema aur bharosemand-nahi ho jaata — aur throttle ke test me
 * to wahi cheez naapni hoti hai jo waqt par tiki hai.
 *
 * Chalane ka tarika:  npm run check --workspace @reel/studio
 */

import assert from "node:assert/strict";

import { guidesForSize, isInsideSafeArea, requireSafeAreaGuide, safeAreaRect } from "@reel/core";

import {
  DRAFT_MAX_SCALE,
  SEEK_MIN_INTERVAL_MS,
  createSeekThrottle,
  createStutterWatch,
  effectiveGuideId,
  fitScale,
  maxOverlappingAudio,
  MIN_SHARED_AUDIO_TAGS,
  previewLayout,
  sharedAudioTagCount,
} from "../lib/preview";
import { SHORTCUTS, comboLabel, eventCombo } from "../lib/shortcuts";

let passed = 0;
const failures: { name: string; error: string }[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ name, error: message });
    console.log(`  FAIL ${name}\n       ${message.split("\n").join("\n       ")}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const REEL = { width: 1080, height: 1920 };
const LANDSCAPE = { width: 1920, height: 1080 };

/* --------------------------------------------------------- zoom aur scale */

section("preview layout (6.3 — naap project ke aspect se)");

test("fit portrait frame ko oonchai se baandhta hai", () => {
  const scale = fitScale({ width: 800, height: 400 }, REEL);
  assert.equal(scale, 400 / 1920);
});

test("fit landscape frame ko chaudai se baandhta hai", () => {
  // Dabba 800x600 hai: chaudai se 0.4167 aur oonchai se 0.5556 — chhoti wali
  // jeetni chahiye, warna frame dabbe se bahar nikal jaata hai.
  const scale = fitScale({ width: 800, height: 600 }, LANDSCAPE);
  assert.equal(scale, 800 / 1920);
});

test("dabba chaura ho to bhi oonchai ki hadd jeet sakti hai", () => {
  // 800x400 me landscape frame oonchai se bandhta hai — yahi wo case hai jo
  // "landscape matlab hamesha chaudai" maan lene par toot jaata.
  assert.equal(fitScale({ width: 800, height: 400 }, LANDSCAPE), 400 / 1080);
});

test("khaali dabbe par scale 0 (NaN nahi)", () => {
  assert.equal(fitScale({ width: 0, height: 0 }, REEL), 0);
});

test("fit par aspect bilkul project jaisa rehta hai", () => {
  const layout = previewLayout({ width: 900, height: 500 }, REEL, { zoomId: "fit" });
  // Round hone se 1px ka farak aa sakta hai — usse zyada matlab aspect toota.
  const expectedWidth = (layout.height * REEL.width) / REEL.height;
  assert.ok(
    Math.abs(layout.width - expectedWidth) <= 1,
    `aspect toot gaya: ${layout.width}x${layout.height}`,
  );
});

test("100% par composition ke asli pixels", () => {
  const layout = previewLayout({ width: 300, height: 300 }, REEL, { zoomId: "100" });
  assert.equal(layout.scale, 1);
  assert.equal(layout.width, 1080);
  assert.equal(layout.height, 1920);
});

test("50% par theek aadha", () => {
  const layout = previewLayout({ width: 300, height: 300 }, REEL, { zoomId: "50" });
  assert.equal(layout.width, 540);
  assert.equal(layout.height, 960);
});

test("anjaan zoom id par fit par gir jaata hai", () => {
  const layout = previewLayout({ width: 900, height: 500 }, REEL, { zoomId: "kuch-bhi" });
  assert.equal(layout.scale, fitScale({ width: 900, height: 500 }, REEL));
});

section("draft mode (6.12 — sirf scale ghatata hai, doc nahi)");

test("draft badi scale par chhat lagata hai", () => {
  const layout = previewLayout({ width: 300, height: 300 }, REEL, { zoomId: "100", draft: true });
  assert.equal(layout.scale, DRAFT_MAX_SCALE);
});

test("draft chhoti scale ko bada nahi karta", () => {
  const box = { width: 200, height: 200 };
  const plain = previewLayout(box, REEL, { zoomId: "fit" });
  const draft = previewLayout(box, REEL, { zoomId: "fit", draft: true });
  // fit yahan 0.104 hai — draft ki chhat 0.5 se kaafi neeche. Draft ko usse
  // bada karne ka koi haq nahi, warna "draft" naam par preview bhaari ho jaata.
  assert.equal(draft.scale, plain.scale);
});

/* -------------------------------------------------------------- throttle */

section("seek throttle (6.7 — 60fps se zyada nahi)");

function fakeClock() {
  let now = 0;
  const queue: { at: number; run: () => void }[] = [];
  return {
    now: () => now,
    schedule: (callback: () => void, delayMs: number) => {
      queue.push({ at: now + delayMs, run: callback });
    },
    advance(ms: number) {
      const until = now + ms;
      // Har baar sabse pehle wala kaam — waqt aage badhte hue.
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        const next = queue[0];
        if (!next || next.at > until) break;
        queue.shift();
        now = next.at;
        next.run();
      }
      now = until;
    },
  };
}

test("pehla seek turant jaata hai", () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const throttle = createSeekThrottle((frame) => sent.push(frame), clock);

  throttle.request(10);
  assert.deepEqual(sent, [10]);
});

test("ek window me sirf aakhri frame jaata hai", () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const throttle = createSeekThrottle((frame) => sent.push(frame), clock);

  throttle.request(1); // turant
  for (const frame of [2, 3, 4, 5]) throttle.request(frame);
  assert.deepEqual(sent, [1], "window ke andar aur kuch nahi jaana chahiye");

  clock.advance(SEEK_MIN_INTERVAL_MS);
  // Beech ke 2,3,4 kisi ne dekhe hi nahi — sirf 5 matlab rakhta hai.
  assert.deepEqual(sent, [1, 5]);
});

test("200 pointermove par 60fps ki hadd nahi tootti", () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const throttle = createSeekThrottle((frame) => sent.push(frame), clock);

  // 1000ms me 200 move (5ms par ek) — asli drag isi raftaar se aata hai.
  for (let i = 0; i < 200; i += 1) {
    throttle.request(i);
    clock.advance(5);
  }
  const maxAllowed = Math.ceil(1000 / SEEK_MIN_INTERVAL_MS) + 1;
  assert.ok(
    sent.length <= maxAllowed,
    `${sent.length} seek gaye, hadd ${maxAllowed} (60fps) hai`,
  );
  assert.ok(sent.length > 10, "itne kam seek matlab scrub jhatke se chalega");
});

test("flush pending frame ko abhi bhej deta hai", () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const throttle = createSeekThrottle((frame) => sent.push(frame), clock);

  throttle.request(1);
  throttle.request(99);
  throttle.flush();
  assert.deepEqual(sent, [1, 99]);
});

/* --------------------------------------------------------- stutter watch */

section("stutter watch (6.12 — naapa gaya, andaaza nahi)");

test("poori raftaar par hakla nahi kehta", () => {
  const watch = createStutterWatch(30, { sampleSize: 10 });
  let stutter = false;
  for (let i = 0; i < 10; i += 1) stutter = watch.push(i * (1000 / 30));
  assert.equal(stutter, false);
  assert.ok(Math.abs((watch.measuredFps() as number) - 30) < 0.5);
});

test("aadhi raftaar par hakla kehta hai", () => {
  const watch = createStutterWatch(30, { sampleSize: 10 });
  let stutter = false;
  for (let i = 0; i < 10; i += 1) stutter = watch.push(i * (1000 / 15));
  assert.equal(stutter, true);
  assert.ok(Math.abs((watch.measuredFps() as number) - 15) < 0.5);
});

test("poore sample se pehle koi faisla nahi", () => {
  const watch = createStutterWatch(30, { sampleSize: 10 });
  // Ek dheema frame (tab switch, GC) hakla nahi hota — us par hint dikhana
  // sirf shor hai.
  assert.equal(watch.push(0), false);
  assert.equal(watch.push(500), false);
  assert.equal(watch.measuredFps(), null);
});

test("reset ke baad phir se poore sample ka intezaar", () => {
  const watch = createStutterWatch(30, { sampleSize: 5 });
  for (let i = 0; i < 5; i += 1) watch.push(i * 100);
  watch.reset();
  assert.equal(watch.push(0), false);
  assert.equal(watch.measuredFps(), null);
});

/* ------------------------------------------------------------ audio tags */

section("shared audio tags (6.9)");

test("bina audio ke bhi kam se kam do tag rehte hain", () => {
  assert.equal(maxOverlappingAudio([]), 0);
  assert.equal(sharedAudioTagCount([]), MIN_SHARED_AUDIO_TAGS);
});

test("aage-peeche lagi clips overlap nahi hoti", () => {
  const items = [
    { startFrame: 0, durationInFrames: 30, hasAudio: true },
    { startFrame: 30, durationInFrames: 30, hasAudio: true },
  ];
  assert.equal(maxOverlappingAudio(items), 1);
});

test("ek saath bajti teen clips par teen", () => {
  const items = [
    { startFrame: 0, durationInFrames: 90, hasAudio: true },
    { startFrame: 10, durationInFrames: 90, hasAudio: true },
    { startFrame: 20, durationInFrames: 90, hasAudio: true },
    // Bina audio wali (image/text) ginti me nahi aani chahiye.
    { startFrame: 0, durationInFrames: 90, hasAudio: false },
  ];
  assert.equal(maxOverlappingAudio(items), 3);
  assert.equal(sharedAudioTagCount(items), 3);
});

/* ----------------------------------------------------------- safe area */

section("safe-area guides (6.10)");

test("reel wali guide landscape par nahi dikhti", () => {
  const ids = guidesForSize(1920, 1080).map((guide) => guide.id);
  assert.ok(!ids.includes("reels"), `landscape par mila: ${ids.join(", ")}`);
  assert.ok(ids.includes("title-safe"));
});

test("portrait par Instagram aur Shorts dono milte hain", () => {
  const ids = guidesForSize(1080, 1920).map((guide) => guide.id);
  assert.ok(ids.includes("reels") && ids.includes("shorts"));
});

test("size badalne par chuni hui guide apne aap badal jaati hai", () => {
  assert.equal(effectiveGuideId(1080, 1920, "reels"), "reels");
  // Project 16:9 ho gaya — "Instagram Reels" ab jhooth hai, isliye pehli lagu
  // hone waali par gir jaata hai.
  const fallback = effectiveGuideId(1920, 1080, "reels");
  assert.notEqual(fallback, "reels");
  assert.equal(fallback, guidesForSize(1920, 1080)[0]?.id);
});

test("safe area ka rectangle asli pixels me sahi banta hai", () => {
  const guide = requireSafeAreaGuide("title-safe"); // 10% chaaron taraf
  const rect = safeAreaRect(guide, 1080, 1920);
  assert.equal(rect.x, 108);
  assert.equal(rect.y, 192);
  assert.equal(rect.width, 1080 - 216);
  assert.equal(rect.height, 1920 - 384);
});

test("andar/bahar ka faisla (Phase 20 isi ko reuse karega)", () => {
  const guide = requireSafeAreaGuide("title-safe");
  assert.equal(isInsideSafeArea({ x: 200, y: 300, width: 400, height: 400 }, guide, 1080, 1920), true);
  // Neeche wala kinara safe area se bahar — Reels me yahin caption aata hai.
  assert.equal(isInsideSafeArea({ x: 200, y: 1500, width: 400, height: 300 }, guide, 1080, 1920), false);
});

/* ------------------------------------------------------- transport keys */

section("transport shortcuts (6.4 — key ka naksha)");

/** `eventCombo` ko asli KeyboardEvent nahi, sirf uske paanch field chahiye. */
function keyEvent(init: {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent {
  return {
    key: init.key,
    shiftKey: init.shiftKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: init.altKey ?? false,
  } as KeyboardEvent;
}

test("space ko `space` likha jaata hai, `\" \"` nahi", () => {
  assert.equal(eventCombo(keyEvent({ key: " " })), "space");
});

test("arrow aur shift+arrow alag combo hain", () => {
  assert.equal(eventCombo(keyEvent({ key: "ArrowLeft" })), "arrowleft");
  assert.equal(eventCombo(keyEvent({ key: "ArrowRight", shiftKey: true })), "shift+arrowright");
});

test("Ctrl aur Cmd dono `mod` bante hain", () => {
  assert.equal(eventCombo(keyEvent({ key: "z", ctrlKey: true })), "mod+z");
  assert.equal(eventCombo(keyEvent({ key: "z", metaKey: true })), "mod+z");
});

test("checklist 6.4 ki saari key registry me hain", () => {
  const wanted = [
    "space",
    "arrowleft",
    "arrowright",
    "shift+arrowleft",
    "shift+arrowright",
    "home",
    "end",
  ];
  const have = new Set(SHORTCUTS.map((shortcut) => shortcut.keys));
  for (const keys of wanted) assert.ok(have.has(keys), `"${keys}" ka koi shortcut nahi hai`);
});

test("do shortcut ek hi key par nahi baithe", () => {
  // Yahi wo galti hai jiske liye registry banayi thi — do jagah likhe hote to
  // pehla wala chup-chaap jeet jaata aur doosra kabhi chalta hi nahi.
  const seen = new Map<string, string>();
  for (const shortcut of SHORTCUTS) {
    const clash = seen.get(shortcut.keys);
    assert.equal(clash, undefined, `"${shortcut.keys}" par ${clash} aur ${shortcut.id} dono hain`);
    seen.set(shortcut.keys, shortcut.id);
  }
});

test("label me arrow asli teer dikhta hai", () => {
  assert.equal(comboLabel("shift+arrowleft"), "Shift+←");
  assert.equal(comboLabel("space"), "Space");
  assert.equal(comboLabel("mod+shift+z"), "Ctrl+Shift+Z");
});

/* ------------------------------------------------------------------ end */

console.log(`\n${"-".repeat(60)}`);
if (failures.length > 0) {
  console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
  for (const failure of failures) console.log(`  - ${failure.name}: ${failure.error}`);
  process.exit(1);
}
console.log(`ALL PASS: ${passed} tests, 0 fail`);
