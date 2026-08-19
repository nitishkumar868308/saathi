import {
  AiCaptionsSchema,
  AiError,
  AiScriptSchema,
  AiSuggestionSchema,
  AiAssetSuggestionSchema,
  type AIProvider,
  type AiResult,
  type AiUsage,
  type GenerateScriptInput,
} from "@reel/core";
import { z } from "zod";

/**
 * Gemini adapter (21.3 / 21.4 / 21.6).
 *
 * ⚠️ Ye `web/lib/translate.ts` ka **pattern** copy karta hai — wahi env vars
 * (`GEMINI_API_KEY`, `GEMINI_MODEL`), wahi JSON discipline, wahi "fail hone par
 * chup-chaap kuch mat todo" wali soch. Us file ko chhua nahi gaya: wo chal rahi
 * hai aur uska apna kaam hai.
 *
 * ⚠️ **Free tier ka anushasan** (21.4): ek reel = **ek** call. Script aur scenes
 * alag-alag maangna aasan hota par wo do call ban jaate, aur free tier me wo
 * seedha aadhi reels ka matlab hai. Isliye ek hi structured call me poori scene
 * list aati hai.
 *
 * Retry sirf **ek** baar aur sirf tab jab JSON toota ho. Quota ya network ki
 * galti par retry karna sabse bura hota — wo ek chhoti dikkat ko do guna kharch
 * bana deta hai, aur quota to waise bhi khatam hai.
 */

const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL ?? "gemini-3.5-flash";

const SYSTEM = `Tum ek chhoti social-media reel ka script likhte ho — Apka Saathi naam ke app ke liye. Wo log documents aur reminders sambhalne ke liye use karte hain, aur dekhne wale aam phone user hain.

Niyam:
- Sirf JSON lautao, aur kuch nahi. Koi markdown, koi \`\`\` nahi.
- Scene ka "type" SIRF di gayi list me se hona chahiye. Naya type mat banao.
- Har scene ke "slots" me sirf wahi keys jo us type ke liye di gayi hain.
- Asset wale slot me asset ka ID mat likho (tumhe pata hi nahi). Uski bhoomika likho, jaise "character:rahul" ya "screen_recording:reminders".
- Bhasha aam bolchaal ki rakho, sarkari/kitaabi nahi.
- Har scene chhota rakho — 2 se 5 second. Reel me lambi baat koi nahi sunta.
- Sab scene ki durationSeconds ka jod di gayi lambai ke aas-paas hona chahiye.`;

function usage(started: number, calls: number, raw: unknown): AiUsage {
  const meta = (raw as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } })
    ?.usageMetadata;
  return {
    provider: "gemini",
    model: MODEL,
    calls,
    inputTokens: meta?.promptTokenCount ?? null,
    outputTokens: meta?.candidatesTokenCount ?? null,
    ms: Date.now() - started,
  };
}

/**
 * Ek Gemini call — aur uska raw text.
 *
 * ⚠️ Text yahan **parse nahi** hota. Parse karne wala hi tay karta hai ki repair
 * ki zaroorat hai ya nahi, aur usko raw text chahiye hota hai (21.6: "raw output
 * mujhe dikhao, chhupao nahi").
 */
async function callGemini(
  prompt: string,
  apiKey: string,
): Promise<{ text: string; raw: unknown }> {
  let response: Response;
  try {
    response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, system: SYSTEM, model: MODEL }),
    });
  } catch (cause) {
    /*
     * Key browser me kabhi nahi aati — call ek API route se jaati hai. Isliye
     * yahan `apiKey` sirf "configured hai ya nahi" batane ke liye hai; asli key
     * server par rehti hai. Browser me key rakhne ka matlab hai use kisi ko bhi
     * de dena.
     */
    throw new AiError("network", `Gemini tak pahuncha hi nahi: ${String(cause)}`);
  }

  if (response.status === 429) {
    throw new AiError(
      "quota",
      "Gemini ka free tier ka kota khatam ho gaya. Thodi der baad koshish karo — dobara try karne se wo wapas nahi aata.",
    );
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AiError("network", `Gemini ne ${response.status} diya`, { raw: detail });
  }

  const data = (await response.json()) as {
    text?: string;
    raw?: unknown;
    error?: string;
  };
  if (data.error) throw new AiError("refused", data.error);
  void apiKey;
  return { text: data.text ?? "", raw: data.raw };
}

