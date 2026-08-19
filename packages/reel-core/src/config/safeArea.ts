/**
 * Safe-area guides — **data**, code me nahi (Phase 6.10).
 *
 * Reel me sabse aam galti ye hai: text bilkul theek dikhta hai, aur Instagram
 * par post karte hi uske upar caption, profile ka naam aur "Follow" ka button
 * aa jaata hai. Wo jagah app ki hai, humari nahi — isliye preview me uski
 * lakeer dikhni chahiye.
 *
 * ⚠️ **Ye naap andaaze hain, aur jaan-boojhkar aise likhe gaye hain.** Instagram
 * apna UI badalta rehta hai; koi "official safe area" number publish nahi hota.
 * Isliye inhe hadd ki tarah nahi, chetavni ki tarah lena chahiye — aur isi wajah
 * se ye fraction me hain (0-1), pixel me nahi: 1080x1920 aur 720x1280 dono par
 * ek hi guide sahi baithti hai, aur Section 3B ka "koi magic number nahi" wala
 * rule bhi bacha rehta hai.
 *
 * Phase 20 ka validator bhi yahi list padhega ("ye text safe area ke bahar hai"),
 * isliye ye `@reel/core` me hai, studio me nahi.
 */

export type GuideOrientation = "portrait" | "landscape" | "any";

export interface Insets {
  /** Frame ki oonchai ka hissa (0-1). */
  top: number;
  /** Frame ki chaudai ka hissa (0-1). */
  right: number;
  bottom: number;
  left: number;
}

export interface SafeAreaGuideDef {
  id: string;
  label: string;
  hint: string;
  insets: Insets;
  /** Jis shakl ke frame par ye matlab rakhti hai. */
  orientation: GuideOrientation;
}

export const SAFE_AREA_GUIDES: readonly SafeAreaGuideDef[] = [
  {
    id: "reels",
    label: "Instagram Reels",
    hint: "Neeche caption + profile, daayein like/share ke buttons",
    // Daayein ka hissa sabse bada hai — action buttons ka poora column wahan hai.
    insets: { top: 0.055, right: 0.17, bottom: 0.2, left: 0.045 },
    orientation: "portrait",
  },
  {
    id: "shorts",
    label: "YouTube Shorts",
    hint: "Neeche title + channel, daayein action buttons",
    insets: { top: 0.05, right: 0.16, bottom: 0.17, left: 0.04 },
    orientation: "portrait",
  },
  {
    id: "action-safe",
    label: "Action safe (5%)",
    hint: "Purana broadcast niyam — kinare kat sakte hain",
    insets: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
    orientation: "any",
  },
  {
    id: "title-safe",
    label: "Title safe (10%)",
    hint: "Text isse andar rakho to kahin bhi kata nahi dikhega",
    insets: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
    orientation: "any",
  },
];

export const DEFAULT_SAFE_AREA_GUIDE_ID = "reels";

/** Grid overlay kitne hisson me baante (rule of thirds). */
export const GRID_DIVISIONS = 3;

export function getSafeAreaGuide(id: string): SafeAreaGuideDef | undefined {
  return SAFE_AREA_GUIDES.find((guide) => guide.id === id);
}

export function requireSafeAreaGuide(id: string): SafeAreaGuideDef {
  const guide = getSafeAreaGuide(id);
  if (!guide) {
    throw new Error(
      `Unknown safe-area guide "${id}". Available: ${SAFE_AREA_GUIDES.map((g) => g.id).join(", ")}`,
    );
  }
  return guide;
}

/**
 * Is naap ke frame par kaunsi guides matlab rakhti hain.
 *
 * Landscape project me "Instagram Reels" dikhana sirf gadbad hai — wahan wo UI
 * hota hi nahi. Square (width === height) ko portrait ki tarah gina gaya hai,
 * kyunki wo feed post hai aur uspar bhi app ka UI aata hai.
 */
export function guidesForSize(width: number, height: number): readonly SafeAreaGuideDef[] {
  const orientation: GuideOrientation = width > height ? "landscape" : "portrait";
  return SAFE_AREA_GUIDES.filter(
    (guide) => guide.orientation === "any" || guide.orientation === orientation,
  );
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Guide ka asli rectangle — pixels me, is frame ke liye. */
export function safeAreaRect(guide: SafeAreaGuideDef, width: number, height: number): Rect {
  const x = width * guide.insets.left;
  const y = height * guide.insets.top;
  return {
    x,
    y,
    width: Math.max(0, width - x - width * guide.insets.right),
    height: Math.max(0, height - y - height * guide.insets.bottom),
  };
}

/**
 * Ye rectangle safe area ke andar hai ya nahi.
 *
 * Phase 20 ka validator isi ko bulaayega ("Title text Reels ke UI ke neeche
 * chala jaayega"), isliye ye yahan hai aur overlay se alag hai — dikhana aur
 * jaanchna do alag kaam hain par naap ek hi hona chahiye.
 */
export function isInsideSafeArea(
  rect: Rect,
  guide: SafeAreaGuideDef,
  width: number,
  height: number,
): boolean {
  const safe = safeAreaRect(guide, width, height);
  return (
    rect.x >= safe.x &&
    rect.y >= safe.y &&
    rect.x + rect.width <= safe.x + safe.width &&
    rect.y + rect.height <= safe.y + safe.height
  );
}
