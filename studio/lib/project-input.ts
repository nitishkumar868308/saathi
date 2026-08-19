import {
  CUSTOM_SIZE_PRESET_ID,
  DEFAULT_FPS,
  DEFAULT_PROJECT_DURATION_SECONDS,
  DEFAULT_SIZE_PRESET_ID,
  FPS_CHOICES,
  MAX_DIMENSION,
  MIN_DIMENSION,
  SIZE_PRESETS,
  isValidDimension,
} from "@reel/core";
import { z } from "zod";

/**
 * "Naya project" form ka contract — ek jagah, dono taraf.
 *
 * Wahi schema form bhi use karta hai aur API route bhi. Do jagah rules likhne se
 * hamesha wahi hota hai: UI kuch aur maanta hai, server kuch aur, aur beech me
 * user ko "invalid" dikhta hai bina wajah bataye.
 *
 * ⚠️ Choices **config se** aa rahi hain (`SIZE_PRESETS`, `FPS_CHOICES`) — yahan
 * na koi preset likha hai, na 1080/1920/30 (README Dynamic rule 4). Nayi size
 * add karni ho to `packages/reel-core/src/config/presets.ts` me ek entry, bas.
 */

const PRESET_IDS = SIZE_PRESETS.map((preset) => preset.id) as [string, ...string[]];

export const NewProjectInputSchema = z
  .object({
    name: z.string().trim().min(1, "naam chahiye").max(120).optional(),
    presetId: z.enum(PRESET_IDS).default(DEFAULT_SIZE_PRESET_ID),
    width: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION).optional(),
    height: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION).optional(),
    fps: z
      .number()
      .int()
      .refine((value) => FPS_CHOICES.includes(value), {
        message: `fps in me se ek ho: ${FPS_CHOICES.join(", ")}`,
      })
      .default(DEFAULT_FPS),
    durationInSeconds: z
      .number()
      .positive()
      .max(60 * 60)
      .default(DEFAULT_PROJECT_DURATION_SECONDS),
  })
  .superRefine((input, ctx) => {
    if (input.presetId !== CUSTOM_SIZE_PRESET_ID) return;

    for (const side of ["width", "height"] as const) {
      const value = input[side];
      if (value === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [side],
          message: `custom size ke liye ${side} chahiye`,
        });
        continue;
      }
      if (!isValidDimension(value)) {
        // yuv420p ka chroma plane aadha hota hai — visham size par encoder rota hai.
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [side],
          message: `${side} even hona chahiye (${MIN_DIMENSION}-${MAX_DIMENSION})`,
        });
      }
    }
  });

export type NewProjectInput = z.infer<typeof NewProjectInputSchema>;

export const RenameProjectSchema = z.object({
  name: z.string().trim().min(1, "naam khaali nahi ho sakta").max(120),
});
