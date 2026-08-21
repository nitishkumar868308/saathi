/**
 * Shortcuts ke checks (16.5 / 16.6 / 16.7).
 *
 * ⚠️ Ye script `shortcuts.ts` ko **import nahi** karti, uska source **padhti**
 * hai — aur ye majboori bhi hai aur faayda bhi.
 *
 * Majboori: us file me `@/lib/store` aur `@/lib/playback` aate hain, jo browser
 * ke bina chalte hi nahi (Remotion ka player, React ke hooks). Node me use
 * import karna namumkin hai.
 *
 * Faayda: registry ki asli list padhi jaati hai, kisi copy se nahi. Do shortcut
 * ek key par baith jaayein — wo yahin pakda jaata hai, browser me nahi. Aur wahi
 * wo galti hai jo kabhi khud se nahi dikhti: ek key kabhi ek kaam karti hai
 * kabhi doosra (jo pehle list me mila).
 *
 * Keys ka ganit `lib/shortcutKeys.ts` me hai (usme browser ka kuch nahi), isliye
 * wo seedha import hota hai aur sach me chalaya jaata hai.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  comboLabel,
  conflictingIds,
  resolvedKeys,
  type ShortcutMeta,
} from "../lib/shortcutKeys";

let passed = 0;
const failures: { name: string; error: string }[] = [];

function test(name: string, run: () => void): void {
  try {
    run();
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

/** `shortcuts.ts` ke registry block se saari entries nikaalo. */
function readShortcuts(): ShortcutMeta[] {
  const here = dirname(fileURLToPath(import.meta.url));
  /*
   * Windows wale line-end hata do.
   *
   * Repo Windows par hai aur file me CRLF hote hain. Bina iske har wo pattern
   * jo line-break dhoondhta hai chup-chaap fail ho jaata hai.
   */
  const source = readFileSync(resolve(here, "../lib/shortcuts.ts"), "utf8")
    .split(String.fromCharCode(13, 10))
    .join(String.fromCharCode(10));

  const from = source.indexOf("export const SHORTCUTS");
  assert.ok(from > 0, "SHORTCUTS registry nahi mili");
  const to = source.indexOf("\n];\n", from);
  assert.ok(to > from, "SHORTCUTS registry ka ant nahi mila");

  const block = source.slice(from, to);
  const pattern =
    /id:\s*"([^"]+)",\s*\n\s*keys:\s*"([^"]+)",\s*\n\s*label:\s*"([^"]+)",\s*\n\s*group:\s*"([^"]+)"/g;

  const out: ShortcutMeta[] = [];
  for (const match of block.matchAll(pattern)) {
    out.push({
      id: match[1] as string,
      keys: match[2] as string,
      label: match[3] as string,
      group: match[4] as ShortcutMeta["group"],
    });
  }
  return out;
}

const SHORTCUTS = readShortcuts();

section("registry (16.5)");

test("registry padhi ja saki aur usme kaafi entries hain", () => {
  // 16.5 me lagbhag 25 shortcuts maange gaye the; kam nikle to kuch chhoot gaya.
  assert.ok(SHORTCUTS.length >= 35, `sirf ${SHORTCUTS.length} shortcuts mile`);
});

test("har entry ka id ek hi baar aata hai", () => {
  const ids = SHORTCUTS.map((entry) => entry.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], [], "dohre id");
});

test("do shortcut ek hi key par nahi baithe", () => {
  /*
   * Ye is poori script ki sabse zaroori line hai. Takraav hone par ek key kabhi
   * ek kaam karti hai kabhi doosra — aur wo galti dekh kar samajh hi nahi aati.
   */
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const entry of SHORTCUTS) {
    const first = seen.get(entry.keys);
    if (first) clashes.push(`${entry.keys}: ${first} vs ${entry.id}`);
    else seen.set(entry.keys, entry.id);
  }
  assert.deepEqual(clashes, []);
});

