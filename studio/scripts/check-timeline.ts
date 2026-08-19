/**
 * Timeline ke ganit ka check — bina browser ke.
 *
 * Timeline me galti aankh se pakadna sabse mushkil hai: ek clip aadha pixel
 * khisak kar baithe to wo "theek hi lag raha hai" dikhta hai, aur zoom karne par
 * hi pata chalta hai. Isliye poora naksha `lib/timeline.ts` ke pure functions se
 * banta hai aur yahan numbers se naapa jaata hai.
 *
 * Yahan checklist 7.14 ka script wala hissa bhi hai: **3 track aur 12 clip ka
 * asli doc** banaya jaata hai (ops se, haath se nahi) aur har clip ki jagah
 * naapi jaati hai — 30fps aur 24fps dono par.
 *
 * Chalane ka tarika:  npm run check --workspace @reel/studio
 */

import assert from "node:assert/strict";

import {
  addItem,
  addTrack,
  createEmptyProject,
  createItem,
  framesToTimecode,
  requireTrackType,
  secondsToFrames,
  setTrackProperty,
  type Doc,
  type Track,
} from "@reel/core";

import {
  DEFAULT_PX_PER_FRAME,
  MAX_PX_PER_FRAME,
  MIN_PX_PER_FRAME,
  MIN_LABEL_PX,
  MIN_TICK_PX,
  clampPxPerFrame,
  clampTrackHeight,
  clipLabel,
  fitPxPerFrame,
  followScrollLeft,
  frameToX,
  itemIntersects,
  itemRect,
  itemsInMarquee,
  rectFromPoints,
  rowAtY,
  rulerScale,
  rulerTicks,
  scrollLeftAfterZoom,
  setInPoint,
  setOutPoint,
  totalTracksHeight,
  trackRows,
  visibleFrames,
  visibleItems,
  xToFrame,
} from "../lib/timeline";

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

/* ------------------------------------------------------------- fixture */

/**
 * 3 track, 12 clip — checklist 7.14 ka doc.
 *
 * Ops se banta hai, haath se object likh kar nahi: isse ye bhi jaanch ho jaati
 * hai ki jo doc asli editor banata hai wahi timeline theek se draw karta hai.
 */
function fixture(fps: number): { doc: Doc; tracks: Track[] } {
  let doc = createEmptyProject({ name: `Timeline fixture ${fps}fps`, fps });

  // Khaali project do track ke saath aata hai (video + audio); teesra jodte hain.
  doc = addTrack(doc, { typeId: "text", name: "Captions" });
  const tracks = [...doc.tracks].sort((a, b) => a.order - b.order);
  assert.equal(tracks.length, 3, "fixture me teen track hone chahiye");

  const perTrack = 4;
  for (const track of tracks) {
    const type = requireTrackType(track.type);
    const itemType = type.accepts[0] as string;
    for (let i = 0; i < perTrack; i += 1) {
      // Har clip 2 second lambi, 3 second ke antaraal par — seconds se frames
      // hamesha helper se, taaki 24 aur 30 dono par ginti sahi rahe.
      const item = createItem(itemType, {
        trackId: track.id,
        name: `${track.name} ${i + 1}`,
        startFrame: secondsToFrames(i * 3, fps),
        durationInFrames: secondsToFrames(2, fps),
      });
      doc = addItem(doc, { item });
    }
  }

  assert.equal(doc.items.length, 12, "fixture me baarah clip hone chahiye");
  return { doc, tracks };
}

/* ---------------------------------------------------------------- zoom */

section("zoom (7.1 / 7.3)");

test("hadd ke bahar ki value clamp hoti hai", () => {
  assert.equal(clampPxPerFrame(0), MIN_PX_PER_FRAME);
  assert.equal(clampPxPerFrame(1e9), MAX_PX_PER_FRAME);
  assert.equal(clampPxPerFrame(Number.NaN), DEFAULT_PX_PER_FRAME);
  assert.equal(clampPxPerFrame(2.5), 2.5);
});

test("fit project poore project ko dabbe me le aata hai", () => {
  const px = fitPxPerFrame(900, 300);
  assert.equal(px, 3);
  assert.equal(frameToX(300, px), 900);
});

test("bahut lambe project par fit MIN se neeche nahi girta", () => {
  // 10 ghante @ 30fps — itna zoom-out karne par clip 1px se bhi patli ho jaati.
  const px = fitPxPerFrame(900, 30 * 60 * 60 * 10);
  assert.equal(px, MIN_PX_PER_FRAME);
});

