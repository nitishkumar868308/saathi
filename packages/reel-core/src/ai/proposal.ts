import { listSceneTypes, requireSceneType } from "../registry/sceneTypes";
import type { Doc } from "../schema/project";
import { addScene, deleteScene } from "../timeline/ops";
import { durationFromSeconds } from "../time";
import type { AiScene, AiScript } from "./types";

/**
 * AI ka prastaav — **doc me seedha kuch nahi jaata** (21.9).
 *
 * ⚠️ Ye is poore phase ki sabse zaroori file hai. AI ka output ek *prastaav* hai:
 * scene-by-scene list jisme har entry ko user maan ya thukra sakta hai. Maani
 * hui entries **wahi ops** se lagti hain jo haath ke button chalate hain
 * (`addScene`), isliye:
 *
 *  - undo waise ka waisa chalta hai
 *  - AI se bani reel aur haath se bani reel me koi farak nahi hota
 *  - user ki purani editing chup-chaap nahi mit'ti
 *
 * Seedha `doc` badal dena bahut aasan hota, par uska nateeja ek aisi reel hoti
 * jise user ne kabhi manzoor hi nahi kiya — aur wo bharosa ek baar tootne par
 * dobara nahi banta.
 */

export type ProposalAction = "add" | "replace" | "keep";

export interface ProposalEntry {
  /** UI me `key` — aur accept/reject ka pata. */
  id: string;
  action: ProposalAction;
  scene: AiScene;
  /** `replace` par: kis maujooda scene ki jagah. */
  replacesSceneId?: string;
  /** Registry me ye type hai hi nahi — tab entry **apne aap reject** rehti hai. */
  problem: string | null;
}

export interface Proposal {
  summary: string;
  entries: ProposalEntry[];
}

/**
 * Script se prastaav banao.
 *
 * `mode`:
 *  - `"append"` — maujooda scenes ke aage jodo (default, sabse safe)
 *  - `"replace"` — maujooda scenes ki jagah (user ne jaan-boojhkar maanga ho)
 *
 * ⚠️ Default `"append"` hai. `"replace"` default hone par ek galti se dabaya
 * hua "Generate" poora project mita deta — aur wo galti sabse mehngi hoti hai.
 */
export function buildProposal(args: {
  doc: Doc;
  script: AiScript;
  mode?: "append" | "replace";
}): Proposal {
  const mode = args.mode ?? "append";
  const known = new Set(listSceneTypes().map((entry) => entry.id));

  const existing = [...args.doc.scenes].sort((a, b) => a.order - b.order);
  const entries: ProposalEntry[] = [];

  args.script.scenes.forEach((scene, index) => {
    /*
     * Anjaan scene type ko **chup-chaap chhodna galat** hoga: user ko lagta ki
     * AI ne kam scene banaye. Entry banti hai par uspar wajah likhi hoti hai,
     * aur wo apne aap reject rehti hai.
     */
    const problem = known.has(scene.type)
      ? null
      : `"${scene.type}" naam ka koi scene type nahi hai — ye scene nahi banega.`;

    const replaced = mode === "replace" ? existing[index] : undefined;

    entries.push({
      id: `proposal_${index}`,
      action: replaced ? "replace" : "add",
      scene,
      ...(replaced ? { replacesSceneId: replaced.id } : {}),
      problem,
    });
  });

  /*
   * `replace` mode me jo purane scene bach jaate hain unhe **chhoda nahi
   * jaata** — unki apni entry banti hai (`keep`), taaki user ko poori tasveer
   * dikhe. Bina uske wo scenes chup-chaap reel me pade rehte hain aur user ko
   * lagta hai ki AI ne unhe bhi banaya.
   */
  if (mode === "replace" && existing.length > args.script.scenes.length) {
    for (const scene of existing.slice(args.script.scenes.length)) {
      entries.push({
        id: `keep_${scene.id}`,
        action: "keep",
        scene: {
          type: scene.type,
          name: scene.name,
          durationSeconds: 0,
          slots: {},
          reason: "Ye aapka purana scene hai — AI ne ise chhua nahi.",
        },
        replacesSceneId: scene.id,
        problem: null,
      });
    }
  }

  return { summary: args.script.summary, entries };
}

