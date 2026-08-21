/**
 * Responsive layout ke checks.
 *
 * Do tarah ke sawaal hain aur dono zaroori hain:
 *
 *  1. **Naap ka faisla** — `screenFor()` ek pure function hai, isliye uspar
 *     seedhe assertions.
 *  2. **Source ki jaanch** — "har drag wali jagah par `touch-action` laga hai
 *     kya?" jaisa sawaal render kiye bina hi poocha ja sakta hai, aur yahi wo
 *     kism hai jo baad me chup-chaap toot'ti hai: koi naya draggable jodta hai,
 *     mouse se test karta hai, sab theek lagta hai — aur phone par wo clip
 *     khiskane ke bajay page scroll kar deta hai.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { screenFor, DESKTOP_MIN, TABLET_MIN } from "../lib/breakpoint";
import { LANES_TOP_OFFSET, MARKER_LANE_HEIGHT, RULER_HEIGHT } from "../lib/timeline";

let passed = 0;
const failures: { name: string; error: string }[] = [];

async function test(name: string, run: () => void | Promise<void>): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ name, error: message });
    console.log(`  FAIL ${name}\n       ${message.split("\n")[0]}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function main(): Promise<void> {
  section("naap ka faisla");

  await test("asli device ki chaudai sahi khaane me girti hai", () => {
    // Ye numbers asli device hain, mann ke nahi: iPhone SE, iPhone 15,
    // iPad mini portrait, iPad Pro portrait, laptop, desktop.
    assert.equal(screenFor(375), "phone", "iPhone SE");
    assert.equal(screenFor(390), "phone", "iPhone 15");
    assert.equal(screenFor(430), "phone", "iPhone Pro Max");
    assert.equal(screenFor(744), "phone", "iPad mini portrait — teen column yahan bhi nahi aate");
    assert.equal(screenFor(768), "tablet", "iPad portrait");
    assert.equal(screenFor(820), "tablet", "iPad Air portrait");
    assert.equal(screenFor(1024), "tablet", "iPad landscape — 3 column yahan ghut jaate hain");
    assert.equal(screenFor(1280), "desktop", "laptop");
    assert.equal(screenFor(1920), "desktop", "PC");
  });

  await test("hadd par faisla theek hai (off-by-one nahi)", () => {
    assert.equal(screenFor(TABLET_MIN - 1), "phone");
    assert.equal(screenFor(TABLET_MIN), "tablet");
    assert.equal(screenFor(DESKTOP_MIN - 1), "tablet");
    assert.equal(screenFor(DESKTOP_MIN), "desktop");
  });

  await test("bekaar chaudai par desktop — kabhi phone nahi", () => {
    /*
     * ⚠️ 0/NaN par `phone` lautana sabse aasan hota (`0 < 768`), par wo ulta
     * jawab hai. Aisi haalat sirf tab aati hai jab chaudai pata hi na ho — SSR,
     * ya koi test environment. Wahan phone ka layout de dena matlab har server
     * render par mobile HTML bhejna aur hydration par poora tree badalna.
     */
    assert.equal(screenFor(0), "desktop");
    assert.equal(screenFor(Number.NaN), "desktop");
    assert.equal(screenFor(-100), "desktop");
  });

  section("touch — drag wali har jagah");

  const DRAG_FILES = [
    "components/editor/timeline/Clip.tsx",
    "components/editor/timeline/TimelineView.tsx",
    "components/editor/timeline/CaptionLane.tsx",
    "components/editor/timeline/Ruler.tsx",
  ];

  for (const file of DRAG_FILES) {
    await test(`${file} me drag par touch-action bandha hai`, async () => {
      const code = await source(file);
      if (!code.includes("onPointerDown")) return; // is file me drag hai hi nahi
      assert.ok(
        code.includes("touch-none") || code.includes("touchAction"),
        /*
         * Bina iske phone par ungli rakhne se browser page scroll karta hai aur
         * pointermove events aana hi band ho jaate hain — clip hilta hi nahi.
         * Mouse par ye kabhi nahi dikhta, isliye test hi ekmatra pehra hai.
         */
        "drag wali surface par `touch-none` chahiye, warna phone par browser scroll le uddta hai",
      );
    });
  }

  section("timeline ka layout");

  await test("headers ka spacer lanes ke upar wali poori patti jitna hai", async () => {
    /*
     * ⚠️ Ye ek asli bug ka pehra hai (2026-08-21). Lanes ke upar Ruler **aur**
     * MarkerLane dono hain, par headers ke column me sirf `RULER_HEIGHT` ka
     * spacer tha — isliye har track ka header apni lane se 12px upar khisak gaya
     * tha (naapa hua: header top 797 vs lane top 809). Aankh se wo "thoda
     * tirchha" lagta hai aur pakda nahi jaata.
     */
    assert.equal(LANES_TOP_OFFSET, RULER_HEIGHT + MARKER_LANE_HEIGHT);

    const code = await source("components/editor/timeline/TimelineView.tsx");
    assert.ok(
      code.includes("height: LANES_TOP_OFFSET"),
      "headers ka spacer LANES_TOP_OFFSET se aana chahiye, RULER_HEIGHT se nahi",
    );
  });

  await test("marker lane apni oonchai ek hi jagah se leti hai", async () => {
    // Number do jagah likhne par hi wo bug bana tha — dobara na bane.
    const code = await source("components/editor/timeline/MarkerLane.tsx");
    assert.ok(code.includes("MARKER_LANE_HEIGHT"), "apna number nahi, saanjha naap");
  });

  section("mobile shell");

  await test("Editor teenon naap ke liye alag shell chunta hai", async () => {
    const code = await source("components/editor/Editor.tsx");
    assert.ok(code.includes("useScreen"), "Editor ko naap poochhna chahiye");
    assert.ok(code.includes("MobileShell"), "chhoti screen ka apna shell hona chahiye");
  });

  await test("mobile shell ke tap target 44px se chhote nahi", async () => {
    const code = await source("components/editor/MobileShell.tsx");
    /*
     * ⚠️ Ye source padh kar jaancha jaata hai, aur wo jaan-boojhkar hai. Asli
     * naap browser me hoti hai (aur wahan ki gayi bhi hai), par wo test har baar
     * dev server maangta. Yahan sirf itna pakka hota hai ki koi galti se
     * `h-8` (32px) jaisa chhota button na daal de — jo ungli ke liye chhota hai
     * par mouse par bilkul theek dikhta hai.
     */
    const tooSmall = code.match(/className="[^"]*\bh-(?:6|7|8|9)\b[^"]*"/g) ?? [];
    assert.equal(
      tooSmall.length,
      0,
      `chhote tap target mile: ${tooSmall.slice(0, 3).join(" | ")}`,
    );
    assert.ok(code.includes("min-h-[44px]") || code.includes("h-14") || code.includes("h-12"));
  });

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure.name}: ${failure.error}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} tests, 0 fail`);
}

void main();
