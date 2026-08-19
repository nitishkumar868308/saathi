/**
 * Brand tokens — Dynamic rule 9 ka doosra aadha hissa.
 *
 * Item me `"#C25A37"` nahi likha jaata, `"brand.primary"` likha jaata hai; rang
 * render ke waqt yahan se resolve hota hai. Isi wajah se brand badalte hi poori
 * reel badal jaati hai, ek-ek item ko chhue bina.
 *
 * ⚠️ Ye **default** brand hai, akhri nahi. Phase 17 me `reel_brand_presets` table
 * se asli presets aayenge aur ye sirf fallback ban jaayega. Aaj ye zaroori hai:
 * iske bina text ka `color: "brand.text"` seedha CSS me chala jaata aur browser
 * use chupchaap gira deta — text kaala ya gayab dikhta aur wajah samajh nahi aati.
 *
 * Rang `web/app/globals.css` ke asli Apka Saathi palette se liye hain, taaki
 * reels aur website ek hi parivaar ke lagein.
 */

export type BrandTokens = Record<string, string>;

export const DEFAULT_BRAND_TOKENS: BrandTokens = {
  // Rang — web ke CSS variables se (rgb -> hex).
  "brand.primary": "#C25A37", // terracotta
  "brand.primaryDark": "#A8492B",
  "brand.accent": "#E0A458", // amber warm
  "brand.sage": "#7C8A6B",
  "brand.text": "#FFF9F0", // gehre background par padhne layak
  "brand.textMuted": "#D6C9B8",
  "brand.textOnAccent": "#241F1A",
  "brand.background": "#1A1714",
  "brand.surface": "#2E2823",
  "brand.line": "#E5DBC9",

  /*
   * Fonts jaan-boojhkar **system** fonts hain.
   *
   * Google Fonts se maangna matlab render ke waqt internet chahiye, aur net na
   * hone par text chupchaap kisi aur font me nikal jaata hai — jo ek video me
   * sabse gandi galti lagti hai. Asli brand fonts Phase 17 me asset ke roop me
   * upload honge, tab ye fallback hi rahenge.
   */
  "brand.font.display": "Georgia, 'Times New Roman', 'Noto Serif', serif",
  "brand.font.body":
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', Arial, sans-serif",
  "brand.font.mono": "'Cascadia Mono', Consolas, 'Courier New', monospace",
};

/** `"brand.primary"` jaisa token hai? */
export function isBrandToken(value: string): boolean {
  return value.startsWith("brand.");
}

/**
 * Token ho to resolve karo, warna value waisi ki waisi lauta do.
 *
 * Anjaan token par `fallback` milta hai aur `onMissing` bulaya jaata hai —
 * chupchaap khaali string dena sabse bura hota, kyunki tab video ban to jaati
 * hai par usme text gayab hota hai aur koi error kahin nahi dikhta.
 */
export function resolveToken(
  value: string,
  tokens: BrandTokens = DEFAULT_BRAND_TOKENS,
  options: { fallback?: string; onMissing?: (token: string) => void } = {},
): string {
  if (!isBrandToken(value)) return value;
  const resolved = tokens[value];
  if (resolved !== undefined) return resolved;
  options.onMissing?.(value);
  return options.fallback ?? DEFAULT_BRAND_TOKENS["brand.text"] ?? "#FFFFFF";
}

/** Doc ke brand preset (Phase 17) ko default ke upar chadha do. */
export function mergeBrandTokens(overrides: BrandTokens | null | undefined): BrandTokens {
  return overrides ? { ...DEFAULT_BRAND_TOKENS, ...overrides } : DEFAULT_BRAND_TOKENS;
}

/* ------------------------------------------------------- presets (17.9) */

export interface BrandPreset {
  id: string;
  name: string;
  tokens: BrandTokens;
}

/**
 * Built-in brand presets.
 *
 * ⚠️ Ye **seed** hain, poori list nahi. Asli presets `reel_brand_presets` table
 * me rehte hain aur user apne bana sakta hai. Yahan wale isliye zaroori hain ki
 * ek naya project bina DB ke bhi theek dikhna chahiye — aur "Apka Saathi" wala
 * preset wahi hai jo web ki `globals.css` me hai, taaki reels aur website ek hi
 * parivaar ke lagein.
 */
export const BUILTIN_BRAND_PRESETS: readonly BrandPreset[] = [
  {
    id: "apka-saathi",
    name: "Apka Saathi",
    tokens: DEFAULT_BRAND_TOKENS,
  },
  {
    id: "mono-dark",
    name: "Mono (dark)",
    tokens: {
      ...DEFAULT_BRAND_TOKENS,
      "brand.primary": "#E8E4DD",
      "brand.primaryDark": "#BFB9AF",
      "brand.accent": "#8C8C8C",
      "brand.sage": "#6E6E6E",
      "brand.text": "#F5F3F0",
      "brand.textMuted": "#B8B4AE",
      "brand.textOnAccent": "#141414",
      "brand.background": "#111111",
      "brand.surface": "#1E1E1E",
      "brand.line": "#3A3A3A",
    },
  },
  {
    id: "sunrise",
    name: "Sunrise",
    tokens: {
      ...DEFAULT_BRAND_TOKENS,
      "brand.primary": "#E8573F",
      "brand.primaryDark": "#C4402C",
      "brand.accent": "#F7C548",
      "brand.sage": "#5E8C7F",
      "brand.text": "#FFF7EC",
      "brand.textMuted": "#E3D2BC",
      "brand.textOnAccent": "#2B1A10",
      "brand.background": "#241410",
      "brand.surface": "#3A211A",
      "brand.line": "#F2E2CC",
    },
  },
];

export function findBrandPreset(id: string | null): BrandPreset | undefined {
  if (!id) return undefined;
  return BUILTIN_BRAND_PRESETS.find((preset) => preset.id === id);
}

/**
 * Project ke liye poore tokens: default -> preset -> project ke apne (17.10).
 *
 * Teen parat isliye hain: default hamesha kaam karta hai (koi token khaali nahi
 * rehta), preset look badalta hai, aur project ke apne token ek hi reel ke liye
 * chhota sa farak dete hain bina naya preset banaye.
 */
export function brandTokensFor(brand: {
  presetId: string | null;
  tokens?: BrandTokens;
}): BrandTokens {
  const preset = findBrandPreset(brand.presetId);
  return {
    ...DEFAULT_BRAND_TOKENS,
    ...(preset?.tokens ?? {}),
    ...(brand.tokens ?? {}),
  };
}