export interface ApplyProposalResult {
  doc: Doc;
  /** Kitne scene bane. */
  applied: number;
  /** Jo entries chhoot gayi (reject ki hui ya galat). */
  skipped: { id: string; reason: string }[];
}

/**
 * Manzoor ki hui entries ko doc me lagao — **aam ops se** (21.7).
 *
 * ⚠️ Yahan AI ke liye koi alag raasta nahi hai. `addScene` wahi op hai jo
 * "scene jodo" button chalata hai, aur `deleteScene` wahi jo delete button.
 * Isliye AI se bani reel par har cheez waise hi chalti hai — undo, split,
 * keyframes, sab.
 *
 * Asset wale slots me AI **naam/role** deta hai, id nahi. Wo naam yahan
 * `assetByRole` se asli id me badalta hai; na mile to slot khaali chhod diya
 * jaata hai aur scene placeholder ke saath banta hai (`skipped` me wajah aati
 * hai). AI kabhi asset "bana" nahi sakta (21.8).
 */
export function applyProposal(args: {
  doc: Doc;
  proposal: Proposal;
  /** Jo entries user ne manzoor ki. */
  acceptedIds: readonly string[];
  /** `"character:rahul"` -> `"as_123"`. Jo na mile wo slot khaali rehta hai. */
  assetByRole?: Record<string, string>;
}): ApplyProposalResult {
  const accepted = new Set(args.acceptedIds);
  const roles = args.assetByRole ?? {};

  let doc = args.doc;
  let applied = 0;
  const skipped: { id: string; reason: string }[] = [];

  for (const entry of args.proposal.entries) {
    if (entry.action === "keep") continue;

    if (!accepted.has(entry.id)) {
      skipped.push({ id: entry.id, reason: "user ne manzoor nahi kiya" });
      continue;
    }
    if (entry.problem) {
      skipped.push({ id: entry.id, reason: entry.problem });
      continue;
    }

    const sceneType = requireSceneType(entry.scene.type);
    const slots: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(entry.scene.slots)) {
      const definition = sceneType.slots.find((slot) => slot.id === key);
      if (!definition) continue;

      if (definition.kind.startsWith("asset:")) {
        const assetId = roles[value];
        if (!assetId) {
          skipped.push({
            id: entry.id,
            reason: `"${value}" naam ki asset library me nahi mili — ye slot khaali rahega`,
          });
          continue;
        }
        slots[key] = assetId;
        continue;
      }
      slots[key] = value;
    }

    /*
     * Purana scene pehle hataya jaata hai, phir naya jodha — dono ek hi
     * `applyProposal` me. Ulta karne par ek pal ke liye dono scene saath rehte
     * hain aur timeline ka layout do baar hilta hai, jo aankh ko toota hua
     * lagta hai.
     */
    if (entry.action === "replace" && entry.replacesSceneId) {
      doc = deleteScene(doc, { sceneId: entry.replacesSceneId });
    }

    try {
      doc = addScene(doc, {
        typeId: entry.scene.type,
        slots,
        ...(entry.scene.name ? { name: entry.scene.name } : {}),
        durationInFrames: durationFromSeconds(entry.scene.durationSeconds, doc.project.fps),
      });
      applied += 1;
    } catch (error) {
      /*
       * `addScene` zaroori slot na hone par phat'ta hai. Use crash banane se
       * poora prastaav bekaar ho jaata — baaki scenes bhi nahi lagte. Wajah
       * likh kar aage badhna hi sahi hai.
       */
      skipped.push({
        id: entry.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { doc, applied, skipped };
}

/**
 * AI ko batao ki kaun se scene types hain — **registry se, runtime par** (21.5).
 *
 * Prompt me list likh dena aasan hai par tab naya scene type jodne par AI ko
 * uska pata hi nahi chalta, aur wo chup-chaap purane types hi use karta rehta
 * hai. Ye function har baar taazi list deta hai.
 */
export function sceneTypesForPrompt(): {
  id: string;
  label: string;
  hint: string;
  slots: { id: string; label: string; kind: string; required: boolean }[];
}[] {
  return listSceneTypes().map((entry) => ({
    id: entry.id,
    label: entry.label,
    hint: entry.hint,
    slots: entry.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      kind: slot.kind,
      required: slot.required,
    })),
  }));
}
