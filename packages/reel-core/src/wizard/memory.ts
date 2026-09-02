import type { WizardDraft } from "./draft";

/**
 * Wizard ki yaadgaar — bani hui reel ke saath uske apne chunav (26.30).
 *
 * ⚠️ `applyWizard` **ek taraf** chalta hai: draft → doc. Doc me sirf nateeja
 * bachta hai; awaaz ki category, video ka kaat, volume ke mod, hataye hue scene,
 * aur asli file aur uski fit ki hui copy ka farak — inme se kuch bhi doc me
 * likha nahi jaata. Isliye doc se draft *wapas* banana andaaza hota, hisaab
 * nahi: ek hi doc se do alag draft nikal sakte hain, aur unme se kaunsa sach hai
 * iska koi jawab nahi hota. Wo andaaza aadmi ko uski apni reel me galat chunav
 * dikhata, aur wo galti sirf reel dobara bana kar pakdi jaati.
 *
 * Isliye draft **jama** kiya jaata hai, dobara nikala nahi jaata.
 */

export const WIZARD_MEMORY_VERSION = 1;

export interface WizardMemory {
  version: number;
  draft: WizardDraft;
  /**
   * `applyWizard` ne jo scene banaye the.
   *
   * ⚠️ Iske bina "wizard ke baad haath se badlav hue the ya nahi" ka koi jawab
   * nahi hota — aur wo jawab zaroori hai, kyunki dobara lagane par wo badlav
   * chale jaate hain. Bina bataye unhe mita dena wo galti hai jiski keemat sabse
   * zyada hai.
   */
  appliedSceneIds: string[];
  appliedAt: string;
}

export function writeWizardMemory(args: {
  draft: WizardDraft;
  appliedSceneIds: readonly string[];
}): WizardMemory {
  return {
    version: WIZARD_MEMORY_VERSION,
    draft: args.draft,
    appliedSceneIds: [...args.appliedSceneIds],
    appliedAt: new Date().toISOString(),
  };
}

/**
 * Doc me se yaadgaar padho — **samajh na aaye to `null`**.
 *
 * ⚠️ Yahan zod ka sakht schema jaan-boojhkar nahi hai, aur ye is poore feature
 * ka sabse zaroori faisla hai. Doc ko worker **sakht** parse karta hai
 * (`studio/lib/renders.ts` ka `parseDoc(input.doc)`), aur draft ka shape UI ke
 * saath badalta rehta hai. Sakht schema rakhne par ek purane shape ki yaadgaar
 * poore render ko maar deti — yaani ek suvidha ki wajah se video banna band, aur
 * wajah aisi jagah dikhti jiska is feature se koi lena-dena hi nahi.
 *
 * Isliye doc ke raaste par ye sirf "kuch pada hai" hai. Samajh aaya to button
 * dikhta hai; nahi aaya to nahi dikhta — aur baaki sab waise ka waisa chalta
 * rehta hai.
 */
export function readWizardMemory(value: unknown): WizardMemory | null {
  if (!value || typeof value !== "object") return null;
  const memory = value as Partial<WizardMemory>;

  if (memory.version !== WIZARD_MEMORY_VERSION) return null;
  if (!memory.draft || typeof memory.draft !== "object") return null;
  if (!Array.isArray(memory.draft.scenes)) return null;
  if (!Array.isArray(memory.appliedSceneIds)) return null;
  if (typeof memory.appliedAt !== "string") return null;

  return {
    version: memory.version,
    draft: memory.draft as WizardDraft,
    appliedSceneIds: memory.appliedSceneIds.filter(
      (id): id is string => typeof id === "string",
    ),
    appliedAt: memory.appliedAt,
  };
}

/* ------------------------------------------------ purana draft, aaj ka haal */

export interface RehydratedDraft {
  draft: WizardDraft;
  /** Jin scene ki awaaz ab maujood nahi (scene ka `index`). */
  lostVoice: number[];
  /** Jin scene ki tasveer/video ab maujood nahi (scene ka `index`). */
  lostVisual: number[];
  /** Wizard ke baad us doc me haath se badlav hue the? */
  handEdited: boolean;
}

/**
 * Purani yaadgaar ko aaj ke haal par bithao.
 *
 * ⚠️ TTS ki awaaz `temporary` hoti hai aur cleanup use utha leta hai. Gayab
 * asset ko chup-chaap chhod dene par wizard "awaaz hai" dikhata aur reel me us
 * jagah **chuppi** aati — aur wo galti sirf reel sun kar pakdi jaati hai, yaani
 * sabse mehngi jagah par. Isliye jo nahi hai use saaf hata diya jaata hai, aur
 * kaunsa gaya wo bataya jaata hai.
 */
export function rehydrateDraft(args: {
  memory: WizardMemory;
  /** Ye asset ab bhi maujood hai? */
  assetExists(assetId: string): boolean;
  /** Us doc me abhi jo scene hain. */
  docSceneIds: readonly string[];
}): RehydratedDraft {
  const lostVoice: number[] = [];
  const lostVisual: number[] = [];

  const scenes = args.memory.draft.scenes.map((scene) => {
    let next = scene;

    if (next.voiceAssetId && !args.assetExists(next.voiceAssetId)) {
      lostVoice.push(next.index);
      next = { ...next, voiceAssetId: null, voiceSeconds: null, voiceTrim: null };
    }

    /*
     * Fit ki hui copy pehle dekhi jaati hai, asli file uske baad — kyunki asli
     * file ke jaane par uski fit bhi bekaar ho jaati hai, par ulta sach nahi
     * hai: fit ki copy hat sakti hai aur asli file bachi reh sakti hai (tab wo
     * dobara ban jaayegi).
     */
    if (next.visualFitAssetId && !args.assetExists(next.visualFitAssetId)) {
      next = { ...next, visualFitAssetId: null, visualFitKey: null };
    }

    if (next.visualAssetId && !args.assetExists(next.visualAssetId)) {
      lostVisual.push(next.index);
      next = {
        ...next,
        visualAssetId: null,
        visualAssetKind: null,
        visualSize: null,
        visualTrim: null,
        visualFitAssetId: null,
        visualFitKey: null,
      };
    }

    if (next.backgroundAssetId && !args.assetExists(next.backgroundAssetId)) {
      next = { ...next, backgroundAssetId: null };
    }

    return next;
  });

  const musicAssetId =
    args.memory.draft.musicAssetId && !args.assetExists(args.memory.draft.musicAssetId)
      ? null
      : args.memory.draft.musicAssetId;

  const applied = [...args.memory.appliedSceneIds].sort();
  const current = [...args.docSceneIds].sort();
  const handEdited =
    applied.length !== current.length || applied.some((id, at) => id !== current[at]);

  return {
    draft: {
      ...args.memory.draft,
      scenes,
      musicAssetId,
      /*
       * ⚠️ Dobara kholne par **hamesha** "purane hata kar", chahe pichhli baar
       * kuch bhi chuna gaya ho. Aadmi ki niyat "is reel ko sudhaarna" hai, "is
       * reel ko maujooda project me jodna" nahi. Jodne par reel do guni lambi ban
       * jaati hai jisme pehle aadhe scene purane hote hain — aur wo galti export
       * ke baad hi dikhti hai.
       *
       * Chunav phir bhi wizard me saamne rehta hai, isliye jise sach me jodna ho
       * wo badal sakta hai.
       */
      replaceExisting: true,
    },
    lostVoice,
    lostVisual,
    handEdited,
  };
}