test("frame <-> x aapas me ulte hain", () => {
  for (const px of [0.05, 1, 4, 17.5, 40]) {
    for (const frame of [0, 1, 37, 512, 18000]) {
      assert.equal(xToFrame(frameToX(frame, px), px), frame, `px=${px} frame=${frame}`);
    }
  }
});

test("cursor ke neeche wala frame zoom ke baad wahin rehta hai", () => {
  const pxPerFrame = 4;
  const nextPxPerFrame = 8;
  const scrollLeft = 400;
  const cursorX = 200;

  // Cursor ke neeche abhi kaunsa frame hai?
  const before = (scrollLeft + cursorX) / pxPerFrame;
  const nextScroll = scrollLeftAfterZoom({ scrollLeft, cursorX, pxPerFrame, nextPxPerFrame });
  const after = (nextScroll + cursorX) / nextPxPerFrame;

  assert.ok(Math.abs(before - after) < 1e-9, `frame khisak gaya: ${before} -> ${after}`);
});

test("shuruaat me zoom karne par scroll negative nahi hota", () => {
  const next = scrollLeftAfterZoom({
    scrollLeft: 0,
    cursorX: 10,
    pxPerFrame: 40,
    nextPxPerFrame: 0.5,
  });
  assert.ok(next >= 0, `negative scroll: ${next}`);
});

/* --------------------------------------------------------------- ruler */

section("ruler (7.2 — fps 24/25/30/60 sab par)");

test("har fps par ek-second ki seedhi theek fps frames ki hoti hai", () => {
  for (const fps of [24, 25, 30, 60]) {
    // Aisa zoom jispar 1 second to aa jaaye par 1 frame nahi.
    const pxPerFrame = MIN_LABEL_PX / fps;
    const scale = rulerScale(pxPerFrame, fps);
    assert.equal(scale.majorFrames, fps, `fps ${fps} par major ${scale.majorFrames} aaya`);
  }
});

test("label hamesha timecode helper se banta hai", () => {
  for (const fps of [24, 25, 30, 60]) {
    const pxPerFrame = MIN_LABEL_PX / fps;
    const ticks = rulerTicks({ fromFrame: 0, toFrame: fps * 3, pxPerFrame, fps });
    const majors = ticks.filter((tick) => tick.major);
    assert.ok(majors.length >= 3, `fps ${fps} par sirf ${majors.length} label`);
    for (const tick of majors) {
      assert.equal(tick.label, framesToTimecode(tick.frame, fps, { compact: true }));
    }
    // 25fps par doosra label theek 00:01:00 par hona chahiye — pixel-step wale
    // tarike me yahi galat girta tha.
    assert.equal(majors[1]?.frame, fps);
  }
});

test("bahut zoom-in par seedhi frames me girti hai", () => {
  const scale = rulerScale(30, 30); // 30px per frame
  assert.ok(scale.majorFrames < 30, `frame-level seedhi chahiye thi, mili ${scale.majorFrames}`);
});

test("bahut zoom-out par seedhi minute/ghante me chadh jaati hai", () => {
  const scale = rulerScale(0.02, 30);
  assert.ok(
    scale.majorFrames >= 30 * 60,
    `kam se kam ek minute ki seedhi chahiye, mili ${scale.majorFrames}`,
  );
});

test("har label ke liye kam se kam MIN_LABEL_PX jagah hoti hai", () => {
  for (const fps of [24, 25, 30, 60]) {
    for (const px of [0.02, 0.1, 0.5, 1, 4, 12, 40]) {
      const scale = rulerScale(px, fps);
      assert.ok(
        scale.majorFrames * px >= MIN_LABEL_PX,
        `fps ${fps} px ${px}: label ke liye sirf ${scale.majorFrames * px}px`,
      );
      assert.ok(scale.minorFrames * px >= MIN_TICK_PX || scale.minorFrames === scale.majorFrames);
      assert.equal(scale.majorFrames % scale.minorFrames, 0, "minor major ka bhaag hona chahiye");
    }
  }
});

