/**
 * TTS_PROVIDERS — awaaz kahan se aati hai (22.x).
 *
 * ⚠️ Ye registry isliye hai ki `voice.ts` pehle **seedha edge-tts par jama** tha:
 * error ke message me uska naam, fallback list me uski voice ids, aur generate
 * karne wala code usi ke command-line flags ke hisaab se. Doosra provider jodne
 * ka matlab hota us poori file ko todna.
 *
 * Ab har provider ek entry hai. Naya provider jodna = ek entry + ek adapter.
 * UI, cache aur cleanup teeno isi list se chalte hain — kahin bhi provider ka
 * naam haath se likha hua nahi hai.
 */

export interface TtsProviderEntry {
  id: string;
  label: string;
  /** Ek line me — dropdown me isi se user chunta hai. */
  hint: string;
  /**
   * `cloud`  — text bahar jaata hai (paisa lagta hai, internet chahiye)
   * `local`  — isi machine par banta hai (muft, private, dheema)
   * `manual` — koi awaaz banti hi nahi; user apni file laata hai
   *
   * ⚠️ Ye field UI me **dikhaya jaata hai**, chhupaya nahi. "Ye text Google ko
   * jaayega" wali baat user ko generate dabane se pehle pata honi chahiye.
   */
  kind: "cloud" | "local" | "manual";
  needsApiKey: boolean;
  /** Key kis env var me hai — UI isi naam se batati hai ki kya set karna hai. */
  envKey?: string;
}

export const TTS_PROVIDERS: readonly TtsProviderEntry[] = [
  /*
   * ⚠️ Muft wala **pehle** likha hai, aur ye tarteeb sirf dikhne ki nahi hai —
   * `/api/tts` bina provider ke aane par is list ka **pehla chalne layak**
   * provider chunta hai (26.27). Pehle Gemini upar tha, yaani default hamesha
   * paise wala tha, aur wo faisla kisi ne kabhi liya nahi tha — wo bas likhne ki
   * tarteeb thi. Ek din ka ₹407 ka bill isi "bas tarteeb" se bana.
   *
   * ⚠️ Ye Gemini ko band nahi karta. Gemini ki awaaz behtar hai aur jise wo
   * chahiye wo upar se chun sakta hai — bas ab wo **chunna** padta hai, apne aap
   * nahi lag jaata. Aur `pip install edge-tts` na ho to ye chalne layak hi nahi
   * hai, isliye wahan Gemini par apne aap wapas chala jaata hai.
   */
  {
    id: "edge",
    label: "edge-tts (muft)",
    hint: "Muft. Text Microsoft ke server par jaata hai. `pip install edge-tts` chahiye — Vercel par ye nahi chalta.",
    kind: "cloud",
    needsApiKey: false,
  },
  {
    id: "gemini",
    label: "Gemini (Google)",
    hint: "Sabse achhi awaaz — par har awaaz ka paisa lagta hai (Google ka bill).",
    kind: "cloud",
    needsApiKey: true,
    envKey: "GEMINI_API_KEY",
  },
  {
    id: "upload",
    label: "Apni awaaz (upload)",
    hint: "Khud record ki hui file lagao — kuch generate nahi hota, kahin kuch nahi jaata.",
    kind: "manual",
    needsApiKey: false,
  },
];

export function getTtsProvider(id: string): TtsProviderEntry | undefined {
  return TTS_PROVIDERS.find((provider) => provider.id === id);
}

export function requireTtsProvider(id: string): TtsProviderEntry {
  const provider = getTtsProvider(id);
  if (!provider) {
    throw new Error(
      `TTS provider "${id}" nahi mila. Maujood hain: ${TTS_PROVIDERS.map((p) => p.id).join(", ")}`,
    );
  }
  return provider;
}

/**
 * VOICE_CATEGORIES — "male / female / bacha" wali list (22.x).
 *
 * ⚠️ User ko `Kore`, `Puck`, `hi-IN-MadhurNeural` jaise naam dikhana bekaar hai —
 * un naamon se koi andaaza nahi lagta ki awaaz kaisi hogi. Isliye chunaav
 * **kaam ki bhasha** me hota hai (aadmi / aurat / ladka / ladki / buzurg), aur
 * har category ke andar likha hai ki kis provider par uski asli voice kaunsi hai.
 *
 * ⚠️ Gemini me "bacche ki awaaz" jaisa koi parameter hota hi nahi — wahan sirf
 * naam wali voices hain aur unka andaaz **natural language me** samjhaya jaata
 * hai. Isliye `stylePrompt` yahin baitha hai: category ka matlab ek hi jagah
 * likha hai, adapter me nahi.
 */