test("keys chhote akshar me hain aur modifiers sahi kram me", () => {
  // `eventCombo` hamesha `mod+alt+shift+key` ke kram me banata hai. Registry me
  // ulta kram likhne par wo shortcut kabhi chalega hi nahi — aur chup-chaap.
  const ORDER = ["mod", "alt", "shift"];
  for (const entry of SHORTCUTS) {
    assert.equal(entry.keys, entry.keys.toLowerCase(), `${entry.id}: bade akshar`);

    /*
     * `"+"` khud ek key hai (zoom in), isliye seedha `split("+")` galat jawab
     * deta hai — wo `["", ""]` banata hai. Isliye sirf **shuru** ke wo hisse
     * modifier maane jaate hain jo sach me modifier hain.
     */
    const parts = entry.keys === "+" ? ["+"] : entry.keys.split("+");
    const mods: string[] = [];
    for (const part of parts.slice(0, -1)) {
      mods.push(part);
    }
    const sorted = [...mods].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    assert.deepEqual(mods, sorted, `${entry.id}: modifiers ka kram galat (${entry.keys})`);
    for (const mod of mods) {
      assert.ok(ORDER.includes(mod), `${entry.id}: "${mod}" koi modifier nahi hai`);
    }
  }
});

test("har entry ka group cheat-sheet ke chaar groups me se ek hai", () => {
  // Cheat-sheet in chaar par map karta hai; naya group aane par wo shortcut
  // dialog me dikhta hi nahi — yaani chup-chaap gayab.
  const KNOWN = ["edit", "transport", "timeline", "editing"];
  for (const entry of SHORTCUTS) {
    assert.ok(KNOWN.includes(entry.group), `${entry.id}: anjaan group "${entry.group}"`);
  }
});

test("16.5 ke maange hue saare shortcuts maujood hain", () => {
  /*
   * Checklist se seedha uthaayi gayi list. Isse ye pakka hota hai ki koi
   * shortcut chup-chaap chhoot na jaaye — aur agar jaan-boojhkar chhoda ho to
   * ye test fail hoga aur uski wajah likhni padegi.
   */
  const REQUIRED = [
    "space",
    "j",
    "k",
    "l",
    "arrowleft",
    "arrowright",
    "shift+arrowleft",
    "shift+arrowright",
    "home",
    "end",
    "i",
    "o",
    "s",
    "mod+d",
    "mod+c",
    "mod+x",
    "mod+v",
    "delete",
    "shift+delete",
    "mod+z",
    "mod+shift+z",
    "mod+a",
    "mod+s",
    "-",
    "shift+z",
    "m",
    "[",
    "]",
  ];
  const have = new Set(SHORTCUTS.map((entry) => entry.keys));
  const missing = REQUIRED.filter((keys) => !have.has(keys));
  assert.deepEqual(missing, [], "ye shortcuts registry me nahi mile");
});

section("combo ka roop (16.6)");

test("comboLabel padhne layak roop deta hai", () => {
  assert.equal(comboLabel("mod+shift+z"), "Ctrl+Shift+Z");
  assert.equal(comboLabel("mod+shift+z", true), "⌘⇧Z".replace("⇧", "Shift"));
  assert.equal(comboLabel("space"), "Space");
  assert.equal(comboLabel("arrowleft"), "←");
  assert.equal(comboLabel("shift+delete"), "Shift+Del");
});

test("har shortcut ka label khaali nahi hai", () => {
  // Khaali label wala shortcut cheat-sheet me ek khaali row bankar aata hai,
  // aur user ko lagta hai ki wahan kuch toota hua hai.
  for (const entry of SHORTCUTS) {
    assert.ok(entry.label.trim().length > 0, `${entry.id} ka label khaali hai`);
  }
});

section("remap (16.7)");

test("remap ke bina asli key hi milti hai", () => {
  const entry = SHORTCUTS[0] as ShortcutMeta;
  assert.equal(resolvedKeys(entry, {}), entry.keys);
});

