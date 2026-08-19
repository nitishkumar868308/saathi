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