export interface VoiceCategoryEntry {
  id: string;
  label: string;
  hint: string;
  /** provider id → us provider ki asli voice id. */
  providerVoices: Record<string, string>;
  /**
   * Gemini jaise provider ko andaaz shabdon me batana padta hai.
   * Jinko iski zaroorat nahi (edge-tts) wo ise chup-chaap chhod dete hain.
   */
  stylePrompt?: string;
}

export const VOICE_CATEGORIES: readonly VoiceCategoryEntry[] = [
  {
    id: "male",
    label: "Aadmi",
    hint: "Saaf, sthir mardana awaaz — narration ke liye",
    providerVoices: { gemini: "Charon", edge: "hi-IN-MadhurNeural" },
    stylePrompt: "Ek sthir, saaf mardana awaaz me, aaram se bolo.",
  },
  {
    id: "female",
    label: "Aurat",
    hint: "Saaf, garmjoshi wali zanana awaaz",
    providerVoices: { gemini: "Kore", edge: "hi-IN-SwaraNeural" },
    stylePrompt: "Ek garmjoshi wali, saaf zanana awaaz me, aaram se bolo.",
  },
  {
    id: "boy",
    label: "Ladka (bacha)",
    hint: "Chhote ladke jaisi utsaah bhari awaaz",
    providerVoices: { gemini: "Puck", edge: "en-IN-PrabhatNeural" },
    stylePrompt: "Ek chhote ladke ki tarah — oonchi, utsaah bhari, khush awaaz me bolo.",
  },
  {
    id: "girl",
    label: "Ladki (bachi)",
    hint: "Chhoti ladki jaisi halki, khush awaaz",
    providerVoices: { gemini: "Aoede", edge: "en-IN-NeerjaNeural" },
    stylePrompt: "Ek chhoti ladki ki tarah — halki, oonchi, khush awaaz me bolo.",
  },
  {
    id: "elder-male",
    label: "Buzurg aadmi",
    hint: "Dheemi, gehri — dadaji jaisi",
    providerVoices: { gemini: "Fenrir", edge: "hi-IN-MadhurNeural" },
    stylePrompt: "Ek umardaraaz aadmi ki tarah — dheeme, gehre aur thehre hue andaaz me bolo.",
  },
  {
    id: "elder-female",
    label: "Buzurg aurat",
    hint: "Dheemi, narm — dadi jaisi",
    providerVoices: { gemini: "Leda", edge: "hi-IN-SwaraNeural" },
    stylePrompt: "Ek umardaraaz aurat ki tarah — dheeme, narm aur thehre hue andaaz me bolo.",
  },
  {
    id: "announcer",
    label: "Announcer",
    hint: "Tez, joshila — ad aur hook ke liye",
    providerVoices: { gemini: "Zephyr", edge: "en-IN-PrabhatNeural" },
    stylePrompt: "Ek ad ke announcer ki tarah — joshile, tez aur saaf andaaz me bolo.",
  },
];

export function getVoiceCategory(id: string): VoiceCategoryEntry | undefined {
  return VOICE_CATEGORIES.find((category) => category.id === id);
}

export function requireVoiceCategory(id: string): VoiceCategoryEntry {
  const category = getVoiceCategory(id);
  if (!category) {
    throw new Error(
      `Voice category "${id}" nahi mili. Maujood hain: ${VOICE_CATEGORIES.map((c) => c.id).join(", ")}`,
    );
  }
  return category;
}

/**
 * Category + provider → us provider ki asli voice id.
 *
 * Na mile to saaf error — chup-chaap kisi doosri voice par gir jaana sabse bura
 * hota: user "bacha" chunta hai aur usse buzurg ki awaaz sunai deti hai, aur
 * kahin koi galti bhi nahi dikhti.
 */
export function voiceIdFor(category: VoiceCategoryEntry, providerId: string): string {
  const voiceId = category.providerVoices[providerId];
  if (!voiceId) {
    throw new Error(
      `"${category.label}" ke liye provider "${providerId}" par koi voice nahi likhi hai`,
    );
  }
  return voiceId;
}