test("remap asli key ke upar chalta hai", () => {
  const entry = SHORTCUTS[0] as ShortcutMeta;
  assert.equal(resolvedKeys(entry, { [entry.id]: "mod+alt+q" }), "mod+alt+q");
});

test("remap se bana takraav pakda jaata hai", () => {
  /*
   * Remap me takraav bahut aasani se hota hai — user ek key chunta hai jo pehle
   * se kisi aur ke paas hai. Isliye dialog use **pehle hi** dikhata hai.
   */
  const first = SHORTCUTS[0] as ShortcutMeta;
  const second = SHORTCUTS[1] as ShortcutMeta;

  assert.deepEqual(conflictingIds(SHORTCUTS, {}), [], "bina remap ke koi takraav nahi hona chahiye");

  const clashing = conflictingIds(SHORTCUTS, { [second.id]: first.keys });
  assert.ok(clashing.includes(first.id), "dono id aani chahiye");
  assert.ok(clashing.includes(second.id));
});

test("remap ek shortcut ko doosre ki key par le jaakar bhi list poori rakhta hai", () => {
  const entry = SHORTCUTS[0] as ShortcutMeta;
  const remap = { [entry.id]: "mod+alt+shift+f9" };
  const keys = SHORTCUTS.map((item) => resolvedKeys(item, remap));
  assert.equal(keys.length, SHORTCUTS.length);
  assert.ok(keys.includes("mod+alt+shift+f9"));
});

section("UI ke tooltip registry se hi aate hain (6.4)");

/**
 * Har jagah jo `shortcutLabel("kuch")` bulati hai, uska id registry me hona
 * chahiye.
 *
 * Ye test ek asli chot se aaya: `TransportBar` frame-step buttons ke liye
 * `"frame-back"` / `"frame-forward"` maangta tha, par Phase 8 me arrow keys
 * dohre kaam ki ho gayi aur registry me unka naam `"nudge-back"` /
 * `"nudge-forward"` ho gaya. `shortcutLabel()` na milne par khaali string deta
 * hai — isliye kuch toota nahi, bas tooltip se `←` aur `→` **chup-chaap gayab**
 * ho gaye. Button dikhta bilkul theek tha.
 *
 * Chupchaap gayab hona hi sabse buri surat hai: koi error nahi, koi test lal
 * nahi, sirf ek din user ko pata hi nahi chalta ki arrow key se frame khiskti
 * hai. Isliye ab rename us din pakda jaayega jis din wo hoga.
 */
test("shortcutLabel() jo bhi id maangta hai wo registry me maujood hai", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const ids = new Set(SHORTCUTS.map((entry) => entry.id));

  // Jo file bhi tooltip banati hai, use yahan jodo.
  const files = [
    "../components/editor/preview/TransportBar.tsx",
    "../components/editor/timeline/TimelineView.tsx",
    "../components/editor/TopBar.tsx",
  ];

  const missing: string[] = [];
  let found = 0;

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(resolve(here, file), "utf8");
    } catch {
      continue; // File abhi hai hi nahi — us par test rokna bekaar hai.
    }
    for (const match of source.matchAll(/shortcutLabel\(\s*"([^"]+)"\s*\)/g)) {
      found += 1;
      const id = match[1] as string;
      if (!ids.has(id)) missing.push(`${file.split("/").pop()} → "${id}"`);
    }
  }

  assert.ok(found > 0, "ek bhi shortcutLabel() call nahi mila — test bekaar ho gaya");
  assert.deepEqual(
    missing,
    [],
    `ye id registry me nahi hain (tooltip chup-chaap khaali reh jaayega):\n  ${missing.join("\n  ")}`,
  );
});

console.log(`\n${"-".repeat(60)}`);
if (failures.length > 0) {
  console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
  for (const failure of failures) console.log(`  - ${failure.name}: ${failure.error}`);
  process.exit(1);
}
console.log(`ALL PASS: ${passed} tests, 0 fail`);
