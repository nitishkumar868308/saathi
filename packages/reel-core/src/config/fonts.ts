/**
 * Font registry — **data**, aur preview aur render dono ke liye **ek hi source**.
 *
 * 9.10 ki asli maang yahi hai: "font load preview me aur render me same ho". Ye
 * sirf safai ki baat nahi — do jagah do alag list rakhne par ek din preview me
 * Poppins dikhta hai aur MP4 me Arial nikalti hai, aur wo galti tab pata chalti
 * hai jab reel ban chuki hoti hai.
 *
 * Isliye:
 *  - list yahan hai (`@reel/core`, jise studio aur `@reel/remotion` dono padhte hain)
 *  - `@font-face` ka CSS bhi yahin banta hai (`fontFaceCss()`)
 *  - dono taraf wahi CSS lagta hai
 *
 * ⚠️ **Repo me koi font file commit nahi hai.** Font ki apni licensing hoti hai,
 * aur kisi doosre ki file bina soche repo me daal dena galat hai. Isliye yahan
 * sirf **system fonts** built-in hain (jo har machine par pehle se hain), aur
 * apna font jodna do kadam ka kaam hai:
 *
 *   1. file `studio/public/fonts/` me rakho
 *   2. `studio/public/fonts/fonts.json` me ek entry jodo
 *
 * Uske baad wo font panel me apne aap dikhne lagta hai — code me kahin kuch
 * nahi badalta.
 */

export interface FontFile {
  /** `studio/public/fonts/` ke andar ka naam. */
  file: string;
  weight: number;
  style: "normal" | "italic";
}

export interface FontEntry {
  /** CSS ka family naam — item ke `text.fontFamily` me yahi jaata hai. */
  id: string;
  label: string;
  /**
   * Fallback stack — font na mile to browser inhe aazmata hai.
   *
   * ⚠️ Ye stack render me bhi wahi rehta hai. Chupchaap kisi aur font par gir
   * jaana ek baar dekh kar samajh nahi aata, isliye missing font ki chetavni
   * `missingFonts()` se alag se aati hai.
   */
  fallback: string;
  /** Khaali = system font, koi file load karne ki zaroorat nahi. */
  files: readonly FontFile[];
  /** Kaunse weight chun'ne layak hain (panel ka dropdown isi se banta hai). */
  weights: readonly number[];
}

/**
 * Built-in — sirf wahi jo har machine par pehle se hain.
 *
 * `system-ui` sabse surakshit default hai: Windows par Segoe, Mac par SF,
 * Android par Roboto. Reel ke liye ye sundar nahi hai, par **kaam karta hai** —
 * aur ek aisa default jo kaam kare, us sundar default se behtar hai jo kabhi
 * load hi na ho.
 */
export const BUILTIN_FONTS: readonly FontEntry[] = [
  {
    id: "system-ui",
    label: "System",
    fallback: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    files: [],
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: "Georgia",
    label: "Serif (Georgia)",
    fallback: "Georgia, 'Times New Roman', serif",
    files: [],
    weights: [400, 700],
  },
  {
    id: "Impact",
    label: "Impact (meme/caption)",
    fallback: "Impact, 'Arial Black', sans-serif",
    files: [],
    weights: [400],
  },
  {
    id: "Courier New",
    label: "Mono (Courier)",
    fallback: "'Courier New', monospace",
    files: [],
    weights: [400, 700],
  },
];

/** Base path jahan se font files serve hoti hain (studio aur Remotion dono). */
export const FONT_BASE_PATH = "/fonts/";

/**
 * Poori list = built-in + jo `fonts.json` se aaye.
 *
 * Runtime par studio `fonts.json` padh kar ise bharta hai; `@reel/remotion` ko
 * wahi list `inputProps` se milti hai. Dono ek hi shape padhte hain.
 */
export function mergeFonts(extra: readonly FontEntry[] | null | undefined): FontEntry[] {
  const byId = new Map<string, FontEntry>();
  for (const font of BUILTIN_FONTS) byId.set(font.id, font);
  for (const font of extra ?? []) byId.set(font.id, font);
  return [...byId.values()];
}

export function getFont(fonts: readonly FontEntry[], id: string): FontEntry | undefined {
  return fonts.find((font) => font.id === id);
}

/** `text.fontFamily` se CSS ka `font-family` — fallback ke saath. */
export function fontFamilyCss(fonts: readonly FontEntry[], id: string): string {
  const font = getFont(fonts, id);
  if (!font) {
    // Anjaan naam ko waise ka waisa aage bhej dete hain: ho sakta hai user ne
    // koi aisa font likha ho jo uske system par hai. Chetavni alag se aati hai.
    return `${quoteFamily(id)}, ${BUILTIN_FONTS[0]?.fallback ?? "sans-serif"}`;
  }
  if (font.files.length === 0) return font.fallback;
  return `${quoteFamily(font.id)}, ${font.fallback}`;
}

function quoteFamily(name: string): string {
  return /[^A-Za-z0-9-]/.test(name) ? `'${name.replace(/'/g, "")}'` : name;
}

/**
 * `@font-face` ka CSS — **yahi string dono jagah lagti hai**.
 *
 * Studio isse ek `<style>` me daalta hai aur `@reel/remotion` bhi. Isliye
 * "preview me load hua par render me nahi" wali samasya ho hi nahi sakti.
 */
export function fontFaceCss(
  fonts: readonly FontEntry[],
  basePath: string = FONT_BASE_PATH,
): string {
  const blocks: string[] = [];
  for (const font of fonts) {
    for (const file of font.files) {
      blocks.push(
        [
          "@font-face {",
          `  font-family: ${quoteFamily(font.id)};`,
          `  src: url("${basePath}${file.file}") format("${formatOf(file.file)}");`,
          `  font-weight: ${file.weight};`,
          `  font-style: ${file.style};`,
          // `block` isliye ki text pehle kisi aur font me dikh kar phir badal
          // jaaye — wo "flash" render me ek-do frame par pakda jaata hai.
          "  font-display: block;",
          "}",
        ].join("\n"),
      );
    }
  }
  return blocks.join("\n\n");
}

function formatOf(file: string): string {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  if (ext === "otf") return "opentype";
  return "truetype";
}

/**
 * Doc me jo font maange gaye hain par list me nahi hain (9.10 ki chetavni).
 *
 * Brand token (`brand.font.display`) yahan **nahi** ginte — wo render ke waqt
 * asli naam me badalte hain, aur unki jaanch Phase 17 me hogi.
 */
export function missingFonts(
  fonts: readonly FontEntry[],
  requested: readonly string[],
): string[] {
  const known = new Set(fonts.map((font) => font.id));
  const missing = new Set<string>();
  for (const name of requested) {
    if (!name || name.startsWith("brand.")) continue;
    if (!known.has(name)) missing.add(name);
  }
  return [...missing];
}
