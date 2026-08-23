import type { AiScene, AiScript } from "../ai/types";
import { applyProposal, buildProposal } from "../ai/proposal";
import { getSceneType, requireSceneType } from "../registry/sceneTypes";
import type { Doc } from "../schema/project";
import { applyAnimationPreset, setTransition, trimItemToSourceRange } from "../timeline/ops";
import { primarySceneItem } from "../scenes/primary";
import { suggestAnimation, suggestTransition, type WizardSceneLike } from "./suggest";

/**
 * Wizard ka draft — **sab kuch ek jagah, aur doc se bahar** (26.4 / 26.11).
 *
 * ⚠️ Wizard chalte hue doc ko **chhua nahi jaata**. Aadmi teen step se guzarta
 * hai, beech me peeche jaata hai, kuch badalta hai, aur "band karo" bhi daba
 * sakta hai. Har step par doc likhne ka matlab hota: aadha bana hua kaam project
 * me pada rehna, aur undo ka dher — 8 scene par 30 se zyada entries, jinme se
 * kisi ek par rukna doc ko aadha-naya aadha-purana chhod deta.
 *
 * Isliye poora wizard yahin jama hota hai aur **ant me ek hi baar** doc me
 * jaata hai — ek `replaceDoc` op, ek Ctrl+Z.
 *
 * ⚠️ Ye file `@reel/core` me hai, studio me nahi, aur wo jaan-boojhkar hai. Yahan
 * na React hai na fetch — isliye poora apply ka raasta ek script se chala kar
 * dekha ja sakta hai (`scripts/check-wizard.ts`), bina browser khole. UI ka kaam
 * sirf ye draft bharna hai.
 */

export interface WizardScene {
  /** AI ke script me is scene ka number (0 se). Kabhi nahi badalta. */
  index: number;
  /** `SCENE_TYPES` ka id — jo AI ne chuna. */
  type: string;
  name: string;
  durationSeconds: number;
  /** Screen par dikhne wala / bola jaane wala text. Aadmi badal sakta hai. */
  text: string;
  /** AI ke diye baaki slots (role naam ke saath), jaise ke waise. */
  slots: Record<string, string>;

  visualAssetId: string | null;
  /**
   * Jo cheez chuni gayi wo tasveer thi ya video.
   *
   * WARNING: Iske bina scene type ka faisla ho hi nahi sakta. Aadmi `image_audio`
   * wale scene par video daal de to us slot ka kind mel nahi khaata, aur item
   * `image` bankar ek video ki id le kar baith jaata - render me wo chup-chaap
   * khaali frame deta hai.
   */
  visualAssetKind: "image" | "video" | null;
  /**
   * Video ka kaunsa hissa lena hai — file ke andar ka waqt (26.18).
   *
   * WARNING: `null` matlab poori file. Video daalte hi aadmi se ye poochha jaata
   * hai, kyunki 2 minute ki recording ko 4 second ke scene me daalne par bina
   * poochhe **pehle 4 second** hi lag jaate hain - aur wo aksar wahi hissa hota
   * hai jisme kuch hua hi nahi (camera set ho raha tha).
   */
  visualTrim: { startSeconds: number; endSeconds: number } | null;
  voiceAssetId: string | null;
  /**
   * Kis text se awaaz bani thi.
   *
   * ⚠️ Iske bina 26.9 ka nishaan lagana namumkin hai: text badalne ke baad bani
   * hui awaaz purane shabdon ki reh jaati hai, aur wo galti kahin dikhti nahi.
   */
  voiceForText: string | null;

  /**
   * Text frame me kahan baithe.
   *
   * WARNING: Default `center` hai aur wo har tasveer par theek nahi baithta -
   * chehra beech me ho to text usi par chadh jaata hai. Ye chunav per-scene hai
   * (baaki chunav poori reel ke liye ek hain), kyunki jagah tasveer se tay hoti
   * hai, reel se nahi.
   */
  textPosition: "top" | "center" | "bottom";

  /** `null` = abhi kuch nahi chuna (auto-fill isi ko bharta hai). */
  animationPresetId: string | null;
  transitionId: string | null;

