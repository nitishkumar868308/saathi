/**
 * Effect presets — sirf **data** (14.6).
 *
 * Ek preset param sets ki list hai, aur bas. Koi naya code, koi naya effect
 * nahi. Isi wajah se naya preset add karna sirf yahan ek entry hai, aur wo bhi
 * kisi ke liye khatra nahi: agar preset me koi anjaan effect ho to
 * `applyEffects` use chup-chaap chhod deta hai.
 */

export interface EffectPreset {
  id: string;
  label: string;
  hint: string;
  /** Stack usi kram me lagta hai jis kram me yahan likha hai (kram maayne rakhta hai). */
  effects: readonly Record<string, unknown>[];
}

export const EFFECT_PRESETS: readonly EffectPreset[] = [
  {
    id: "soft-glow",
    label: "Soft glow",
    hint: "Halki chamak — chehre aur product dono par narm lagta hai",
    effects: [
      { type: "brightness", enabled: true, amount: 1.06 },
      { type: "saturation", enabled: true, amount: 1.12 },
      { type: "vignette", enabled: true, amount: 0.22, spread: 0.7, color: "#000000" },
    ],
  },
  {
    id: "cinematic-contrast",
    label: "Cinematic contrast",
    hint: "Gehra contrast, thoda kam rang — filmy dikhta hai",
    effects: [
      { type: "contrast", enabled: true, amount: 1.22 },
      { type: "saturation", enabled: true, amount: 0.88 },
      { type: "vignette", enabled: true, amount: 0.4, spread: 0.55, color: "#000000" },
    ],
  },
  {
    id: "bw",
    label: "B & W",
    hint: "Safed-kaala, thode uthe hue kinare",
    effects: [
      { type: "grayscale", enabled: true, amount: 1 },
      { type: "contrast", enabled: true, amount: 1.15 },
    ],
  },
  {
    id: "vintage",
    label: "Vintage",
    hint: "Purani tasveer — bhoora rang aur dabey hue kinare",
    effects: [
      { type: "sepia", enabled: true, amount: 0.45 },
      { type: "saturation", enabled: true, amount: 0.75 },
      { type: "contrast", enabled: true, amount: 0.92 },
      { type: "vignette", enabled: true, amount: 0.5, spread: 0.5, color: "#2b1a0e" },
    ],
  },
  {
    id: "warm-film",
    label: "Warm film",
    hint: "Halka garam rang — chehre par sabse achha lagta hai",
    effects: [
      { type: "brightness", enabled: true, amount: 1.04 },
      { type: "sepia", enabled: true, amount: 0.14 },
      { type: "saturation", enabled: true, amount: 1.08 },
      { type: "vignette", enabled: true, amount: 0.26, spread: 0.66, color: "#000000" },
    ],
  },
  {
    id: "cool-clean",
    label: "Cool clean",
    hint: "Saaf aur thanda — app, product ya screen recording par",
    effects: [
      { type: "brightness", enabled: true, amount: 1.03 },
      { type: "contrast", enabled: true, amount: 1.1 },
      { type: "saturation", enabled: true, amount: 1.04 },
      { type: "sharpen", enabled: true, amount: 0.35 },
    ],
  },
  {
    id: "pop-colour",
    label: "Rang chamka do",
    hint: "Tez rang — khaana, kapda, koi bhi cheez bechni ho",
    effects: [
      { type: "saturation", enabled: true, amount: 1.34 },
      { type: "contrast", enabled: true, amount: 1.12 },
      { type: "sharpen", enabled: true, amount: 0.4 },
    ],
  },
  {
    id: "dreamy",
    label: "Dhundhla sapna",
    hint: "Narm aur halka — yaad, kahani ya shuruaat wale scene par",
    effects: [
      { type: "brightness", enabled: true, amount: 1.08 },
      { type: "saturation", enabled: true, amount: 0.94 },
      { type: "blur", enabled: true, radius: 1 },
      { type: "vignette", enabled: true, amount: 0.3, spread: 0.75, color: "#000000" },
    ],
  },
];

export function findEffectPreset(id: string): EffectPreset | undefined {
  return EFFECT_PRESETS.find((preset) => preset.id === id);
}
