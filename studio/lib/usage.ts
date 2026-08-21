import { restJson } from "@/lib/supabase";

/**
 * Reel Studio ka istemaal `service_usage` me likho (21.11).
 *
 * ⚠️ **Nayi table nahi banayi, aur ye soch kar hai.** `service_usage`
 * (`supabase/service-usage.sql`) pehle se theek yahi kaam karti hai — service,
 * kind, units, meta, ok, waqt. Ek aur table banane ka matlab hota: ek aur
 * migration, ek aur index, aur do jagah "kitna kharcha hua" ka jawab — jo ek
 * din alag-alag ho jaate.
 *
 * ⚠️ `service` **"reel-studio"** hai, `"gemini"` nahi — aur ye farak zaroori
 * hai. Admin ka `spend` menu poore product ka bill dikhata hai; agar Reel Studio
 * ki calls bhi `gemini` me chali jaatin to wo bill me ghul-mil jaatin aur "reel
 * banane me kitna laga" ka jawab kabhi alag se milta hi nahi.
 *
 * ⚠️ Ye function **kabhi throw nahi karta**. Usage likhna ek nishaan hai, kaam
 * nahi. Uske fail hone par user ki bani hui awaaz ya scenes gira dena bilkul
 * ulta jawab hoga — kaam ho chuka hota hai, sirf uska hisaab nahi likha gaya.
 */

export type ReelUsageKind = "scenes" | "tts";

export interface RecordUsageInput {
  kind: ReelUsageKind;
  /** AI par tokens, TTS par bole gaye akshar. 0 bhi theek hai (cache se aaya). */
  units: number;
  ok: boolean;
  meta?: Record<string, unknown>;
}

export async function recordReelUsage(input: RecordUsageInput): Promise<void> {
  try {
    await restJson("service_usage", {
      method: "POST",
      body: {
        service: "reel-studio",
        kind: input.kind,
        units: Math.max(0, Math.round(input.units)),
        ok: input.ok,
        meta: input.meta ?? {},
      },
    });
  } catch {
    // Jaan-boojhkar chup. Upar wala ⚠️ dekho.
  }
}