  /** Aadmi ne "hata do" dabaya. */
  removed: boolean;
}

export interface WizardDraft {
  summary: string;
  scenes: WizardScene[];
  /**
   * Poori reel ke text ka size - 1 = jaisa hai.
   *
   * WARNING: Ye per-scene nahi hai, aur wo jaan-boojhkar hai. Ek hi reel me har
   * scene ka text alag size ka ho to wo reel bani hui nahi, judi hui lagti hai.
   * Aur saat scene par saat baar ye faisla lena wo kaam hai jise aadmi teesre
   * scene par chhod deta hai.
   */
  textScale: number;
}

/* ------------------------------------------------------------ slot khojna */

/**
 * Kis slot me text jaata hai.
 *
 * ⚠️ Slot ka id scene type ke hisaab se badalta hai — `text`/`cta` me `"text"`,
 * `image_audio` me `"caption"`. Naam se dhoondhna (`slots.text`) yahan chalta
 * aur wahan chup-chaap khaali chhod deta, isliye **kind se** dhoondha jaata hai.
 */
export function textSlotId(typeId: string): string | null {
  const type = getSceneType(typeId);
  return type?.slots.find((slot) => slot.kind === "text")?.id ?? null;
}

/**
 * Scene ka **dikhne wala** asset slot — tasveer ya video.
 *
 * ⚠️ Pehle yahan sirf `asset:image` dekha jaata tha, aur wo ek asli chhed tha jo
 * chala kar dekhne par mila: AI aksar `screen_recording` scene banata hai, jiska
 * slot `asset:video` hota hai. Wizard uske liye koi button dikhata hi nahi tha,
 * isliye wo scene bhara ja hi nahi sakta tha aur ant me "asset library me nahi
 * mili" keh kar chhoot jaata tha — aur aadmi ke paas use theek karne ka koi
 * raasta nahi hota tha.
 */
export function visualSlotId(typeId: string): string | null {
  const type = getSceneType(typeId);
  return (
    type?.slots.find((slot) => slot.kind === "asset:image" || slot.kind === "asset:video")?.id ??
    null
  );
}

/** Wo slot tasveer maangta hai ya video — picker aur label dono isse tay hote hain. */
export function visualSlotKind(typeId: string): "image" | "video" | null {
  const type = getSceneType(typeId);
  const slot = type?.slots.find(
    (entry) => entry.kind === "asset:image" || entry.kind === "asset:video",
  );
  if (!slot) return null;
  return slot.kind === "asset:video" ? "video" : "image";
}

export function audioSlotId(typeId: string): string | null {
  const type = getSceneType(typeId);
  return type?.slots.find((slot) => slot.kind === "asset:audio")?.id ?? null;
}

/**
 * Tasveer chhodne par ye scene sach me kaunsa type banega.
 *
 * ⚠️ Seedha `text` par gir jaana sabse aasan tha aur galat hota: `text` me audio
 * ka slot hai hi nahi, yaani aadmi ki banayi hui **awaaz chup-chaap gayab** ho
 * jaati — scene banta, text dikhta, bas awaaz chali jaati. Isliye awaaz ho to
 * `text_audio`, warna `text`.
 */
export function effectiveType(scene: WizardScene): string {
  if (scene.visualAssetId) {
    /*
     * Chuni hui cheez us scene type ke slot se mel khaati hai? Na khaaye to type
     * badalna hi padta hai - warna `image` ka item ek video ki id le kar baith
     * jaata hai aur render me khaali frame aata hai, bina kisi error ke.
     */
    const want = scene.visualAssetKind;
    if (!want || visualSlotKind(scene.type) === want) return scene.type;
    return want === "video" ? "video" : "image_audio";
  }

  const visual = visualSlotId(scene.type);
  const type = getSceneType(scene.type);
  const required = type?.slots.find((slot) => slot.id === visual)?.required ?? false;
  if (!visual || !required) return scene.type;

  return scene.voiceAssetId ? "text_audio" : "text";
}

/** Sifaarish ke liye scene ka chhota roop. */
function asSceneLike(scene: WizardScene): WizardSceneLike {
  return { type: effectiveType(scene), text: scene.text, hasImage: Boolean(scene.visualAssetId) };
}

