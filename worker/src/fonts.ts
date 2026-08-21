import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

import { fontEntryForAsset, parseFontsJson, type Doc, type FontEntry } from "@reel/core";
import { requireRepoRoot } from "@reel/storage";

/**
 * Render ke liye fonts taiyaar karo — **wahi jo preview me chalte hain**.
 *
 * ⚠️ **Ye ek asli, chup-chaap chalne wale bug ka ilaaj hai (2026-08-21 me pakda).**
 * Worker `RenderRequest.fonts` kabhi bharta hi nahi tha, aur font ki files render
 * ke `publicDir` me jaati hi nahi thi. Nateeja bilkul wahi tha jiski chetavni
 * `config/fonts.ts` ke sar par likhi hai: **preview me Poppins dikhta tha aur MP4
 * me system font nikalta tha.** Koi error nahi, koi warning nahi — bas ban chuki
 * reel me font alag hota tha, aur wo tab pata chalta jab reel bhej di jaati.
 *
 * Do cheezein chahiye, aur dono yahin hoti hain:
 *   1. `fonts.json` ki list (taaki `@font-face` ka CSS ban sake)
 *   2. font ki **files** `publicDir/fonts/` me (taaki `url("/fonts/x.woff2")` mile)
 *
 * ⚠️ Sirf list bhej dena kaafi nahi hota — CSS to ban jaata par browser ko file
 * milti hi nahi, aur wo chup-chaap fallback par chala jaata. Isliye jis file ki
 * copy na ho paaye, us entry ko **list se hi hata diya** jaata hai: fallback tab
 * bhi lagega, par kam se kam wo `missingFonts()` ki chetavni me pakda jaayega.
 */

export interface StagedFonts {
  fonts: FontEntry[];
  /** Kaunsi files copy hui — sirf logging/test ke liye. */
  copied: string[];
  /** Jo entry hata di gayi (file hi nahi mili). */
  skipped: string[];
}

export async function stageFonts(publicDir: string, root = requireRepoRoot()): Promise<StagedFonts> {
  const jsonPath = resolve(root, "studio/public/fonts/fonts.json");
  if (!existsSync(jsonPath)) return { fonts: [], copied: [], skipped: [] };

  let parsed: FontEntry[] | null = null;
  try {
    parsed = parseFontsJson(JSON.parse(await readFile(jsonPath, "utf8")));
  } catch {
    // Kharab JSON par render rukna nahi chahiye — system font se reel ban jaayegi.
    return { fonts: [], copied: [], skipped: ["fonts.json padhi nahi ja saki"] };
  }
  if (!parsed || parsed.length === 0) return { fonts: [], copied: [], skipped: [] };

  const sourceDir = resolve(root, "studio/public/fonts");
  const targetDir = resolve(publicDir, "fonts");
  await mkdir(targetDir, { recursive: true });

  const fonts: FontEntry[] = [];
  const copied: string[] = [];
  const skipped: string[] = [];

  for (const font of parsed) {
    const files = [];
    for (const file of font.files) {
      /*
       * ⚠️ Sirf naam liya jaata hai (`basename`) — `fonts.json` me koi `../` likh
       * de to wo poore disk par pahunch sakta hai. Wo file user ki apni hai, par
       * ye path worker me chalta hai aur wahan aisi chhoot rakhna galat hai.
       */
      const name = basename(file.file);
      const from = resolve(sourceDir, name);
      if (!existsSync(from)) {
        skipped.push(`${font.id}: ${name} nahi mili`);
        continue;
      }
      await copyFile(from, resolve(targetDir, name));
      copied.push(name);
      files.push({ ...file, file: name });
    }

    // Jis font ki ek bhi file na aayi ho, use list se bahar — upar wala ⚠️ dekho.
    if (font.files.length > 0 && files.length === 0) {
      skipped.push(`${font.id}: koi file nahi mili, list se hataya`);
      continue;
    }
    fonts.push({ ...font, files });
  }

  return { fonts, copied, skipped };
}

/**
 * Doc me kaun se font ke naam maange gaye hain.
 *
 * ⚠️ Font asset item par `assetId` se nahi lagta — wo `text.fontFamily` me
 * **naam** se aata hai. Isliye `resolveAssets()` use kabhi nahi utaarta, aur
 * yahi wajah thi ki upload kiya hua font render me pahunchta hi nahi.
 */
export function requestedFamilies(doc: Doc): string[] {
  const names = new Set<string>();
  for (const item of doc.items) {
    const family = item.text?.fontFamily;
    // Brand token render ke waqt asli naam me badalta hai — wo yahan nahi ginta.
    if (family && !family.startsWith("brand.")) names.add(family);
  }
  return [...names];
}

export interface FontAssetRow {
  id: string;
  filename: string;
  key: string;
}

/**
 * Upload kiye hue font ki file `publicDir/fonts/` me utaaro aur uski entry banao.
 *
 * ⚠️ Entry ka `file` yahan **sirf naam** hota hai, poora URL nahi — render ke
 * andar wahi `staticFile` waala raasta chalta hai. Studio me wahi entry signed
 * URL ke saath banti hai. Dono jagah `fontFaceCss()` ek hi hai, isliye CSS ek
 * jaisa banta hai aur font dono jagah wahi rehta hai.
 */
export async function stageFontAssets(
  publicDir: string,
  doc: Doc,
  rows: readonly FontAssetRow[],
  read: (key: string) => Promise<Uint8Array | null>,
): Promise<StagedFonts> {
  const wanted = new Set(requestedFamilies(doc));
  if (wanted.size === 0 || rows.length === 0) return { fonts: [], copied: [], skipped: [] };

  const targetDir = resolve(publicDir, "fonts");
  await mkdir(targetDir, { recursive: true });

  const fonts: FontEntry[] = [];
  const copied: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const entry = fontEntryForAsset({ id: row.id, filename: row.filename, src: "" });
    // Sirf wahi font utaro jo doc me sach me maanga gaya hai — poori library
    // utaarna har render me bekaar ka MB hai.
    if (!wanted.has(entry.id)) continue;

    const bytes = await read(row.key);
    if (!bytes) {
      skipped.push(`${entry.id}: storage se file nahi mili`);
      continue;
    }
    const name = `${row.id}${extensionOf(row.filename)}`;
    await writeFile(resolve(targetDir, name), bytes);
    copied.push(name);
    fonts.push(fontEntryForAsset({ id: row.id, filename: row.filename, src: name }));
  }

  return { fonts, copied, skipped };
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot).toLowerCase() : ".woff2";
}
