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
 * ⚠️ Bina tasveer wale scene par animation ka sawaal hi nahi uthta, aur ye sirf
 * safai nahi hai: us haalat me koi bhi preset lagane par wo **text par** lag
 * jaata, aur "Dheema zoom" wala text hilta hua ajeeb lagta hai. Isliye jawab
 * saaf `null` hai — UI wahan wo chunav dikhati hi nahi.
 *
 * ⚠️ Sam/visham wala niyam neeche jaan-boojhkar hai. Ek hi preset har scene par
 * lagta rahe to har scene alag se theek dikhta hai, par poori reel sust lagti
 * hai — aur uski wajah dekhne wale ko kabhi samajh nahi aati ("pata nahi, boring
 * lagi"). Do preset baari-baari se wo ek-jaisapan toot jaata hai.
 */
export function suggestAnimation(scene: WizardSceneLike, index: number): string | null {
  if (!scene.hasImage) return null;
  if (scene.type === "cta") return "pop-in";
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