test("ticks sirf maangi hui range me banti hain", () => {
  const ticks = rulerTicks({ fromFrame: 600, toFrame: 900, pxPerFrame: 4, fps: 30 });
  assert.ok(ticks.length > 0);
  for (const tick of ticks) {
    assert.ok(tick.frame >= 0 && tick.frame <= 900, `range ke bahar: ${tick.frame}`);
  }
  // Pehla tick range se thoda pehle ho sakta hai (seedhi par snap), par bahut
  // pehle nahi — warna poore project ki ticks ban rahi hain.
  assert.ok((ticks[0] as { frame: number }).frame >= 500);
});

/* ------------------------------------------------------ virtualization */

section("virtualization (7.7)");

test("dikh rahi range scroll ke saath khisakti hai", () => {
  const range = visibleFrames({ scrollLeft: 400, viewportWidth: 800, pxPerFrame: 4, overscanPx: 0 });
  assert.deepEqual(range, { fromFrame: 100, toFrame: 300 });
});

test("range kabhi negative nahi hoti", () => {
  const range = visibleFrames({ scrollLeft: 0, viewportWidth: 800, pxPerFrame: 4 });
  assert.equal(range.fromFrame, 0);
});

test("screen se lambi clip bhi dikhti hai (sirf start dekhna galat hai)", () => {
  const range = { fromFrame: 100, toFrame: 200 };
  // Ye clip 0 se 1000 tak hai — uska start range se bahut peeche hai.
  assert.equal(itemIntersects({ startFrame: 0, durationInFrames: 1000 }, range), true);
  assert.equal(itemIntersects({ startFrame: 210, durationInFrames: 10 }, range), false);
  assert.equal(itemIntersects({ startFrame: 50, durationInFrames: 40 }, range), false);
});

test("kinare par lage clip do baar nahi ginte", () => {
  const range = { fromFrame: 100, toFrame: 200 };
  // 100 par khatam hone wali clip abhi bahar hai, 200 par shuru hone wali bhi.
  assert.equal(itemIntersects({ startFrame: 60, durationInFrames: 40 }, range), false);
  assert.equal(itemIntersects({ startFrame: 200, durationInFrames: 40 }, range), false);
});

/* -------------------------------------------------------- track layout */

section("track rows (7.5 — doc ke tracks se, fixed list se nahi)");

test("rows order se bante hain aur ek dusre ke neeche baithte hain", () => {
  const { doc } = fixture(30);
  const rows = trackRows(doc.tracks);
  assert.equal(rows.length, 3);

  let expectedTop = 0;
  for (const row of rows) {
    assert.equal(row.top, expectedTop, `${row.track.name} galat jagah par`);
    assert.equal(row.height, requireTrackType(row.track.type).defaultHeight);
    expectedTop += row.height;
  }
  assert.equal(totalTracksHeight(rows), expectedTop);
});

test("user ki badli hui oonchai registry ke default par jeetati hai", () => {
  const { doc, tracks } = fixture(30);
  const first = tracks[0] as Track;
  const rows = trackRows(doc.tracks, { [first.id]: 120 });
  assert.equal(rows[0]?.height, 120);
  // …aur uske neeche wala row utna hi neeche khisak jaata hai.
  assert.equal(rows[1]?.top, 120);
});

test("oonchai hadd me rehti hai", () => {
  assert.equal(clampTrackHeight(5), 28);
  assert.equal(clampTrackHeight(5000), 200);
  assert.equal(clampTrackHeight(Number.NaN), 48);
});

test("y se sahi track milta hai", () => {
  const { doc } = fixture(30);
  const rows = trackRows(doc.tracks);
  const second = rows[1];
  assert.ok(second);
  assert.equal(rowAtY(rows, second.top)?.track.id, second.track.id);
  assert.equal(rowAtY(rows, second.top + second.height - 1)?.track.id, second.track.id);
  // Bilkul kinare par agla row shuru hota hai — off-by-one yahin pakda jaata hai.
  assert.equal(rowAtY(rows, second.top + second.height)?.track.id, rows[2]?.track.id);
  assert.equal(rowAtY(rows, totalTracksHeight(rows) + 10), null);
});

/* ------------------------------------------------- 7.14 — asli doc naapo */

section("3 track / 12 clip ka doc sahi jagah dikhta hai (7.14)");

