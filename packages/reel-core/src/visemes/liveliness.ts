/**
 * Wo cheezein jo chehre ko **zinda** dikhati hain — muh ke alawa.
 *
 * ⚠️ Ye file is poore feature ki sabse kam samjhi jaane wali baat par khadi hai:
 * **"zinda" dikhna muh se nahi aata.** Ek chehra jiska sirf muh chalta hai, wo
 * bolta hua nahi lagta — wo ek tasveer lagti hai jispar kuch chipka diya gaya ho.
 * Dekhne wala usse turant pakad leta hai, chahe lip sync bilkul theek ho.
 *
 * Teen cheezein wo farak banati hain, aur teenon yahan hain: palak ka jhapakna,
 * bhaunh ka hilna, aur saans jaisa halka jhukav.
 */

/** Do jhapak ke beech kam se kam itna waqt. */
const BLINK_MIN_GAP = 2.4;
/** ...aur zyada se zyada itna. */
const BLINK_MAX_GAP = 6;
/** Ek jhapak itni der ki hoti hai — insaan ki asli palak ~0.1-0.15s leti hai. */
const BLINK_SECONDS = 0.13;

/**
 * Ek seedha, dohraya ja sakne wala "bekayda" number (0-1).
 *
 * ⚠️ `Math.random()` yahan chal hi nahi sakta: har frame apne aap render hota hai
 * (Remotion har frame ka screenshot alag leta hai), isliye random har frame par
 * naya jawab deta aur palak paagalon ki tarah jhapakti. Number **waqt se** banna
 * chahiye, taaki wahi frame hamesha wahi jawab de.
 */
function noise(at: number): number {
  const value = Math.sin(at * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Is lamhe par aankh kitni band hai — 0 = poori khuli, 1 = poori band.
 *
 * ⚠️ Antaraal **bekayda** hai, barabar nahi. Theek har 4 second par jhapakna
 * machine jaisa lagta hai: dekhne wale ko wajah samajh nahi aati, bas chehra
 * "ajeeb" lagta hai. Isliye har jhapak ka apna antaraal hota hai.
 */
export function blinkAt(atSeconds: number): number {
  if (atSeconds < 0) return 0;

  /* Kaunsi jhapak chal rahi hai — shuru se ginte hue. */
  let when = BLINK_MIN_GAP;
  for (let index = 0; index < 200; index += 1) {
    if (when > atSeconds) break;
    const gap = BLINK_MIN_GAP + noise(index) * (BLINK_MAX_GAP - BLINK_MIN_GAP);
    if (atSeconds < when + BLINK_SECONDS) {
      /* Aadhi der band hoti hai, aadhi khulti hai. */
      const t = (atSeconds - when) / BLINK_SECONDS;
      return 1 - Math.abs(t * 2 - 1);
    }
    when += BLINK_SECONDS + gap;
  }
  return 0;
}

/**
 * Bolte waqt bhaunh ka halka uthna — zor ke saath.
 *
 * ⚠️ Ye `intensity` par tika hai, kisi apni ghadi par nahi, aur wahi iska poora
 * matlab hai: asli baat-cheet me bhaunh **zor wale shabdon par** uthti hai. Use
 * apne hisaab se hilane par wo bolne se juda hua nahi lagta — bas ek aur cheez
 * hilti rehti hai, aur chehra bechain dikhne lagta hai.
 */
export function browLiftAt(intensity: number): number {
  const strength = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  /*
   * Sirf zor wale hisse par. Halki awaaz par bhaunh ka uthna wahi bechaini deta
   * hai jisse ye bachna chahta hai.
   */
  return strength < 0.55 ? 0 : (strength - 0.55) / 0.45;
}
