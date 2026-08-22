import type { AiScene, AiScript } from "../ai/types";
import { applyProposal, buildProposal } from "../ai/proposal";
import { getSceneType, requireSceneType } from "../registry/sceneTypes";
import type { Doc } from "../schema/project";
import { applyAnimationPreset, setTransition } from "../timeline/ops";
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

  imageAssetId: string | null;
  voiceAssetId: string | null;
  /**
   * Kis text se awaaz bani thi.
   *
   * ⚠️ Iske bina 26.9 ka nishaan lagana namumkin hai: text badalne ke baad bani
   * hui awaaz purane shabdon ki reh jaati hai, aur wo galti kahin dikhti nahi.
   */
  voiceForText: string | null;

  /** `null` = abhi kuch nahi chuna (auto-fill isi ko bharta hai). */
  animationPresetId: string | null;
  transitionId: string | null;

  /** Aadmi ne "hata do" dabaya. */
  removed: boolean;
}

export interface WizardDraft {
  summary: string;
  scenes: WizardScene[];
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

export function imageSlotId(typeId: string): string | null {
  const type = getSceneType(typeId);
  return type?.slots.find((slot) => slot.kind.startsWith("asset:image"))?.id ?? null;
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
  if (scene.imageAssetId) return scene.type;

  const image = imageSlotId(scene.type);
  const type = getSceneType(scene.type);
  const required = type?.slots.find((slot) => slot.id === image)?.required ?? false;
  if (!image || !required) return scene.type;

  return scene.voiceAssetId ? "text_audio" : "text";
}

/** Sifaarish ke liye scene ka chhota roop. */
function asSceneLike(scene: WizardScene): WizardSceneLike {
  return { type: effectiveType(scene), text: scene.text, hasImage: Boolean(scene.imageAssetId) };
}

/* -------------------------------------------------------------- draft banao */

/** AI ke script se pehla draft. */
export function draftFromScript(script: AiScript): WizardDraft {
  return {
    summary: script.summary,
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
        imageAssetId: null,
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
          suggestTransition(at, Boolean(scene.imageAssetId), Boolean(previous?.imageAssetId)),
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
    const imageSlot = imageSlotId(type);
    if (imageSlot && scene.imageAssetId) {
      const role = `image:${scene.index}`;
      slots[imageSlot] = role;
      assetByRole[role] = scene.imageAssetId;
    } else if (imageSlot) {
      delete slots[imageSlot];
    }

    const audioSlot = audioSlotId(type);
    if (audioSlot && scene.voiceAssetId) {
      const role = `voice:${scene.index}`;
      slots[audioSlot] = role;
      assetByRole[role] = scene.voiceAssetId;
    } else if (audioSlot) {
      delete slots[audioSlot];
    }

    return {
      type,
      name: scene.name,
      durationSeconds: scene.durationSeconds,
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

    if (source.animationPresetId) {
      doc = applyAnimationPreset(doc, {
        itemIds: [primary.id],
        presetId: source.animationPresetId,
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
    withImage: live.filter((scene) => scene.imageAssetId).length,
    withVoice: live.filter((scene) => scene.voiceAssetId).length,
    staleVoice: live.filter(voiceStale).length,
    needsChoice: live.filter(
      (scene) => scene.transitionId === null || (scene.imageAssetId && !scene.animationPresetId),
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
