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
];

export function findEffectPreset(id: string): EffectPreset | undefined {
  return EFFECT_PRESETS.find((preset) => preset.id === id);
}
