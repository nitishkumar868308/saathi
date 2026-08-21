/**
 * Reel Studio ke tokens → rupya, admin screen ke liye (21.11).
 *
 * ⚠️ **Yahan koi rate likhi hui nahi hai, aur wahi is file ka poora point hai.**
 * Ek default rate rakh dena sabse aasan hota aur roz ka "₹12.40" chhap jaata.
 * Par wo number kisi naap se nahi aata: rate provider tay karta hai, model ke
 * saath badalti hai, samay ke saath bhi. Admin usi number ke bharose plan banata
 * hai; jis din asli bill teen guna aata hai, us din wo number sirf galat nahi
 * hota — dhokha nikalta hai. Isliye rate `REEL_AI_RATES` env se aati hai, aur na
 * ho to jawab `null` hota hai. UI `null` par "rate set nahi" likhti hai, `₹0` nahi.
 *
 * ⚠️ Kharcha **padhte waqt** gina jaata hai, likhte waqt nahi — aur ye jaan-boojh
 * ke hai. DB me sirf tokens jaate hain (jo sach me naape gaye). Rate mahine baad
 * pata chale to purana kharcha bhi apne aap sahi ban jaata hai; agar rupya row me
 * jam gaya hota to purani rows hamesha ke liye galat rehti.
 *
 * ⚠️ Ye file `packages/reel-core/src/ai/cost.ts` ki jodidaar hai — same ganit,
 * jaan-boojh ke do jagah. `web` (saathi-landing) reel wale npm workspace ka hissa
 * hai hi nahi; use `@reel/core` par nirbhar karwane ka matlab hota do alag app ko
 * ek build me baandh dena, sirf 4 line ke gunaa-bhaag ke liye. Sauda ulta hai.
 * Formula badle to dono jagah badalni hogi — isliye woh dono me likha hua hai.
 */

export interface AiRate {
  /** Ek million input token ka daam (jis bhi currency me admin ne likha). */
  inputPerMillion: number;
  outputPerMillion: number;
}

/** model id → rate. Khaali object bilkul theek hai — matlab "abhi pata nahi". */
export type AiRates = Record<string, AiRate>;

export function parseAiRates(raw: string | undefined | null): AiRates {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: AiRates = {};
    for (const [model, value] of Object.entries(parsed as Record<string, unknown>)) {
      const rate = value as Partial<AiRate>;
      if (typeof rate?.inputPerMillion === "number" && typeof rate?.outputPerMillion === "number") {
        out[model] = { inputPerMillion: rate.inputPerMillion, outputPerMillion: rate.outputPerMillion };
      }
    }
    return out;
    // Galat JSON par chup-chaap khaali — throw nahi. Rate marzi ki cheez hai;
    // uski ek typo se poora admin panel 500 de dena bahut mehnga jawab hai.
  } catch {
    return {};
  }
}

/**
 * Tokens + rate → kharcha. Pata na ho to `null`.
 *
 * Do alag "kuch nahi" hain aur unhe milaana nahi chahiye:
 *  - **`null`** = naap hi nahi hai (rate nahi mili, ya provider ne token count
 *    bheja hi nahi). Ye "pata nahi" hai.
 *  - **`0`** = naap hai aur wo sifar hai (cache se aayi call).
 * Dono ko `0` dikhana "is call ka kharcha kuch nahi hua" likhna hai — jo pehli
 * halat me jhooth hai.
 */
export function estimateAiCost(
  tokens: { inputTokens: number | null; outputTokens: number | null },
  rates: AiRates,
  modelId?: string | null,
): number | null {
  const rate = modelId ? rates[modelId] : undefined;
  if (!rate) return null;
  if (tokens.inputTokens === null || tokens.outputTokens === null) return null;

  return (
    (tokens.inputTokens / 1_000_000) * rate.inputPerMillion +
    (tokens.outputTokens / 1_000_000) * rate.outputPerMillion
  );
}
