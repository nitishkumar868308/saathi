/**
 * AI ka kharcha (21.11).
 *
 * ⚠️ **Yahan koi rate likhi hui nahi hai, aur ye is file ka poora point hai.**
 *
 * Ek default rate rakh dena sabse aasan hota — aur roz ka "₹12.40" chhap dena.
 * Par wo number kisi naap se nahi aata: rate provider tay karta hai, wo model ke
 * saath badalti hai, aur samay ke saath bhi. User usi number ke bharose plan
 * banata hai; jis din asli bill uska teen guna aata hai, us din wo number sirf
 * galat nahi hota — wo dhokha nikalta hai.
 *
 * Isliye rate **bahar se** aati hai (env / settings), aur na ho to jawab `null`
 * hota hai. UI `null` par "kharcha pata nahi" likhti hai, `₹0` nahi.
 *
 * Jo cheez hum sach me naap sakte hain — **tokens** — wo hamesha DB me jaati hai.
 * Rate baad me pata chale to purana kharcha bhi ginn liya ja sakta hai.
 */

export interface AiRate {
  /** Ek million input token ka daam (jis bhi currency me user ne likha ho). */
  inputPerMillion: number;
  outputPerMillion: number;
}

/** model id → rate. Khaali object bilkul theek hai — matlab "abhi pata nahi". */
export type AiRates = Record<string, AiRate>;

export interface AiTokenCount {
  inputTokens: number | null;
  outputTokens: number | null;
}

/**
 * Tokens + rate → kharcha. Pata na ho to `null`.
 *
 * Do alag "kuch nahi" hain aur unhe milaana nahi chahiye:
 *  - **`null`** = naap hi nahi hai (rate nahi mili, ya provider ne token count
 *    bheja hi nahi). Ye "pata nahi" hai.
 *  - **`0`** = naap hai aur wo sifar hai (0 token wali call).
 * Dono ko 0 dikhana "is call ka kharcha kuch nahi hua" likhne jaisa hai, jo
 * pehli halat me jhooth hota hai.
 */
export function estimateAiCost(
  tokens: AiTokenCount,
  rates: AiRates,
  modelId?: string,
): number | null {
  const rate = modelId ? rates[modelId] : undefined;
  if (!rate) return null;
  if (tokens.inputTokens === null || tokens.outputTokens === null) return null;

  return (
    (tokens.inputTokens / 1_000_000) * rate.inputPerMillion +
    (tokens.outputTokens / 1_000_000) * rate.outputPerMillion
  );
}

/**
 * Env se rates padho — `REEL_AI_RATES` me JSON.
 *
 * Shape: `{"gemini-2.5-flash": {"inputPerMillion": 0.3, "outputPerMillion": 2.5}}`
 *
 * ⚠️ Galat JSON par **chup-chaap khaali** lauta dete hain, throw nahi karte. Rate
 * ek marzi ki cheez hai; uski typo se poora editor rukna bahut mehnga jawab hai.
 * Nateeja bas itna hota hai ki kharcha "pata nahi" dikhta hai — jo waise bhi
 * default haalat hai.
 */
export function parseAiRates(raw: string | undefined | null): AiRates {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: AiRates = {};
    for (const [model, value] of Object.entries(parsed as Record<string, unknown>)) {
      const rate = value as Partial<AiRate>;
      if (typeof rate?.inputPerMillion === "number" && typeof rate?.outputPerMillion === "number") {
        out[model] = {
          inputPerMillion: rate.inputPerMillion,
          outputPerMillion: rate.outputPerMillion,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}
