/**
 * Gemini ke jawab me se token ki ginti nikalna (21.11).
 *
 * ⚠️ **`thoughtsTokenCount` bhi output hi hai** — aur yahi wo cheez hai jiske
 * liye ye file alag banayi gayi. Naya model jawab dene se pehle "sochta" hai,
 * aur wo soch `candidatesTokenCount` me **nahi** aati; wo alag se ginn kar aati
 * hai — par bill me output ke bhaav se hi lagti hai.
 *
 * Ek asli naap, isi repo se:
 *
 *     promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 105
 *     totalTokenCount: 122
 *
 * Sirf `candidates` ginne par jawab **17** aata — jabki sach **122** hai. Yaani
 * saat guna kam. Aur ye galti sabse buri kism ki hai: wo dikhti nahi, kyunki
 * screen par number aa hi raha hota hai. Admin mahino tak "kharcha kuch khaas
 * nahi" padhta rehta, aur asli bill uska kayi guna aata rehta.
 *
 * Isliye ginti yahan hoti hai, route ke andar nahi — taaki uspar test likha ja
 * sake (`scripts/check-ai.ts`).
 */

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  /** Model ne "sochne" me kitne token liye. Bill me output ke saath jaata hai. */
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface TokenUsage {
  /** `null` = provider ne bataya hi nahi. `0` se alag cheez hai. */
  inputTokens: number | null;
  outputTokens: number | null;
  /** Jo DB me `units` banta hai — input + output. */
  totalTokens: number;
}

export function readTokenUsage(meta: GeminiUsageMetadata | undefined | null): TokenUsage {
  const inputTokens = typeof meta?.promptTokenCount === "number" ? meta.promptTokenCount : null;

  const candidates = typeof meta?.candidatesTokenCount === "number" ? meta.candidatesTokenCount : null;
  const thoughts = typeof meta?.thoughtsTokenCount === "number" ? meta.thoughtsTokenCount : 0;

  // ⚠️ `candidates` na aaye to jawab `null` hai — 0 nahi. Sirf soch ke token
  // hone par bhi "output pata nahi" hi sach hai; unhe akela output maan lena
  // ek aisa number gadhna hoga jo provider ne diya hi nahi.
  const outputTokens = candidates === null ? null : candidates + thoughts;

  return {
    inputTokens,
    outputTokens,
    totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
  };
}
