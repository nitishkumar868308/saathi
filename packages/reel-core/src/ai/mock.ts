import type {
  AIProvider,
  AiAssetSuggestion,
  AiCaptions,
  AiResult,
  AiScene,
  AiScript,
  AiSuggestion,
  AiUsage,
  GenerateScriptInput,
} from "./types";

/**
 * Mock provider (21.2) — **bina network, hamesha wahi jawab**.
 *
 * ⚠️ Ye ek "dummy" nahi hai; ye default hai jab key na ho. Uske do kaam hain:
 *
 *  1. **Editor bina AI ke poora chale.** AI panel kuch to dikhaye — ek asli
 *     dikhne wala dhaancha jise user haath se bhar sake. Panel ka "AI off" likh
 *     kar khaali baith jaana bhi theek hota, par tab story se shuru karne ka
 *     raasta hi band ho jaata.
 *  2. **Test deterministic rahein.** Network wale provider ke saath test kabhi
 *     bharosemand nahi hote — na offline, na CI me.
 *
 * Jo bhi ye banata hai wo **asli scene types** se banta hai (jo `input` me aate
 * hain), apne banaye naamon se nahi. Isliye iska output usi raaste se guzarta
 * hai jis se Gemini ka guzarta hai — aur agar wo raasta toota ho to yahi test
 * me pakda jaata hai.
 */

function usage(ms: number): AiUsage {
  return { provider: "mock", model: "mock", calls: 0, inputTokens: null, outputTokens: null, ms };
}

/** Kahani ko chhote hisson me todo — har hissa ek scene ka text banta hai. */
function sentences(story: string): string[] {
  return story
    .split(/[.!?।\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export class MockAiProvider implements AIProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    /*
     * ⚠️ `false` — aur ye jaan-boojhkar hai. Mock kaam karta hai par wo **AI
     * nahi hai**, aur UI ko yahi sach dikhana chahiye. `true` lauta dene par
     * user ko lagta ki AI chal raha hai aur uske likhe scenes AI ke hain,
     * jabki wo sirf uski apni kahani ke tukde hain.
     */
    return false;
  }

  async generateScript(input: GenerateScriptInput): Promise<AiResult<AiScript>> {
    const started = Date.now();
    const lines = sentences(input.story);

    /*
     * Scene types **input se** aate hain (registry se), yahan likhe hue nahi.
     * Isliye naya scene type jodne par mock bhi apne aap use dekhne lagta hai —
     * aur agar registry ka koi type toota ho to wo yahin pakda jaata hai.
     */
    const textType = input.sceneTypes.find((entry) => entry.id === "text")?.id;
    const ctaType = input.sceneTypes.find((entry) => entry.id === "cta")?.id;

    const scenes: AiScene[] = [];
    const perScene = Math.max(
      2,
      Math.round(input.durationSeconds / Math.max(1, lines.length + (ctaType ? 1 : 0))),
    );

    for (const line of lines) {
      if (!textType) break;
      scenes.push({
        type: textType,
        name: line.slice(0, 24),
        durationSeconds: Math.min(10, perScene),
        slots: { text: line },
        reason: "Kahani ki ek line",
      });
    }

    if (ctaType) {
      scenes.push({
        type: ctaType,
        name: "CTA",
        durationSeconds: Math.min(5, perScene),
        slots: { text: input.brand?.name ? `${input.brand.name} par dekho` : "Aaj hi try karo" },
        reason: "Har reel ka ant ek saaf kaam par hona chahiye",
      });
    }

    /*
     * Kuch na bane to bhi ek scene — khaali proposal user ko atka deta hai
     * ("Generate dabaya, kuch nahi hua"). Ek scene par wo kam se kam aage badh
     * sakta hai.
     */
    if (scenes.length === 0 && textType) {
      scenes.push({
        type: textType,
        name: "Shuruaat",
        durationSeconds: Math.min(5, input.durationSeconds),
        slots: { text: input.story.slice(0, 80) || "Yahan apni baat likho" },
        reason: "Kahani se koi line nahi mili",
      });
    }

    return {
      data: {
        summary: `${scenes.length} scene, ${input.durationSeconds}s — aapki apni kahani ke tukdon se (AI nahi).`,
        scenes,
      },
      usage: usage(Date.now() - started),
    };
  }

  async suggestCaptions(input: {
    text: string;
    durationSeconds: number;
  }): Promise<AiResult<AiCaptions>> {
    const started = Date.now();
    const lines = sentences(input.text);
    const per = input.durationSeconds / Math.max(1, lines.length);

    return {
      data: {
        cues: lines.map((line, index) => ({
          startSeconds: Math.round(index * per * 100) / 100,
          endSeconds: Math.round((index + 1) * per * 100) / 100,
          text: line,
        })),
      },
      usage: usage(Date.now() - started),
    };
  }

  async suggestAnimations(input: {
    items: readonly { id: string; type: string; name: string }[];
    animationIds: readonly string[];
  }): Promise<AiResult<{ suggestions: AiSuggestion[] }>> {
    const started = Date.now();
    // Image par Ken Burns — sabse aam aur sabse safe sujhaav. Doosre types par
    // kuch nahi: galat sujhaav dene se koi sujhaav na dena behtar hai.
    const kenburns = input.animationIds.includes("kenburns") ? "kenburns" : input.animationIds[0];

    return {
      data: {
        suggestions: kenburns
          ? input.items
              .filter((item) => item.type === "image")
              .map((item) => ({
                itemId: item.id,
                id: kenburns,
                params: {},
                reason: "Sthir tasveer par halka zoom use zinda kar deta hai",
              }))
          : [],
      },
      usage: usage(Date.now() - started),
    };
  }

  async suggestTransitions(input: {
    items: readonly { id: string; type: string; name: string }[];
    transitionIds: readonly string[];
  }): Promise<AiResult<{ suggestions: AiSuggestion[] }>> {
    const started = Date.now();
    const fade = input.transitionIds.includes("fade") ? "fade" : input.transitionIds[0];

    return {
      data: {
        suggestions: fade
          ? input.items.slice(1).map((item) => ({
              itemId: item.id,
              id: fade,
              params: {},
              reason: "Do clips ke beech ka jhatka narm ho jaata hai",
            }))
          : [],
      },
      usage: usage(Date.now() - started),
    };
  }

  async suggestAssets(input: {
    needs: readonly { target: string; kind: string; hint: string }[];
    available: readonly { id: string; label: string; kind: string }[];
  }): Promise<AiResult<{ suggestions: AiAssetSuggestion[] }>> {
    const started = Date.now();
    const suggestions: AiAssetSuggestion[] = [];

    for (const need of input.needs) {
      // Sabse seedha match: usi kism ka pehla asset. Mock ka kaam yahi hai —
      // ek sahi shakl ka jawab dena, chatur jawab nahi.
      const match = input.available.find((asset) => asset.kind === need.kind);
      if (!match) continue;
      suggestions.push({
        target: need.target,
        role: match.id,
        reason: `${match.label} isi kism ki hai`,
      });
    }

    return { data: { suggestions }, usage: usage(Date.now() - started) };
  }
}

export const mockAiProvider = new MockAiProvider();
