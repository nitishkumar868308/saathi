/**
 * Animation presets — **sirf param sets, code nahi** (10.10).
 *
 * "Ken Burns slow" koi naya feature nahi hai; wo `kenburns` hi hai jiske do
 * number alag hain. Isliye ye ek data list hai. Naya preset banana yahan ek
 * entry hai — na koi component, na koi switch, na panel me kuch.
 *
 * ⚠️ Preset ke andar `type` bhi hai, isliye ek preset **kai animations** ka
 * stack bhi ho sakta hai ("Cinematic drift" me pan + fade dono hain). Iske bina
 * har preset ek hi animation tak simat jaata, aur asli reel me aksar do-teen
 * cheezein saath chalti hain.
 */

export interface AnimationPreset {
  id: string;
  label: string;
  hint: string;
  /** Ek ya zyada animations — jaise ke waise item par lag jaate hain. */
  animations: readonly Record<string, unknown>[];
}

export const ANIMATION_PRESETS: readonly AnimationPreset[] = [
  {
    id: "kenburns-slow",
    label: "Ken Burns slow",
    hint: "Bahut dheema zoom — documentary jaisa",
    animations: [
      { type: "kenburns", enabled: true, from: 1, to: 1.12, focalX: 0.5, focalY: 0.5, easing: "linear" },
    ],
  },
  {
    id: "kenburns-punch",
    label: "Ken Burns punch",
    hint: "Tez zoom — hook ke liye",
    animations: [
      { type: "kenburns", enabled: true, from: 1, to: 1.35, focalX: 0.5, focalY: 0.42, easing: "ease-out" },
    ],
  },
  {
    id: "pop-in",
    label: "Pop in",
    hint: "Uchhal kar aana + fade — text aur sticker ke liye",
    animations: [
      { type: "scalePop", enabled: true, from: 0.7, durationInFrames: 12, easing: "spring" },
      { type: "fade", enabled: true, mode: "in", durationInFrames: 8, easing: "ease-out" },
    ],
  },
  {
    id: "cinematic-drift",
    label: "Cinematic drift",
    hint: "Halka pan + dono taraf fade — background footage ke liye",
    animations: [
      { type: "pan", enabled: true, direction: "left", amountPercent: 6, easing: "linear" },
      { type: "kenburns", enabled: true, from: 1.08, to: 1.15, focalX: 0.5, focalY: 0.5, easing: "linear" },
      { type: "fade", enabled: true, mode: "both", durationInFrames: 12, easing: "ease-in-out" },
    ],
  },
  {
    id: "slide-up-soft",
    label: "Slide up (soft)",
    hint: "Neeche se aana — caption/lower-third ke liye",
    animations: [
      { type: "slide", enabled: true, direction: "down", distancePercent: 8, durationInFrames: 14, easing: "ease-out" },
      { type: "fade", enabled: true, mode: "in", durationInFrames: 10, easing: "ease-out" },
    ],
  },
  {
    id: "focus-pull",
    label: "Focus pull",
    hint: "Dhundhle se saaf + halka zoom — reveal ke liye",
    animations: [
      { type: "blurIn", enabled: true, blurPx: 26, durationInFrames: 16, easing: "ease-out" },
      { type: "kenburns", enabled: true, from: 1.12, to: 1, focalX: 0.5, focalY: 0.5, easing: "ease-out" },
    ],
  },

  /*
   * ⚠️ Neeche ke preset baad me jode gaye, aur unme se **kisi ka zoom 1.35 se
   * upar nahi** hai. Wo hadd `kenburns-punch` ki hai, aur `MAX_ANIMATION_ZOOM`
   * usi se banta hai — jispar fit ka poora target tika hua hai. Usse upar jaane
   * wala ek bhi preset har purani fit copy ko bekaar kar deta (naya target =
   * nayi cache key = nayi file), aur wo kharcha ek animation ke laayak nahi hai.
   */
  {
    id: "push-in",
    label: "Push in",
    hint: "Zoom jo aakhir me thehar jaata hai — kisi baat par zor dene ke liye",
    animations: [
      { type: "kenburns", enabled: true, from: 1, to: 1.18, focalX: 0.5, focalY: 0.45, easing: "ease-out" },
    ],
  },
  {
    id: "pull-back",
    label: "Pull back",
    hint: "Paas se door — pehle ek hissa, phir poori tasveer",
    animations: [
      { type: "kenburns", enabled: true, from: 1.28, to: 1, focalX: 0.5, focalY: 0.5, easing: "ease-out" },
      { type: "fade", enabled: true, mode: "in", durationInFrames: 10, easing: "ease-out" },
    ],
  },
  {
    id: "pan-across",
    label: "Aar-paar",
    hint: "Chaudi tasveer par baayen se daayen — landscape photo khadi reel me",
    animations: [
      { type: "pan", enabled: true, direction: "left", amountPercent: 14, easing: "linear" },
      { type: "kenburns", enabled: true, from: 1.12, to: 1.12, focalX: 0.5, focalY: 0.5, easing: "linear" },
    ],
  },
  {
    id: "tilt-in",
    label: "Tirchha aana",
    hint: "Halka ghoom kar aana — sticker, logo ya chhote card par",
    animations: [
      { type: "rotateIn", enabled: true, degrees: -7, durationInFrames: 14, easing: "spring" },
      { type: "scalePop", enabled: true, from: 0.86, durationInFrames: 14, easing: "spring" },
      { type: "fade", enabled: true, mode: "in", durationInFrames: 8, easing: "ease-out" },
    ],
  },
  {
    id: "slide-in-side",
    label: "Bagal se aana",
    hint: "Daayin taraf se sarak kar — do cheezein baari-baari dikhani ho",
    animations: [
      { type: "slide", enabled: true, direction: "right", distancePercent: 12, durationInFrames: 16, easing: "ease-out" },
      { type: "fade", enabled: true, mode: "in", durationInFrames: 10, easing: "ease-out" },
    ],
  },
];

export function getAnimationPreset(id: string): AnimationPreset | undefined {
  return ANIMATION_PRESETS.find((preset) => preset.id === id);
}
