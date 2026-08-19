import { z } from "zod";

/**
 * AI ek **optional parat** hai (21.1).
 *
 * ⚠️ Do niyam is poore phase ki neenv hain, aur dono test se jaanche jaate hain:
 *
 *  1. **AI sirf JSON likhta hai.** Wo render nahi karta, doc nahi badalta, aur
 *     koi asset nahi banata. Uska output ek *prastaav* hai jise user dekh kar
 *     maanta hai — aur jab maanta hai tab wo **wahi ops** se lagta hai jo haath
 *     ke button chalate hain.
 *
 *  2. **Editing me AI kabhi nahi bulaya jaata.** Clip khiskana, trim, split,
 *     text badalna, export — inme se kisi me ek bhi call nahi jaati. Iska apna
 *     test hai (21.12) jo provider ko gin kar dekhta hai.
 *
 * Isi wajah se poora editor bina `GEMINI_API_KEY` ke chalta hai. Wo koi
 * "graceful degradation" nahi hai — AI shuru se hi ek alag parat hai.
 */

/* ------------------------------------------------------------- schemas */

export const AI_LANGUAGES = ["hi", "hinglish", "en"] as const;
export type AiLanguage = (typeof AI_LANGUAGES)[number];

export const AI_TONES = ["seedha", "dostana", "gambhir", "mazedaar"] as const;
export type AiTone = (typeof AI_TONES)[number];

/**
 * AI ka scene — **`SCENE_TYPES` registry ke id se**, apne banaye naam se nahi.
 *
 * ⚠️ Registry ki list prompt me **runtime par** bheji jaati hai (21.5). Prompt
 * me list likh dena aasan hai par tab naya scene type jodne par AI ko uska pata
 * hi nahi chalta — aur wo chup-chaap purane types hi use karta rehta hai, jise
 * koi pakadta bhi nahi.
 */
export const AiSceneSchema = z.object({
  type: z.string().min(1),
  name: z.string().default(""),
  durationSeconds: z.number().positive().max(60),
  /**
   * Slot ki values.
   *
   * Asset wale slots me AI **naam/role** likhta hai (`character:rahul`,
   * `screen_recording:reminders`), asset id nahi — wo id jaanta hi nahi, aur
   * jaanne ka daawa karna sabse khatarnaak hota (wo ek aisi id likh deta jo hai
   * hi nahi, aur clip chup-chaap khaali reh jaati).
   */
  slots: z.record(z.string()).default({}),
  /** Kyun ye scene — diff me user ko dikhta hai. */
  reason: z.string().default(""),
});

export const AiScriptSchema = z.object({
  /** Poori kahani ek jagah — user isse padh kar samajhta hai ki AI ne kya socha. */
  summary: z.string().default(""),
  scenes: z.array(AiSceneSchema).min(1).max(20),
});

export type AiScene = z.infer<typeof AiSceneSchema>;
export type AiScript = z.infer<typeof AiScriptSchema>;

export const AiCaptionCueSchema = z.object({
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  text: z.string().min(1),
});

export const AiCaptionsSchema = z.object({
  cues: z.array(AiCaptionCueSchema).max(200),
});

export type AiCaptions = z.infer<typeof AiCaptionsSchema>;

export const AiSuggestionSchema = z.object({
  itemId: z.string().min(1),
  /** `ANIMATIONS` / `TRANSITIONS` registry ka id. */
  id: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  reason: z.string().default(""),
});

export type AiSuggestion = z.infer<typeof AiSuggestionSchema>;

export const AiAssetSuggestionSchema = z.object({
  /** Kis slot ke liye — `"scene:2:image"`. */
  target: z.string().min(1),
  /** AI ka batayi hui bhoomika — `"character:rahul"`. */
  role: z.string().min(1),
  reason: z.string().default(""),
});

export type AiAssetSuggestion = z.infer<typeof AiAssetSuggestionSchema>;

/* -------------------------------------------------------------- inputs */

export interface GenerateScriptInput {
  story: string;
  language: AiLanguage;
  durationSeconds: number;
  /** `"9:16"` / `"1:1"` / `"16:9"` — layout AI ke haath me nahi, par tone me farak padta hai. */
  aspect: string;
  characters?: readonly string[];
  /** Library me kya-kya hai — AI inhi me se maang sakta hai. */
  availableAssets?: readonly { id: string; label: string; kind: string; tags?: readonly string[] }[];
  tone?: AiTone;
  /** Brand ka naam aur do line — taaki AI ki bhasha brand jaisi lage. */
  brand?: { name: string; voice?: string };
  /**
   * Kaun se scene types maujood hain — **registry se, runtime par**.
   *
   * Ye argument isliye hai ki `@reel/core` ke provider ko registry se seedha
   * poochhna bhi ho sakta tha, par tab test me ek nakli list dena namumkin ho
   * jaata — aur prompt me kya gaya, ye jaanche bina bharosa nahi kiya ja sakta.
   */
  sceneTypes: readonly { id: string; label: string; hint: string; slots: readonly { id: string; label: string; kind: string; required: boolean }[] }[];
}

export interface AiUsage {
  provider: string;
  model: string;
  /** Kitne call gaye — free tier ka poora sawaal yahi hai. */
  calls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  ms: number;
}

export interface AiResult<T> {
  data: T;
  usage: AiUsage;
  /**
   * Jo raw text aaya tha, jab wo parse na ho saka.
   *
   * ⚠️ Ise **chhupana mana hai** (21.6). "AI ne galat jawab diya" padh kar koi
   * kuch nahi kar sakta; asli output dekh kar prompt sudhaara ja sakta hai.
   */
  rawOnFailure?: string;
}

/* ------------------------------------------------------------ provider */

export interface AIProvider {
  readonly name: string;
  /** Key set hai? UI isse "AI off" wali line dikhati hai (21.13). */
  isConfigured(): boolean;

  generateScript(input: GenerateScriptInput): Promise<AiResult<AiScript>>;
  suggestCaptions(input: { text: string; durationSeconds: number; language: AiLanguage }): Promise<AiResult<AiCaptions>>;
  suggestAnimations(input: { items: readonly { id: string; type: string; name: string }[]; animationIds: readonly string[] }): Promise<AiResult<{ suggestions: AiSuggestion[] }>>;
  suggestTransitions(input: { items: readonly { id: string; type: string; name: string }[]; transitionIds: readonly string[] }): Promise<AiResult<{ suggestions: AiSuggestion[] }>>;
  suggestAssets(input: { needs: readonly { target: string; kind: string; hint: string }[]; available: readonly { id: string; label: string; kind: string }[] }): Promise<AiResult<{ suggestions: AiAssetSuggestion[] }>>;
}

/** AI ki galti — network, quota, ya aisa JSON jo do baar me bhi theek na hua. */
export class AiError extends Error {
  readonly kind: "not-configured" | "network" | "quota" | "bad-json" | "refused";
  readonly raw: string | null;

  constructor(
    kind: AiError["kind"],
    message: string,
    options: { raw?: string | null } = {},
  ) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.raw = options.raw ?? null;
  }
}