/* -------------------------------------------------------------- draft banao */

/** AI ke script se pehla draft. */
export function draftFromScript(script: AiScript): WizardDraft {
  return {
    summary: script.summary,
    textScale: 1,
    scenes: script.scenes.map((scene, index) => {
      const textSlot = textSlotId(scene.type);
      const rest: Record<string, string> = { ...scene.slots };
      if (textSlot) delete rest[textSlot];

      return {
        index,
        type: scene.type,
        name: scene.name,
        durationSeconds: scene.durationSeconds,
        text: (textSlot ? scene.slots[textSlot] : "") ?? "",
        slots: rest,
        visualAssetId: null,
        visualAssetKind: null,
        visualTrim: null,
        textPosition: "center",
        voiceAssetId: null,
        voiceForText: null,
        animationPresetId: null,
        transitionId: null,
        removed: false,
      };
    }),
  };
}

/**
 * Bani hui awaaz ab purane shabdon ki hai? (26.9)
 *
 * ⚠️ Trim kar ke milaya jaata hai — aage-peeche ka space badal jaana aam hai
 * (aadmi text ke ant me enter daba deta hai), aur uspar "awaaz purani hai" ka
 * laal nishaan dikhana ek jhoothi chetavni hai. Jhoothi chetavni ka anjaam
 * hamesha ek hi hota hai: kuch dinon me use koi padhta hi nahi.
 */
export function voiceStale(scene: WizardScene): boolean {
  if (!scene.voiceAssetId || scene.voiceForText === null) return false;
  return scene.voiceForText.trim() !== scene.text.trim();
}

/**
 * Jo chunav abhi khaali hain, unme sifaarish bhar do (26.8).
 *
 * ⚠️ Ye function bhare hue chunav ko **kabhi nahi** chhoota. Sab kuch dobara
 * likh dena ek galti hai jiska pata bahut der se chalta hai: aadmi ne 20 minute
 * laga kar chuna, ek button daba, aur sab wapas default. Wo dobara us button ke
 * paas nahi jaata — aur aksar tool ke paas bhi nahi.
 */
export function autoFill(draft: WizardDraft): WizardDraft {
  const live = draft.scenes.filter((scene) => !scene.removed);

  return {
    ...draft,
    scenes: draft.scenes.map((scene) => {
      if (scene.removed) return scene;

      /*
       * ⚠️ Sifaarish ke liye number **bache hue** scenes me se lena hai, draft ke
       * asli index se nahi. Beech ka scene hata dene par asli index me gaddha ban
       * jaata hai, aur "pehla scene" (jise transition nahi milta) wo reh jaata
       * hai jo ab pehla hai hi nahi.
       */
      const at = live.indexOf(scene);
      const previous = at > 0 ? live[at - 1] : null;

      return {
        ...scene,
        animationPresetId:
          scene.animationPresetId ?? suggestAnimation(asSceneLike(scene), at),
        transitionId:
          scene.transitionId ??
          suggestTransition(at, Boolean(scene.visualAssetId), Boolean(previous?.visualAssetId)),
      };
    }),
  };
}

/* ------------------------------------------------------------------ apply */

export interface ApplyWizardResult {
  doc: Doc;
  /** Kitne scene bane. */
  applied: number;
  /** Jo chhoot gaye, wajah ke saath. */
  skipped: { index: number; reason: string }[];
}

/**
 * Poora draft doc me lagao — **ek baar me** (26.11).
 *
 * Raasta wahi hai jo AI panel ka tha, sirf ab uske slots bhare hue hain:
 *
 *     draft → AiScript → buildProposal → applyProposal → animation + transition
 *
 * ⚠️ Yahan koi naya raasta nahi banaya gaya. `addScene`, `applyAnimationPreset`,
 * `setTransition` — sab wahi ops hain jo haath ke button chalate hain (21.7).
 * Wizard ke liye alag raasta banane par ek din wizard se bani reel aur haath se
 * banayi reel do alag cheezein ban jaati.
 */
