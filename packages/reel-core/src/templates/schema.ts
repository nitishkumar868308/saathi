import { z } from "zod";

/**
 * Template ka format (17.1 / 17.2) — **sirf data**.
 *
 * ⚠️ Template me koi code nahi hota, aur ye is poore phase ka sabse zaroori
 * niyam hai. Template ek list hai: kaun se scene, kis kram me, aur unke slots me
 * kya jaata hai. Ban'ne ka kaam `SCENE_TYPES.build()` karta hai — wahi jo haath
 * se scene jodne par chalta hai.
 *
 * Iska seedha nateeja ye hai ki template se bani reel **poori tarah editable**
 * hoti hai: usme wahi items hote hain jo user khud bana sakta tha. Template ko
 * ek pehle se bani (flattened) video ya kisi khaas renderer par chhodne se wo
 * "template wali reel" ban jaati, jise user chhoo bhi nahi sakta — aur wahi
 * cheez har template wale tool ko bekaar banati hai.
 */

/**
 * Slot ka kism.
 *
 * Ye `SlotKind` (sceneTypes.ts) se milte-julte hain par ek jaise nahi: scene ke
 * slot me `asset:image` hota hai, template ke slot me `image`. Wajah ye hai ki
 * template ka slot **user se** poochha jaata hai (wizard me), aur wahan "asset:"
 * likha dikhana bekaar hai.
 */
export const TEMPLATE_SLOT_KINDS = ["image", "video", "audio", "text", "color"] as const;
export type TemplateSlotKind = (typeof TEMPLATE_SLOT_KINDS)[number];

export const TemplateSlotSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(TEMPLATE_SLOT_KINDS),
  required: z.boolean().default(true),
  hint: z.string().default(""),
  /** Text slot ke liye — kai lineon ka khaana chahiye? */
  multiline: z.boolean().default(false),
  /** Wizard khaali na dikhe — text/color slots ke liye ek shuruaati value. */
  defaultValue: z.string().nullable().default(null),
});

/**
 * Template ka ek scene.
 *
 * `slots` me do tarah ki value aati hai:
 *  - `"@slotKey"` — user se poochho (wizard wala slot)
 *  - baaki kuch bhi — waisa ka waisa (fixed text, brand token, asset id)
 *
 * `@` wala tarika isliye chuna gaya ki wo **JSON me saaf dikhta hai**. Ek alag
 * `{ from: "slot", key: "..." }` object banane par template padhna mushkil ho
 * jaata aur AI se template likhwana usse bhi mushkil.
 */
export const TemplateSceneSchema = z.object({
  /** SCENE_TYPES registry ka id. */
  type: z.string().min(1),
  name: z.string().default(""),
  durationSeconds: z.number().positive().nullable().default(null),
  slots: z.record(z.string()).default({}),
});

export const TemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  /** Asset id ya URL — gallery me dikhane ke liye. `null` = abhi nahi bana. */
  thumbnail: z.string().nullable().default(null),
  /**
   * Kis size ke liye banaya gaya tha.
   *
   * ⚠️ Ye ek **hadd nahi**, sirf ek jaankari hai. Template kisi bhi size par
   * lagta hai; layout `SCENE_TYPES.build()` se banta hai jo sab kuch percent me
   * rakhta hai. Isko hadd bana dena 17.4 ka poora ulta hota.
   */
  targetPreset: z.string().default("reel"),
  slots: z.array(TemplateSlotSchema).default([]),
  scenes: z.array(TemplateSceneSchema).min(1),
});

export type TemplateSlot = z.infer<typeof TemplateSlotSchema>;
export type TemplateScene = z.infer<typeof TemplateSceneSchema>;
export type Template = z.infer<typeof TemplateSchema>;

export function parseTemplate(value: unknown): Template {
  return TemplateSchema.parse(value);
}

export function safeParseTemplate(value: unknown): z.SafeParseReturnType<unknown, Template> {
  return TemplateSchema.safeParse(value);
}

/** `"@image"` -> `"image"`, warna `null`. */
export function slotReference(value: string): string | null {
  return value.startsWith("@") && value.length > 1 ? value.slice(1) : null;
}

/**
 * Template ke andar ki galtiyan — apply karne se **pehle**.
 *
 * ⚠️ Ye zaroori hai kyunki template DB se aata hai (aur aage AI se bhi). Ek
 * galat template chup-chaap apply ho jaaye to nateeja ek aadha-adhoora project
 * hota hai jise user ne banaya hi nahi — aur usme galti dhoondhna namumkin hai.
 */
export function validateTemplate(
  template: Template,
  knownSceneTypes: readonly string[],
): string[] {
  const problems: string[] = [];
  const slotKeys = new Set(template.slots.map((slot) => slot.key));

  const seen = new Set<string>();
  for (const slot of template.slots) {
    if (seen.has(slot.key)) problems.push(`Slot "${slot.key}" do baar hai`);
    seen.add(slot.key);
  }

  template.scenes.forEach((scene, index) => {
    if (!knownSceneTypes.includes(scene.type)) {
      problems.push(`Scene ${index + 1}: "${scene.type}" naam ka koi scene type nahi hai`);
    }
    for (const [key, value] of Object.entries(scene.slots)) {
      const reference = slotReference(value);
      if (reference && !slotKeys.has(reference)) {
        problems.push(`Scene ${index + 1} ka "${key}" ek aise slot ko point karta hai jo hai hi nahi: @${reference}`);
      }
    }
  });

  // Ulta bhi dekho: jis slot ko koi scene use hi nahi karta, wo wizard me user
  // se poochha jaayega aur uska kuch nahi hoga. Wo ek jhooth hai.
  const used = new Set<string>();
  for (const scene of template.scenes) {
    for (const value of Object.values(scene.slots)) {
      const reference = slotReference(value);
      if (reference) used.add(reference);
    }
  }
  for (const slot of template.slots) {
    if (!used.has(slot.key)) {
      problems.push(`Slot "${slot.key}" ko koi scene use nahi karta — wizard me use poochhna bekaar hai`);
    }
  }

  return problems;
}