for (const fps of [30, 24]) {
  test(`${fps}fps: har clip ki jagah seconds se milti hai`, () => {
    const { doc, tracks } = fixture(fps);
    const rows = trackRows(doc.tracks);
    const pxPerFrame = 4;

    for (const track of tracks) {
      const onTrack = doc.items
        .filter((item) => item.trackId === track.id)
        .sort((a, b) => a.startFrame - b.startFrame);
      assert.equal(onTrack.length, 4);

      onTrack.forEach((item, index) => {
        const rect = itemRect(item, rows, pxPerFrame);
        assert.ok(rect, `${item.name} ka rect nahi bana`);
        // x sach me "i * 3 second" par hona chahiye — dono fps par.
        assert.equal(rect.x, secondsToFrames(index * 3, fps) * pxPerFrame);
        assert.equal(rect.width, secondsToFrames(2, fps) * pxPerFrame);
        assert.equal(rect.y, rows.find((row) => row.track.id === track.id)?.top);
      });
    }
  });

  test(`${fps}fps: 12 me se sirf dikhne wale clip render hote hain`, () => {
    const { doc } = fixture(fps);
    // Pehle 4 second dikha rahe hain: har track par clip 1 (0-2s) aur clip 2 (3-5s).
    const range = { fromFrame: 0, toFrame: secondsToFrames(4, fps) };
    const shown = visibleItems(doc.items, range);
    assert.equal(shown.length, 6, `${shown.length} clip dikhe, 6 chahiye the`);
  });
}

test("24fps aur 30fps me clip ki pixel-jagah alag hoti hai (fps sach me use ho raha hai)", () => {
  const at30 = fixture(30).doc.items.map((item) => item.startFrame).sort((a, b) => a - b);
  const at24 = fixture(24).doc.items.map((item) => item.startFrame).sort((a, b) => a - b);
  assert.notDeepEqual(at30, at24, "dono fps par frames ek jaise aa gaye — kahin fps hardcode hai");
  // Aakhri clip 3 x 3 = 9 second par shuru hoti hai.
  assert.equal(Math.max(...at30), secondsToFrames(9, 30));
  assert.equal(Math.max(...at24), secondsToFrames(9, 24));
});

/* ------------------------------------------------------------- marquee */

section("marquee selection (7.8)");

test("chhoona kaafi hai, poora dhakna zaroori nahi", () => {
  const { doc, tracks } = fixture(30);
  const rows = trackRows(doc.tracks);
  const pxPerFrame = 4;
  const first = tracks[0] as Track;

  // Sirf pehle track ki pehli clip ke ek kone ko chhoo rahe hain.
  const row = rows[0];
  assert.ok(row);
  const rect = rectFromPoints({ x: 0, y: row.top + 2 }, { x: 4, y: row.top + 6 });
  const hits = itemsInMarquee(doc.items, rows, rect, pxPerFrame);

  assert.equal(hits.length, 1);
  const hit = doc.items.find((item) => item.id === hits[0]);
  assert.equal(hit?.trackId, first.id);
  assert.equal(hit?.startFrame, 0);
});

test("poore timeline par band kheenchne se saare 12 clip aate hain", () => {
  const { doc } = fixture(30);
  const rows = trackRows(doc.tracks);
  const rect = rectFromPoints({ x: 0, y: 0 }, { x: 100000, y: totalTracksHeight(rows) });
  assert.equal(itemsInMarquee(doc.items, rows, rect, 4).length, 12);
});

test("ek track ki poori patti sirf usi track ke clip uthati hai", () => {
  const { doc, tracks } = fixture(30);
  const rows = trackRows(doc.tracks);
  const row = rows[1];
  assert.ok(row);

  const rect = rectFromPoints({ x: 0, y: row.top }, { x: 100000, y: row.top + row.height - 1 });
  const hits = itemsInMarquee(doc.items, rows, rect, 4);
  assert.equal(hits.length, 4);
  for (const id of hits) {
    assert.equal(doc.items.find((item) => item.id === id)?.trackId, (tracks[1] as Track).id);
  }
});

test("kisi bhi disha me kheencha gaya band ek jaisa rectangle deta hai", () => {
  const forward = rectFromPoints({ x: 10, y: 20 }, { x: 50, y: 80 });
  const backward = rectFromPoints({ x: 50, y: 80 }, { x: 10, y: 20 });
  assert.deepEqual(forward, backward);
  assert.deepEqual(forward, { x: 10, y: 20, width: 40, height: 60 });
});

/* --------------------------------------------------------- auto scroll */

section("playhead follow (7.4)");

