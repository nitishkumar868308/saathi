import { requireSizePreset } from "../config/presets";
import { listSceneTypes, requireSceneType } from "../registry/sceneTypes";
import { createEmptyProject } from "../schema/factory";
import type { Doc } from "../schema/project";
import { addScene } from "../timeline/ops";
import { durationFromSeconds } from "../time";
import { slotReference, validateTemplate, type Template, type TemplateSlot } from "./schema";

/**
 * Template se ek **poora editable doc** banao (17.3 / 17.4).
 *
 * ⚠️ Yahan koi layout ka ganit nahi hai, aur ye jaan-boojhkar hai. Har scene
 * `addScene` op se banta hai — wahi op jo user ke "scene jodo" button se chalta
 * hai. Isliye template se bani reel me wahi items hote hain jo user khud bana
 * sakta tha, aur unpar har op waise ka waisa chalta hai.
 *
 * **17.4 (aspect adapt) ka jawab bhi yahi hai.** Template me koi pixel nahi
 * hota; `SCENE_TYPES.build()` sab kuch frame ke percent me banata hai. Isliye
 * 9:16 ka template 1:1 par lagane par layout apne aap sahi baithta hai — uske
 * liye koi alag "re-fit" wala code likhna hi nahi pada. Agar kabhi likhna pade,
 * wo iska matlab hoga ki kisi scene type me pixel ghus gaya hai.
 */

export interface ApplyTemplateInput {
  template: Template;
  /** Wizard se aayi values — `{ rahulLine: "Papa, dekho", photo: "as_123" }`. */
  slots: Record<string, string>;
  /** Kis size ka project banana hai. Template ka `targetPreset` sirf sujhaav hai. */
  presetId?: string;
  fps?: number;
  name?: string;
}

export interface ApplyTemplateResult {
  doc: Doc;
  /** Jo zaroori slots khaali reh gaye — UI unhe badge me dikhata hai. */
  missing: TemplateSlot[];
  /** Jo scenes ban hi nahi paaye (aur kyun). */
  skipped: { index: number; type: string; reason: string }[];
}

/**
 * Khaali chhoot gaye slots ke liye jagah-rakhne wali value.
 *
 * ⚠️ Chupchaap khaali chhod dena sabse bura hota (17.3): scene ban hi nahi paata
 * ya khaali dikhta hai, aur user ko lagta hai template hi toota hua hai. Ek saaf
 * likhi hui line dikhna kahin behtar hai — wo turant batati hai ki kya karna hai.
 */
function placeholderFor(slot: TemplateSlot): string | null {
  if (slot.kind === "text") return `[${slot.label} yahan daalo]`;
  if (slot.kind === "color") return "brand.primary";
  // Asset ke liye koi placeholder nahi ban sakta — asset id banaya nahi ja
  // sakta. Aisa scene chhod diya jaata hai aur uski wajah `skipped` me jaati hai.
  return null;
}