export function applyWizard(args: { doc: Doc; draft: WizardDraft }): ApplyWizardResult {
  const live = args.draft.scenes.filter((scene) => !scene.removed);

  const assetByRole: Record<string, string> = {};
  const scenes: AiScene[] = live.map((scene, at) => {
    const type = effectiveType(scene);
    const slots: Record<string, string> = { ...scene.slots };

    const textSlot = textSlotId(type);
    if (textSlot && scene.text.trim()) slots[textSlot] = scene.text;

    /*
     * ⚠️ Asset id seedha slot me nahi likhi jaati. `applyProposal` slots ko
     * `assetByRole` se guzarta hai, isliye yahan **role ka naam** jaata hai aur
     * asli id map me. Id seedha likhne par wo naam samajh kar dhoondhi jaati aur
     * na milne par slot khaali reh jaata — bina kisi error ke.
     */
    const visualSlot = visualSlotId(type);
    if (visualSlot && scene.visualAssetId) {
      const role = `visual:${scene.index}`;
      slots[visualSlot] = role;
      assetByRole[role] = scene.visualAssetId;
    } else if (visualSlot) {
      delete slots[visualSlot];
    }

    const audioSlot = audioSlotId(type);
    if (audioSlot && scene.voiceAssetId) {
      const role = `voice:${scene.index}`;
      slots[audioSlot] = role;
      assetByRole[role] = scene.voiceAssetId;
    } else if (audioSlot) {
      delete slots[audioSlot];
    }

    /*
     * WARNING: Trim ho to scene ki lambai bhi wahi ho jaati hai. Bina iske do me
     * se ek galti pakki hai: chuna hua hissa scene se chhota ho to aakhir me
     * jamaa hua frame dikhta hai, aur bada ho to chuna hua hissa beech me hi kat
     * jaata hai - aur dono me aadmi ko lagta hai ki uska chunav maana hi nahi
     * gaya.
     */
    const trimmed = scene.visualTrim
      ? Math.max(0.5, scene.visualTrim.endSeconds - scene.visualTrim.startSeconds)
      : null;

    return {
      type,
      name: scene.name,
      durationSeconds: trimmed ?? scene.durationSeconds,
      slots,
      reason: `wizard · scene ${at + 1}`,
    };
  });

  const script: AiScript = { summary: args.draft.summary, scenes };
  const proposal = buildProposal({ doc: args.doc, script, mode: "append" });

  /*
   * ⚠️ Scene id pakadne ka ek hi bharosemand tarika hai: **pehle-baad ka farak**.
   * `applyProposal` sirf ginti lautata hai, id nahi, aur `append` mode naye scene
   * hamesha aakhir me jodta hai. Isliye pehle se maujood id yaad rakh kar baad me
   * jo naya mile wahi is wizard ka hai.
   *
   * Peeche se ginn kar (`slice(-n)`) lena aasan tha aur galat: beech ka koi scene
   * `skipped` me chala jaaye to ginti khisak jaati hai aur animation galat scene
   * par lag jaati — bina kisi error ke.
   */
  const before = new Set(args.doc.scenes.map((scene) => scene.id));
  const result = applyProposal({
    doc: args.doc,
    proposal,
    acceptedIds: proposal.entries.map((entry) => entry.id),
    assetByRole,
  });

  const skippedEntries = new Set(result.skipped.map((entry) => entry.id));
  /** Jo scene sach me bane — usi kram me jis kram me bheje the. */
  const madeFrom = live.filter((_, at) => !skippedEntries.has(`proposal_${at}`));

  const created = [...result.doc.scenes]
    .filter((scene) => !before.has(scene.id))
    .sort((a, b) => a.order - b.order);

  let doc = result.doc;

  created.forEach((scene, at) => {
    const source = madeFrom[at];
    if (!source) return;

    const primary = primarySceneItem(doc, scene.id);
    // Jis scene me dikhne layak kuch nahi (sirf awaaz), wahan animation ka
    // sawaal hi nahi uthta — SceneAnimation bhi wahan dropdown nahi dikhata.
    if (!primary) return;

    /*
     * ⚠️ Harkat sirf tab lagti hai jab us scene me sach me tasveer ho. Ye guard
     * UI par bharosa nahi karta, aur wo jaan-boojhkar hai: aadmi tasveer daal kar
     * harkat chun sakta hai aur phir tasveer hata sakta hai. Us haalat me `primary`
     * ab **text** ka item hota hai, aur harkat text par jaakar lagti — hilta hua
     * text, bina kisi wajah ke. `suggestAnimation` isi liye bina tasveer ke `null`
     * deta hai; yahan wahi baat dobara bandhi hui hai.
     */
    if (source.animationPresetId && source.visualAssetId) {
      doc = applyAnimationPreset(doc, {
        itemIds: [primary.id],
        presetId: source.animationPresetId,
      });
    }

    /*
     * Video ka chuna hua hissa. Ye `applyAnimationPreset` se **pehle** nahi, baad
     * me lagta hai - dono alag cheezein hain aur ek doosre ko chhoote nahi.
     */
    if (source.visualTrim && primary.assetId === source.visualAssetId) {
      doc = trimItemToSourceRange(doc, {
        itemId: primary.id,
        startSeconds: source.visualTrim.startSeconds,
        endSeconds: source.visualTrim.endSeconds,
      });
    }

    if (source.transitionId && source.transitionId !== "none") {
      doc = setTransition(doc, {
        itemIds: [primary.id],
        side: "in",
        type: source.transitionId,
      });
    }
  });

  /*
   * Text ki jagah — har scene ki apni.
   *
   * WARNING: Ye `applyProposal` ke baad lagti hai, us scene ke text items par.
   * Scene ke `build()` ke andar karna mumkin nahi: wahan har type ka apna layout
   * hai (CTA me logo aur patti bhi hain), aur ek hi niyam sab par thopne se wo
   * layout toot jaata.
   */
  created.forEach((scene, at) => {
    const src = madeFrom[at];
    if (!src || src.textPosition === "center") return;
    const shift = Math.round(doc.project.height * (src.textPosition === "top" ? -0.28 : 0.28));
    doc = {
      ...doc,
      items: doc.items.map((item) =>
        item.sceneId === scene.id && item.text
          ? { ...item, transform: { ...item.transform, y: item.transform.y + shift } }
          : item,
      ),
    };
  });

  /*
   * Text ka size sabse aakhir me - saare scene ban jaane ke baad. Har scene ke
   * andar karne par CTA jaise type chhoot jaate, jinka text `build()` ke andar
   * banta hai aur bahar se dikhta hi nahi.
   */
  const scale = args.draft.textScale;
  if (scale !== 1) {
    const madeIds = new Set(
      doc.items.filter((item) => !before.has(item.sceneId ?? "")).map((item) => item.id),
    );
    doc = {
      ...doc,
      items: doc.items.map((item) =>
        madeIds.has(item.id) && item.text
          ? { ...item, text: { ...item.text, fontSize: Math.round(item.text.fontSize * scale) } }
          : item,
      ),
    };
  }

  return {
    doc,
    applied: result.applied,
    skipped: result.skipped.map((entry) => {
      const at = Number(entry.id.replace("proposal_", ""));
      return { index: live[at]?.index ?? at, reason: entry.reason };
    }),
  };
}

/** UI ke liye: is draft me kya-kya abhi baaki hai. */
export function draftProgress(draft: WizardDraft): {
  total: number;
  withImage: number;
  withVoice: number;
  staleVoice: number;
  needsChoice: number;
} {
  const live = draft.scenes.filter((scene) => !scene.removed);
  return {
    total: live.length,
    withImage: live.filter((scene) => scene.visualAssetId).length,
    withVoice: live.filter((scene) => scene.voiceAssetId).length,
    staleVoice: live.filter(voiceStale).length,
    needsChoice: live.filter(
      (scene) => scene.transitionId === null || (scene.visualAssetId && !scene.animationPresetId),
    ).length,
  };
}

/** Registry me ye type hai bhi? — UI galat type par gir na jaaye. */
export function knownType(typeId: string): boolean {
  try {
    requireSceneType(typeId);
    return true;
  } catch {
    return false;
  }
}