/**
 * JSON parse + zod — aur ek repair retry (21.6).
 *
 * ⚠️ Sirf **ek** repair. Do-teen baar koshish karne se aksar wahi jawab dobara
 * aata hai aur kota do-teen guna kharch ho jaata hai. Ek baar me na bane to
 * user ko raw output dikhana hi sabse imaandaar hai — usse prompt sudhaara ja
 * sakta hai; "AI ne galat jawab diya" se kuch nahi hota.
 */
async function parseWithRepair<T>(
  // `ZodType<T, ZodTypeDef, unknown>` — `ZodType<T>` par input aur output ek hi
  // maan liye jaate hain, aur tab `.default()` wale fields optional dikhte hain.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  first: { text: string; raw: unknown },
  repair: () => Promise<{ text: string; raw: unknown }>,
): Promise<{ data: T; raw: unknown; calls: number }> {
  const attempt = (text: string): T | null => {
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };

  const once = attempt(first.text);
  if (once !== null) return { data: once, raw: first.raw, calls: 1 };

  const second = await repair();
  const twice = attempt(second.text);
  if (twice !== null) return { data: twice, raw: second.raw, calls: 2 };

  throw new AiError("bad-json", "Gemini ka jawab do baar me bhi sahi shakl me nahi aaya.", {
    raw: second.text || first.text,
  });
}

export class GeminiAiProvider implements AIProvider {
  readonly name = "gemini";

  private readonly configured: boolean;

