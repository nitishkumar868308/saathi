import { ANIMATION_PRESETS } from "../config/animationPresets";

/**
 * Wizard ki sifaarish — **ek likha hua niyam, AI ka andaaza nahi** (26.2 / 26.3).
 *
 * ⚠️ Ye AI se poochha ja sakta tha, aur jaan-boojhkar nahi poochha ja raha. Teen
 * kharche hain aur teeno asli hain:
 *
 *   1. Har scene par token — aur ye har reel me lagta hai, har baar.
 *   2. Intezaar. Wizard ka poora maqsad hai ki aadmi ruke nahi; do second ka
 *      chakkar har step par lagana usi ke khilaaf jaata hai.
 *   3. Aur sabse bura: AI kabhi-kabhi aisa naam de deta hai jo registry me hai
 *      hi nahi. Uske baad chup-chaap default lag jaata hai, aur screen par likha
 *      "AI ne chuna" ek jhooth ban jaata hai jise kabhi koi pakadta nahi.
 *
 * Isliye niyam yahan hai — muft, turant, aur jaancha hua. Screen par bhi wahi
 * likha jaata hai jo sach hai: **"apne aap chuna"**, "AI ne chuna" nahi.
 *
 * ⚠️ Ye dono function **pure** hain: koi doc nahi chhoote, koi call nahi karte.
 * Isi wajah se inhe ek script se poora chala kar dekha ja sakta hai
 * (`scripts/check-wizard.ts`), aur isi wajah se inhe badalna surakshit hai.
 */

/** Sifaarish ke liye scene ka utna hi hissa jitna sach me chahiye. */
export interface WizardSceneLike {
  /** `SCENE_TYPES` ka id — `cta`, `image_audio`, `text`… */
  type: string;
  /** Us scene par jo bola/likha jaayega. */
  text: string;
  /** Aadmi ne is scene me tasveer di ya nahi. */
  hasImage: boolean;
}

/** Isse chhoti line "chhoti" maani jaati hai. */
const SHORT_TEXT_CHARS = 30;

/**
 * Is scene par kaunsi animation — `null` matlab koi nahi.
 *
 * ⚠️ **Bina tasveer wale scene par bhi harkat hoti hai, aur ye baat badli hui
 * hai.** Pehle yahan `null` lautta tha, is dalil par ki preset text par lag
 * jaayega aur "Dheema zoom" wala hilta hua text ajeeb lagta hai. Wo dalil ek
 * preset ke liye sach thi aur usse poori shreni band kar di gayi — nateeja ye
 * hua ki jis reel me tasveerein nahi thi (yaani pehli har reel), wo 30 second
 * tak **bilkul sthir** rahi. Har line achanak aati thi aur achanak chali jaati
 * thi. Us reel me kami "animation kam thi" nahi thi; usme harkat thi hi nahi.
 *
 * Sahi jawab ye tha ki text ke liye text wala preset chuna jaaye: `slide-up-soft`
 * (neeche se aana + fade) — wahi jo caption ke liye bana hai. Zoom wale preset
 * ab bhi sifaarish me nahi aate; par aadmi chahe to chun sakta hai, aur wo uska
 * haq hai.
 *
 * ⚠️ Sam/visham wala niyam neeche jaan-boojhkar hai. Ek hi preset har scene par
 * lagta rahe to har scene alag se theek dikhta hai, par poori reel sust lagti
 * hai — aur uski wajah dekhne wale ko kabhi samajh nahi aati ("pata nahi, boring
 * lagi"). Do preset baari-baari se wo ek-jaisapan toot jaata hai.
 */
export function suggestAnimation(scene: WizardSceneLike, index: number): string | null {
  if (scene.type === "cta") return "pop-in";

  if (!scene.hasImage) {
    /*
     * Text par sirf do hi preset theek baithte hain: chhoti line uchhal kar aaye,
     * lambi line neeche se sarak kar. Baaki sab zoom hain, aur zoom ka matlab
     * tasveer hoti hai — text par wo bas hilta hua dikhta hai.
     */
    return scene.text.trim().length <= SHORT_TEXT_CHARS ? "pop-in" : "slide-up-soft";
  }

  if (scene.text.trim().length <= SHORT_TEXT_CHARS) return "pop-in";
  return index % 2 === 0 ? "kenburns-slow" : "cinematic-drift";
}