export function applyTemplate(input: ApplyTemplateInput): ApplyTemplateResult {
  const { template } = input;

  const problems = validateTemplate(
    template,
    listSceneTypes().map((entry) => entry.id),
  );
  if (problems.length > 0) {
    throw new Error(`Template "${template.id}" me galtiyan hain:\n- ${problems.join("\n- ")}`);
  }

  const presetId = input.presetId ?? template.targetPreset;
  const preset = requireSizePreset(presetId);

  let doc = createEmptyProject({
    name: input.name ?? template.name,
    presetId: preset.id,
    ...(input.fps === undefined ? {} : { fps: input.fps }),
  });
  doc = { ...doc, meta: { ...doc.meta, createdBy: "template" } };

  const byKey = new Map(template.slots.map((slot) => [slot.key, slot]));
  const missing: TemplateSlot[] = [];
  const skipped: ApplyTemplateResult["skipped"] = [];

  template.scenes.forEach((scene, index) => {
    const entry = requireSceneType(scene.type);
    const values: Record<string, unknown> = {};
    let blocked: string | null = null;

    for (const [key, raw] of Object.entries(scene.slots)) {
      const reference = slotReference(raw);
      if (!reference) {
        // Fixed value — template ne khud likhi hai.
        values[key] = raw;
        continue;
      }

      const filled = input.slots[reference];
      if (filled !== undefined && filled !== "") {
        values[key] = filled;
        continue;
      }

      const definition = byKey.get(reference);
      if (definition && !missing.some((slot) => slot.key === definition.key)) {
        missing.push(definition);
      }

      const placeholder = definition ? placeholderFor(definition) : null;
      if (placeholder !== null) {
        values[key] = placeholder;
        continue;
      }

      /*
       * Zaroori asset nahi mila — scene ban hi nahi sakta.
       *
       * Optional slot ho to use chhod dena sahi hai (scene bina uske bhi banta
       * hai); zaroori ho to poora scene chhodna padta hai, aur uski wajah
       * lautani padti hai taaki UI use dikha sake.
       */
      const sceneSlot = entry.slots.find((item) => item.id === key);
      if (sceneSlot?.required !== false) {
        blocked = definition?.label ?? reference;
      }
    }

    if (blocked) {
      skipped.push({ index, type: scene.type, reason: `"${blocked}" bhare bina ye scene nahi banta` });
      return;
    }

    doc = addScene(doc, {
      typeId: scene.type,
      slots: values,
      ...(scene.name ? { name: scene.name } : {}),
      ...(scene.durationSeconds === null
        ? {}
        : { durationInFrames: durationFromSeconds(scene.durationSeconds, doc.project.fps) }),
    });
  });

  return { doc, missing, skipped };
}

/**
 * Ek maujooda project se template banao (17.5).
 *
 * ⚠️ Sirf wo scenes aate hain jinke paas `type` aur `slots` hain — yaani jo
 * scene-type se bane the. Haath se banaye gaye items ka koi template nahi ban
 * sakta, aur unhe chupchaap chhod dena galat hoga: caller ko `dropped` me pata
 * chalta hai ki kya nahi aaya.
 *
 * `assetSlots: true` par har asset ek **slot** ban jaata hai (yaani template
 * dobara istemaal karne layak); `false` par asset ids waise ke waise rehte hain
 * (yaani ek "mera apna preset" jaisa template).
 */
export function templateFromDoc(
  doc: Doc,
  options: { id: string; name: string; description?: string; assetSlots?: boolean },
): { template: Template; dropped: number } {
  const assetSlots = options.assetSlots !== false;
  const slots: TemplateSlot[] = [];
  const scenes: Template["scenes"] = [];
  let dropped = 0;

  const ordered = [...doc.scenes].sort((a, b) => a.order - b.order);

  for (const scene of ordered) {
    const entry = listSceneTypes().find((item) => item.id === scene.type);
    if (!entry || scene.type === "custom") {
      dropped += 1;
      continue;
    }

    const mapped: Record<string, string> = {};
    for (const definition of entry.slots) {
      const value = scene.slots[definition.id];
      if (typeof value !== "string" || value === "") continue;

      const isAsset = definition.kind.startsWith("asset:");
      if (isAsset && !assetSlots) {
        mapped[definition.id] = value;
        continue;
      }

      // Har scene ka apna slot key — do scenes ke "text" ek doosre ko na mitaayein.
      const key = `${scene.type}_${scenes.length + 1}_${definition.id}`;
      slots.push({
        key,
        label: `${scene.name}: ${definition.label}`,
        kind: isAsset ? (definition.kind.slice("asset:".length) as TemplateSlot["kind"]) : "text",
        required: definition.required,
        hint: definition.hint ?? "",
        multiline: definition.multiline ?? false,
        defaultValue: isAsset ? null : value,
      });
      mapped[definition.id] = `@${key}`;
    }

    const itemIds = new Set(scene.itemIds);
    const items = doc.items.filter((item) => itemIds.has(item.id));
    const frames = items.length > 0 ? Math.max(...items.map((item) => item.durationInFrames)) : null;

    scenes.push({
      type: scene.type,
      name: scene.name,
      durationSeconds: frames === null ? null : Math.round((frames / doc.project.fps) * 100) / 100,
      slots: mapped,
    });
  }

  return {
    template: {
      id: options.id,
      name: options.name,
      description: options.description ?? "",
      thumbnail: null,
      targetPreset: doc.project.sizePresetId,
      slots,
      scenes,
    },
    dropped,
  };
}
