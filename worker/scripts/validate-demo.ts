/**
 * Phase 20 ka asli saboot (20.14) — jaan-boojh kar toota project.
 *
 * ⚠️ Ye script koi render nahi karti, aur wo jaan-boojhkar hai: sawaal hi ye hai
 * ki **render se pehle** kya pakda jaata hai. Render karne par ye ek aur cheez
 * naapti (video sach me bani ya nahi) jiska is phase se koi lena-dena nahi.
 *
 * Chaar galtiyan ek saath daali jaati hain:
 *  1. 480p image, jise 4K me export karne ki koshish
 *  2. ek gayab asset
 *  3. clipping wali awaaz (do clips, dono volume 2 par)
 *  4. anjaan font wala text
 *
 * Phir teen sawaal:
 *  - 4K par saari warnings dikhti hain?
 *  - Strict par export **rukta** hai?
 *  - Theek karne ke baad export chalta hai?
 */

import {
  addItem,
  addTrack,
  canExport,
  createEmptyProject,
  createItem,
  requireExportPreset,
  setItemProperty,
  setItemsProperty,
  validateExportSettings,
  type AssetInfo,
  type Doc,
} from "@reel/core";

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

function printReport(label: string, issues: readonly { ruleId: string; message: string }[]): void {
  console.log(`  ${label}: ${issues.length}`);
  for (const issue of issues) {
    console.log(`    [${issue.ruleId}] ${issue.message}`);
  }
}

function brokenProject(): { doc: Doc; assets: Record<string, AssetInfo | undefined> } {
  const base = createEmptyProject({ name: "Toota project", presetId: "reel" });
  const videoTrack = base.tracks[0]!;
  const audioTrack = base.tracks[1]!;

  // 1. 480p image.
  const small = createItem("image", {
    fps: base.project.fps,
    trackId: videoTrack.id,
    name: "480p tasveer",
    assetId: "as_small",
    startFrame: 0,
    durationInFrames: 90,
  });

  // 2. Gayab asset.
  const missing = createItem("image", {
    fps: base.project.fps,
    trackId: videoTrack.id,
    name: "Gayab tasveer",
    assetId: "as_gayab",
    startFrame: 90,
    durationInFrames: 90,
  });

  // 3. Do awaazein, dono oonchi — milkar clip karengi.
  const voice = createItem("audio", {
    fps: base.project.fps,
    trackId: audioTrack.id,
    name: "Voice",
    assetId: "as_voice",
    startFrame: 0,
    durationInFrames: 180,
  });
  const music = createItem("audio", {
    fps: base.project.fps,
    trackId: audioTrack.id,
    name: "Music",
    assetId: "as_music",
    startFrame: 0,
    durationInFrames: 180,
  });

  let doc = addItem(base, { item: small });
  doc = addItem(doc, { item: missing });
  doc = addItem(doc, { item: voice });
  doc = addItem(doc, { item: music });

  // 4. Anjaan font wala text.
  doc = addTrack(doc, { typeId: "text" });
  const textTrack = doc.tracks[doc.tracks.length - 1]!;
  const text = createItem("text", {
    fps: doc.project.fps,
    trackId: textTrack.id,
    name: "Caption",
    startFrame: 0,
    durationInFrames: 90,
  });
  doc = addItem(doc, { item: text });
  doc = setItemProperty(doc, { itemId: text.id, path: "text.fontFamily", value: "MeraApnaFont" });

  doc = setItemsProperty(doc, {
    itemIds: [voice.id, music.id],
    path: "audio.volume",
    value: 2,
  });

  return {
    doc,
    assets: {
      as_small: { width: 854, height: 480, durationMs: null },
      as_voice: { width: null, height: null, durationMs: 6000 },
      as_music: { width: null, height: null, durationMs: 6000 },
      // `as_gayab` yahan **nahi** hai — wahi to point hai.
    },
  };
}

function main(): void {
  section("1. jaan-boojh kar toota project");
  const { doc, assets } = brokenProject();
  console.log(`  ${doc.items.length} items, ${doc.tracks.length} tracks`);

  section("2. 4K par export ki jaanch (20.14)");
  const uhd = validateExportSettings({ doc, presetId: "uhd", assets });

  printReport("errors", uhd.errors);
  printReport("warnings", uhd.warnings);
  printReport("recommendations", uhd.recommendations);

  const ids = new Set(uhd.issues.map((issue) => issue.ruleId));
  check("gayab asset pakdi gayi", ids.has("missing-asset"));
  check("480p asset par 4K wala message aaya", ids.has("low-res-for-preset"));
  check("clipping ka khatra pakda gaya", ids.has("clipping-risk"));
  check("anjaan font pakda gaya", ids.has("missing-font"));
  check("4K ki sachchai batayi gayi", ids.has("no-gain-from-4k"));

  const lowRes = uhd.issues.find((issue) => issue.ruleId === "low-res-for-preset");
  check(
    "message spec se hu-ba-hu hai (20.5)",
    lowRes?.message === "Low-resolution asset detected. This asset may appear blurry in 4K.",
    lowRes?.message ?? "—",
  );

  section("3. Strict par export rukta hai (20.6)");
  const strict = requireExportPreset("strict");
  const strictReport = validateExportSettings({ doc, presetId: strict.id, assets });

  check("normal tier par bhi error rok rahi hai", canExport(uhd, "normal") === false);
  check("strict tier par export ruka", canExport(strictReport, strict.tier) === false);
  console.log(
    `    strict me ${strictReport.errors.length} error aur ${strictReport.warnings.length} warning — dono rokti hain`,
  );

  section("4. galtiyan theek karke dobara (20.14)");
  /*
   * Har galti theek ki jaati hai — wahi tarika jo user UI me apnata:
   * gayab clip hata do, asset badal do, volume kam karo, font theek karo.
   */
  let fixed: Doc = { ...doc, items: doc.items.filter((item) => item.assetId !== "as_gayab") };

  const textItem = fixed.items.find((item) => item.text !== null);
  if (textItem) {
    fixed = setItemProperty(fixed, {
      itemId: textItem.id,
      path: "text.fontFamily",
      value: "brand.font.display",
    });
  }
  fixed = setItemsProperty(fixed, {
    itemIds: fixed.items.filter((item) => item.assetId?.startsWith("as_v") || item.assetId?.startsWith("as_m")).map((item) => item.id),
    path: "audio.volume",
    value: 0.45,
  });

  const fixedAssets: Record<string, AssetInfo | undefined> = {
    ...assets,
    // 480p ki jagah ab poori 1080p asset.
    as_small: { width: 1080, height: 1920, durationMs: null },
  };

  const after = validateExportSettings({ doc: fixed, presetId: "standard", assets: fixedAssets });
  printReport("errors", after.errors);
  printReport("warnings", after.warnings);

  check("theek karne ke baad koi error nahi", after.errors.length === 0);
  check("theek karne ke baad koi warning nahi", after.warnings.length === 0);
  check(
    "ab strict par bhi export chalega",
    canExport(after, "strict"),
    `${after.errors.length} error, ${after.warnings.length} warning`,
  );

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (validation)`);
}

main();