/**
 * Is scene me **aane** ka tarika — pichhle scene se.
 *
 * `index` us scene ka apna number hai (0 se), `hasImage`/`previousHasImage` dono
 * taraf ki haalat.
 *
 * ⚠️ Pehle scene par hamesha `none`, aur ye ek chhoti si baat hai jo aksar chhoot
 * jaati hai: pehla scene kahin **se** aa hi nahi raha. Wahan fade lagane par reel
 * kaali screen se shuru hoti hai, aur pehle aadhe second me hi dekhne wala samajh
 * leta hai ki kuch dheela hai. Reel ke pehle 3 second sabse mehnge hote hain.
 *
 * ⚠️ Dono taraf tasveer ho to `crossfade` — do tasveerein `fade` se jodne par
 * beech me ek lamha khaali (kaala) aa jaata hai. Ek taraf text ho to `fade` hi
 * theek hai; wahan crossfade se do cheezein ek doosre par chadhi hui dikhti hain
 * aur padhi nahi jaati.
 */
export function suggestTransition(
  index: number,
  hasImage: boolean,
  previousHasImage: boolean,
): string {
  if (index === 0) return "none";
  if (hasImage && previousHasImage) return "crossfade";
  return "fade";
}

/** Ek scene ki poori sifaarish — UI ko dono ek saath chahiye hote hain. */
export interface WizardSuggestion {
  animation: string | null;
  transition: string;
}

/**
 * Poori list ki sifaarish, ek baar me.
 *
 * ⚠️ Ye alag function isliye hai ki `suggestTransition` ko **pichhle** scene ka
 * pata chahiye. Har call site par wo hisaab dobara likhne par ek jagah `index-1`
 * ka off-by-one aa jaata hai, aur wo galti dikhti nahi — bas ek transition thoda
 * alag lag jaata hai.
 */
export function suggestAll(scenes: readonly WizardSceneLike[]): WizardSuggestion[] {
  return scenes.map((scene, index) => ({
    animation: suggestAnimation(scene, index),
    transition: suggestTransition(index, scene.hasImage, scenes[index - 1]?.hasImage ?? false),
  }));
}

/* ------------------------------------------------- kitni badi tasveer chahiye */

/**
 * Is animation ke saath tasveer kam se kam kitni badi honi chahiye (26.16).
 *
 * WARNING: Ye sawaal aadmi ke liye sabse chhupa hua hai. Reel 1080x1920 ki hai,
 * to lagta hai 1080x1920 ki tasveer kaafi hai. Par zoom wali animation use
 * 1.12x se 1.35x tak bada karti hai - aur us waqt wo phail kar dhundhli ho
 * jaati hai. Validator ye pakadta hai, par **render ke baad**; tab tak aadmi
 * saari tasveerein daal chuka hota hai.
 *
 * Isliye ye hisaab wizard me hi dikh jaata hai, tasveer chunte hi.
 */
export function requiredVisualSize(
  presetId: string | null,
  projectWidth: number,
  projectHeight: number,
  /**
   * Tasveer ka apna naap — na do to sirf zoom ka hisaab lagta hai.
   *
   * WARNING: Ye chala kar dekhne par joda gaya, aur ye sabse bada hissa nikla.
   * Ek 1920x1080 (landscape) tasveer 1080x1920 (portrait) frame me bharne ke liye
   * hi **1.78x** ho jaati hai - zoom shuru hone se pehle. Bina is hisaab ke wizard
   * "chahiye 1458x2592" bolta aur export ke waqt validator "chahiye 3414x1920"
   * bolta. Do alag number, dono sach ke tukde - aur aadmi dono par bharosa kho
   * deta hai.
   */
  source?: { width: number; height: number } | null,
): { width: number; height: number; scale: number } {
  const preset = presetId ? ANIMATION_PRESETS.find((entry) => entry.id === presetId) : null;

  /*
   * Sabse zyada zoom jo is preset me kahin bhi lagta hai. `from` aur `to` dono
   * dekhe jaate hain - "Bahaav" 1.08 se shuru hokar 1.15 par jaata hai, yaani
   * uska pehla frame bhi pehle se bada hota hai.
   */
  let scale = 1;
  for (const animation of preset?.animations ?? []) {
    for (const key of ["from", "to"] as const) {
      const value = (animation as Record<string, unknown>)[key];
      if (typeof value === "number" && value > scale) scale = value;
    }
  }

  /*
   * Frame bharne wali scale (cover fit) - dono taraf me se jo zyada chahiye.
   * Ye zoom se pehle lagti hai, isliye dono guna hoti hain.
   */
  const fit =
    source && source.width > 0 && source.height > 0
      ? Math.max(projectWidth / source.width, projectHeight / source.height)
      : 1;
  const total = scale * fit;

  return {
    width: Math.ceil((source?.width ?? projectWidth) * total),
    height: Math.ceil((source?.height ?? projectHeight) * total),
    scale: total,
  };
}
