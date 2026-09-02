/**
 * Muh ke aath shape — bolti tasveer ka poora shabdkosh.
 *
 * ⚠️ Aath hi kyun: Rhubarb (is kaam ka sabse jaancha hua tool) bhi aath shapes
 * (A-H) par tika hai. Isse kam rakhne par alag awaazein ek jaisi dikhne lagti
 * hain — "ma" aur "sa" me farak hi nahi bachta. Isse zyada rakhne par do shapes
 * ka farak dekhne wale ko dikhta hi nahi, aur sirf kaam badhta hai.
 *
 * ⚠️ Yahan ke number **naap nahi, anupaat hain**. Asli naap landmarks se aata
 * hai — har chehre ka muh alag naap ka hota hai, aur yahan pixel likh dene par
 * ek chehre par theek baithta aur doosre par muh phat jaata.
 */

export interface VisemeShape {
  id: string;
  label: string;
  /**
   * Muh kitna khulta hai — 0 = poora band, 1 = poora khula.
   *
   * ⚠️ `rest` par ye 0 nahi hai. Aaram ke waqt bhi honth halke se alag rehte
   * hain; bilkul 0 rakhne par chehra "honth dabaye hue" lagta hai, jo tanaav
   * jaisa dikhta hai — aur wo har chup lamhe par dikhta hai.
   */
  open: number;
  /** Kitna chaura — 1 = jaisa hai, <1 = simta hua, >1 = kheencha hua. */
  wide: number;
  /** Honth kitne gol — 0 = normal, 1 = poora gol jaise "ऊ". */
  round: number;
}

export const VISEME_SHAPES: readonly VisemeShape[] = [
  { id: "rest", label: "Aaram", open: 0.04, wide: 1, round: 0 },
  { id: "MBP", label: "म ब प", open: 0, wide: 0.98, round: 0.1 },
  { id: "FV", label: "फ व", open: 0.12, wide: 1.02, round: 0 },
  { id: "AA", label: "आ अ", open: 0.85, wide: 1.05, round: 0 },
  { id: "EE", label: "ई ए", open: 0.32, wide: 1.22, round: 0 },
  { id: "OO", label: "ऊ ओ", open: 0.42, wide: 0.72, round: 0.9 },
  { id: "L", label: "ल त द न", open: 0.36, wide: 1.02, round: 0 },
  { id: "S", label: "स श च ज", open: 0.2, wide: 1.12, round: 0 },
] as const;

/**
 * Chup ka shape.
 *
 * ⚠️ Ye ek alag naam se isliye hai ki iska istemal teen jagah hota hai (track
 * banane me, render me, aur jaanch me), aur teenon jagah `"rest"` likh dena wo
 * halat banata hai jahan ek jagah `"REST"` ya `"idle"` likh diya jaaye aur muh
 * chup-chaap khula reh jaaye — bina kisi error ke.
 */
export const REST_VISEME = "rest";

/** Honth poore band — `म`/`ब`/`प` wala lamha. */
export const CLOSED_VISEME = "MBP";

export function getVisemeShape(id: string): VisemeShape | undefined {
  return VISEME_SHAPES.find((shape) => shape.id === id);
}

/**
 * Ye id registry me hai bhi?
 *
 * Purana track (jisme koi hataya hua shape likha ho) bina jaanche render me
 * jaane par us frame par muh apni pichhli jagah atak jaata hai — koi error
 * nahi, bas ek jamā hua chehra.
 */
export function knownViseme(id: string): boolean {
  return VISEME_SHAPES.some((shape) => shape.id === id);
}
