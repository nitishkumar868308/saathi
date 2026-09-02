/**
 * Emotion — bhaunh, aankh, aur sir ka jhukav (bolti tasveer).
 *
 * ⚠️ Ye ek **registry** hai, `switch` nahi — nayi emotion jodna ek entry ka kaam
 * rahe, code ka nahi. Wahi wajah jo `ANIMATION_PRESETS` ki hai, aur wahi nateeja:
 * UI is list par `map` karti hai, isliye nayi entry apne aap wahan dikhne lagti
 * hai.
 *
 * ⚠️ Yahan **muh ka koi chunav nahi hai**, aur wo jaan-boojhkar hai. Muh us se
 * chalta hai jo bola ja raha hai; use emotion se badalna matlab lip sync tod
 * dena — "khush" par har shabd chaura ho jaata aur `ऊ` bhi `ई` jaisa dikhta.
 * Emotion chehre ke BAAKI hisse se aata hai, aur asal me wahin se aata bhi hai.
 *
 * ⚠️ Sirf `mouthCorner` ek apwaad hai, aur wo muh **kholta** nahi — sirf uske
 * kinare upar ya neeche karta hai. Muskaan aur udaasi ka poora farak wahi ek
 * cheez hai, aur uske bina "khush" aur "dukhi" bilkul ek jaise dikhte hain.
 */

export interface EmotionDef {
  id: string;
  label: string;
  /**
   * Bhaunh kitni upar (+) ya neeche (-) — muh ki chaudai ke anupaat me.
   *
   * ⚠️ Anupaat me, pixel me nahi — wahi wajah jo viseme ke shapes ki hai: har
   * chehra alag naap ka hota hai, aur pixel likh dene par ek par theek baithta
   * aur doosre par bhaunh maathe se bahar chali jaati hai.
   */
  brow: number;
  /** Aankh kitni khuli — 1 = normal, <1 = simti, >1 = phati hui. */
  eye: number;
  /**
   * Sir ke sway ki raftaar ka guna — 1 = normal.
   *
   * ⚠️ Ye 0 kabhi nahi hota. Bilkul sthir sir ek tasveer jaisa lagta hai, bolta
   * hua insaan nahi — chahe muh kitna bhi theek chale. "Dukhi" par bhi wo sirf
   * dheema hota hai, rukta nahi.
   */
  swaySpeed: number;
  /** Honth ke kinare upar (+) ya neeche (-) — halki muskaan ya udaasi. */
  mouthCorner: number;
}

export const EMOTIONS: readonly EmotionDef[] = [
  { id: "neutral", label: "Saada", brow: 0, eye: 1, swaySpeed: 1, mouthCorner: 0 },
  { id: "happy", label: "Khush", brow: 0.06, eye: 0.92, swaySpeed: 1.25, mouthCorner: 0.18 },
  { id: "serious", label: "Gambhir", brow: -0.05, eye: 0.96, swaySpeed: 0.75, mouthCorner: -0.04 },
  { id: "surprised", label: "Hairaan", brow: 0.16, eye: 1.18, swaySpeed: 1.1, mouthCorner: 0.04 },
  { id: "sad", label: "Dukhi", brow: -0.03, eye: 0.88, swaySpeed: 0.6, mouthCorner: -0.16 },
  { id: "excited", label: "Josh", brow: 0.1, eye: 1.06, swaySpeed: 1.5, mouthCorner: 0.14 },
] as const;

export const DEFAULT_EMOTION = "neutral";

export function getEmotion(id: string): EmotionDef | undefined {
  return EMOTIONS.find((emotion) => emotion.id === id);
}

/**
 * Emotion ya default — render ke liye.
 *
 * ⚠️ Render kabhi `undefined` nahi jhel sakta. Purana doc (jisme koi hataayi hui
 * emotion likhi ho) us jagah poora chehra sthir kar deta — bina kisi error ke,
 * aur wo sirf bani hui reel dekh kar pakda jaata.
 */
export function emotionOrDefault(id: string | null | undefined): EmotionDef {
  return getEmotion(id ?? DEFAULT_EMOTION) ?? (getEmotion(DEFAULT_EMOTION) as EmotionDef);
}