  constructor(configured: boolean) {
    this.configured = configured;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private assertReady(): void {
    if (this.configured) return;
    throw new AiError(
      "not-configured",
      "GEMINI_API_KEY set nahi hai — AI band hai. Baaki poora editor waise ka waisa chalta hai.",
    );
  }

  async generateScript(input: GenerateScriptInput): Promise<AiResult<z.infer<typeof AiScriptSchema>>> {
    this.assertReady();
    const started = Date.now();

    /*
     * Scene types **runtime par** prompt me jaate hain (21.5). Yahan list likh
     * dena aasan hai par tab naya scene type jodne par AI ko uska pata hi nahi
     * chalta, aur wo chup-chaap purane types hi use karta rehta hai.
     */
    const types = input.sceneTypes
      .map((entry) => {
        const slots = entry.slots
          .map((slot) => `${slot.id} (${slot.kind}${slot.required ? ", zaroori" : ""})`)
          .join(", ");
        return `- "${entry.id}" — ${entry.label}. ${entry.hint} Slots: ${slots || "koi nahi"}`;
      })
      .join("\n");

    const assets =
      input.availableAssets && input.availableAssets.length > 0
        ? `\n\nLibrary me ye assets hain (inhi ki bhoomika maang sakte ho):\n${input.availableAssets
            .map((asset) => `- ${asset.kind}: ${asset.label}${asset.tags?.length ? ` [${asset.tags.join(", ")}]` : ""}`)
            .join("\n")}`
        : "";

    const prompt =
      `Kahani:\n${input.story}\n\n` +
      `Bhasha: ${input.language}. Lambai: ${input.durationSeconds} second. Aspect: ${input.aspect}.` +
      (input.tone ? ` Tone: ${input.tone}.` : "") +
      (input.brand?.name ? ` Brand: ${input.brand.name}.` : "") +
      (input.characters?.length ? ` Characters: ${input.characters.join(", ")}.` : "") +
      `\n\nScene types (SIRF inhi me se chuno):\n${types}${assets}\n\n` +
      `JSON is shakl me lautao:\n` +
      `{"summary":"...","scenes":[{"type":"...","name":"...","durationSeconds":3,"slots":{"text":"..."},"reason":"..."}]}`;

    const first = await callGemini(prompt, "server");
    const { data, raw, calls } = await parseWithRepair(AiScriptSchema, first, () =>
      callGemini(
        `${prompt}\n\nPichhla jawab sahi JSON nahi tha. Sirf JSON lautao, koi markdown nahi.`,
        "server",
      ),
    );

    return { data, usage: usage(started, calls, raw) };
  }

  async suggestCaptions(input: {
    text: string;
    durationSeconds: number;
  }): Promise<AiResult<z.infer<typeof AiCaptionsSchema>>> {
    this.assertReady();
    const started = Date.now();

    const prompt =
      `Is text ko reel ke captions me todo. Har cue 2-4 second ka, do line se zyada nahi.\n\n` +
      `Poori lambai: ${input.durationSeconds} second.\n\nText:\n${input.text}\n\n` +
      `JSON: {"cues":[{"startSeconds":0,"endSeconds":2.5,"text":"..."}]}`;

    const first = await callGemini(prompt, "server");
    const { data, raw, calls } = await parseWithRepair(AiCaptionsSchema, first, () =>
      callGemini(`${prompt}\n\nSirf JSON lautao.`, "server"),
    );
    return { data, usage: usage(started, calls, raw) };
  }

  async suggestAnimations(input: {
    items: readonly { id: string; type: string; name: string }[];
    animationIds: readonly string[];
  }): Promise<AiResult<{ suggestions: z.infer<typeof AiSuggestionSchema>[] }>> {
    return this.suggest(
      `In clips par animation sujhao. Sirf in ids me se: ${input.animationIds.join(", ")}.`,
      input.items,
    );
  }

  async suggestTransitions(input: {
    items: readonly { id: string; type: string; name: string }[];
    transitionIds: readonly string[];
  }): Promise<AiResult<{ suggestions: z.infer<typeof AiSuggestionSchema>[] }>> {
    return this.suggest(
      `In clips ke beech transition sujhao. Sirf in ids me se: ${input.transitionIds.join(", ")}.`,
      input.items,
    );
  }

  private async suggest(
    instruction: string,
    items: readonly { id: string; type: string; name: string }[],
  ): Promise<AiResult<{ suggestions: z.infer<typeof AiSuggestionSchema>[] }>> {
    this.assertReady();
    const started = Date.now();

    const schema = z.object({ suggestions: z.array(AiSuggestionSchema).max(50) });
    const prompt =
      `${instruction}\n\nClips:\n${items
        .map((item) => `- ${item.id} (${item.type}): ${item.name}`)
        .join("\n")}\n\n` +
      `JSON: {"suggestions":[{"itemId":"...","id":"...","params":{},"reason":"..."}]}`;

    const first = await callGemini(prompt, "server");
    const { data, raw, calls } = await parseWithRepair(schema, first, () =>
      callGemini(`${prompt}\n\nSirf JSON lautao.`, "server"),
    );
    return { data, usage: usage(started, calls, raw) };
  }

  async suggestAssets(input: {
    needs: readonly { target: string; kind: string; hint: string }[];
    available: readonly { id: string; label: string; kind: string }[];
  }): Promise<AiResult<{ suggestions: z.infer<typeof AiAssetSuggestionSchema>[] }>> {
    this.assertReady();
    const started = Date.now();

    const schema = z.object({ suggestions: z.array(AiAssetSuggestionSchema).max(50) });
    const prompt =
      `In jagahon ke liye library me se asset chuno.\n\nZaroorat:\n${input.needs
        .map((need) => `- ${need.target} (${need.kind}): ${need.hint}`)
        .join("\n")}\n\nLibrary:\n${input.available
        .map((asset) => `- ${asset.id} (${asset.kind}): ${asset.label}`)
        .join("\n")}\n\n` +
      `JSON: {"suggestions":[{"target":"...","role":"<library ka id>","reason":"..."}]}`;

    const first = await callGemini(prompt, "server");
    const { data, raw, calls } = await parseWithRepair(schema, first, () =>
      callGemini(`${prompt}\n\nSirf JSON lautao.`, "server"),
    );
    return { data, usage: usage(started, calls, raw) };
  }
}