test("playhead dikh raha ho to scroll nahi hilta", () => {
  const next = followScrollLeft({
    playheadFrame: 200,
    scrollLeft: 400,
    viewportWidth: 800,
    pxPerFrame: 4,
  });
  // 200 * 4 = 800, jo 400..1200 ke beech hai aur dono kinaron se 80px door.
  assert.equal(next, null);
});

test("daayein kinare par pahunchte hi timeline aage badhti hai", () => {
  const next = followScrollLeft({
    playheadFrame: 295,
    scrollLeft: 400,
    viewportWidth: 800,
    pxPerFrame: 4,
  });
  assert.ok(next !== null && next > 400, `scroll aage badhna chahiye tha, mila ${next}`);
});

test("peeche seek karne par timeline peeche aati hai, par 0 se neeche nahi", () => {
  assert.equal(
    followScrollLeft({ playheadFrame: 5, scrollLeft: 400, viewportWidth: 800, pxPerFrame: 4 }),
    0,
  );
});

/* ----------------------------------------------------------- in / out */

section("in / out points (7.11)");

test("in aur out ulte nahi ho sakte", () => {
  let state = setOutPoint({ inFrame: null, outFrame: null }, 100, 300);
  assert.deepEqual(state, { inFrame: null, outFrame: 100 });

  // Out (100) ke baad In (150) lagaya — out ka ab koi matlab nahi, wo hat jaata hai.
  state = setInPoint(state, 150, 300);
  assert.deepEqual(state, { inFrame: 150, outFrame: null });

  state = setOutPoint(state, 250, 300);
  assert.deepEqual(state, { inFrame: 150, outFrame: 250 });
});

test("dono project ki hadd me clamp hote hain", () => {
  const state = setInPoint({ inFrame: null, outFrame: null }, 99999, 300);
  assert.equal(state.inFrame, 300);
});

/* ------------------------------------------------------------- labels */

section("clip label (7.6)");

test("text item par uska apna content dikhta hai, naam nahi", () => {
  const item = createItem("text", { trackId: "t1", name: "Text 3" });

  const withContent = { ...item, text: { ...(item.text as object), content: "Naya offer!" } };
  assert.equal(clipLabel(withContent as typeof item), "Naya offer!");

  // Content khaali ho tabhi naam par girta hai — "Text 3" se clip pehchana hi
  // nahi jaata, isliye content hamesha jeetni chahiye.
  const empty = { ...item, text: { ...(item.text as object), content: "   " } };
  assert.equal(clipLabel(empty as typeof item), "Text 3");

  // Bina text wale item (image/video) par bhi naam hi dikhta hai.
  const image = createItem("image", { trackId: "t1", name: "poster.jpg" });
  assert.equal(clipLabel(image), "poster.jpg");
});

test("bahut lamba text kaata jaata hai", () => {
  const item = createItem("text", { trackId: "t1", name: "Text" });
  const long = { ...item, text: { ...(item.text as object), content: "a".repeat(200) } };
  const label = clipLabel(long as typeof item);
  assert.ok(label.length <= 61, `label ${label.length} akshar ka hai`);
  assert.ok(label.endsWith("…"));
});

/* ------------------------------------------------------- track toggles */

section("track mute/hide/lock op se chalte hain (7.5)");

test("setTrackProperty track badalta hai aur purana doc chhuta nahi", () => {
  const { doc, tracks } = fixture(30);
  const first = tracks[0] as Track;

  const next = setTrackProperty(doc, { trackId: first.id, path: "muted", value: true });
  assert.equal(next.tracks.find((track) => track.id === first.id)?.muted, true);
  // Purana doc waisa ka waisa — isi par undo tika hua hai.
  assert.equal(doc.tracks.find((track) => track.id === first.id)?.muted, false);
});

test("id / type / order path se nahi badalte", () => {
  const { doc, tracks } = fixture(30);
  const first = tracks[0] as Track;
  for (const path of ["id", "type", "order"]) {
    assert.throws(
      () => setTrackProperty(doc, { trackId: first.id, path, value: "x" }),
      /seedhe set nahi hota/,
      `${path} chup-chaap badal gaya`,
    );
  }
});

/* ------------------------------------------------------------------ end */

console.log(`\n${"-".repeat(60)}`);
if (failures.length > 0) {
  console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
  for (const failure of failures) console.log(`  - ${failure.name}: ${failure.error}`);
  process.exit(1);
}
console.log(`ALL PASS: ${passed} tests, 0 fail`);
