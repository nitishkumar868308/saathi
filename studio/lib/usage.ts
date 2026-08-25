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


/* ------------------------------------------------------------ roz ki hadd */

/**
 * Aaj is kism ki kitni **asli** call ja chuki (26.27).
 *
 * ⚠️ Ye feature nahi hai, brake hai. Ek din me ₹407 ka bill isliye ban gaya ki
 * kharche ki koi upar wali hadd thi hi nahi — provider ki apni limit hi ek
 * matra rok thi, aur wo hadd paise se nahi, calls ki ginti se lagti hai. Jab
 * tak koi bill dekhne na jaaye, tab tak kuch galat hone ka **koi nishaan nahi**
 * hota: sab kuch theek chalta dikhta hai.
 *
 * ⚠️ Cache wali call (`units: 0`) ginti me nahi aati, aur yehi is function ki
 * jaan hai. Wo provider tak jaati hi nahi, isliye uska paisa lagta hi nahi —
 * use ginne par hadd wahan lag jaati jahan kharcha shuru hi nahi hua tha.
 *
 * ⚠️ Nakaam call (`ok: false`) ginti me **aati hai**. Ye jaan-boojhkar hai: 429
 * aur 5xx bhi provider tak pahunche the. Sirf kaamyab call ginne par ek toota
 * hua din (jahan har call fail ho rahi hai) bina rukavat ke chalta rehta.
 *
 * ⚠️ Ginti fail ho jaaye to `null` — aur bulane wala tab **rokta nahi**. Ye soch
 * kar hai: hisaab ka na milna kaam rokne ki wajah nahi hai. Ulta karna (na pata
 * ho to rok do) ek Supabase hichki ko poore studio ka band hona bana deta.
 */
export async function countReelCallsToday(kind: ReelUsageKind): Promise<number | null> {
  /*
   * ⚠️ Din **Pacific** ka hai, UTC ya local ka nahi — aur ye ek asli farak hai.
   *
   * Google ka apna per-day counter (RPD) Pacific ki aadhi raat par reset hota
   * hai. Pehle yahan UTC ki aadhi raat thi, yaani humari ginti Google se **7
   * ghante pehle** zero ho jaati thi. Us khidki me humara counter kehta "aaj to
   * abhi 3 hi call hui" jabki Google ka counter 100 par bhara baitha hota —
   * yaani brake wahan nahi lagta jahan asli hadd lagni thi, aur aadmi ko wahi
   * 429 milta jiska matlab uske liye kuch nahi hota.
   *
   * ⚠️ -8/-7 ka jhagda jaan-boojhkar nahi paala. PDT (-7) maana gaya hai, jo
   * saal ke zyada hisse me sahi hai; sardi me ye ginti ek ghante ki khidki par
   * thodi jaldi khulegi. Us ek ghante ke liye poora timezone package laana is
   * kaam se bada bojh hai — ye ek brake hai, koi hisaab-kitaab nahi.
   */
  const PACIFIC_OFFSET_HOURS = -7;
  const now = Date.now();
  const pacific = new Date(now + PACIFIC_OFFSET_HOURS * 60 * 60 * 1000);
  pacific.setUTCHours(0, 0, 0, 0);
  const since = new Date(pacific.getTime() - PACIFIC_OFFSET_HOURS * 60 * 60 * 1000);

  try {
    /*
     * ⚠️ Chhaanni `or=(units.gt.0,ok.is.false)` hai, sirf `units.gt.0` nahi.
     * Dono halat me provider tak call ja chuki hoti hai:
     *   • `units > 0`  — awaaz bani, akshar gine gaye
     *   • `ok = false` — call gayi aur fail hui (429/5xx), jiske `units` 0 hote
     *     hain par paisa aur quota dono lag chuke hote hain
     * Sirf pehli shart lagane par ek aisa din jisme har call fail ho rahi hai,
     * hadd ko chhoo hi nahi paata — yaani jab brake sabse zyada chahiye, tab wo
     * lagta hi nahi. Cache hit (`units 0` + `ok true`) dono se bahar reh jaata
     * hai, jo theek hai: wo provider tak jaata hi nahi.
     */
    const rows = await restJson<{ id: string }>(
      `service_usage?service=eq.reel-studio&kind=eq.${kind}` +
        `&or=(units.gt.0,ok.is.false)` +
        `&created_at=gte.${encodeURIComponent(since.toISOString())}&select=id`,
    );
    return rows.length;
  } catch {
    return null;
  }
}

/**
 * Roz ki hadd — env se, aur default jaan-boojhkar kam.
 *
 * ⚠️ Default 60/30 hai, "jitni provider de de" nahi. Ek hadd jo aam din chhooti
 * hi nahi, wo hadd nahi hoti — wo sirf ek number hai jo ek din bahut mehnga
 * nikalta hai. Jise zyada chahiye wo env me badal le; wo ek soch-samajh kar
 * liya gaya faisla hoga, chup-chaap laga hua default nahi.
 */
export function dailyLimitFor(kind: ReelUsageKind): number {
  const raw = kind === "tts" ? process.env.REEL_TTS_DAILY_LIMIT : process.env.REEL_AI_DAILY_LIMIT;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  return kind === "tts" ? 60 : 30;
}

/**
 * Hadd par pahunch gaye? `null` = raasta khula, warna rukne ki wajah.
 *
 * Ek jagah, dono routes ke liye — warna do jagah do alag ginti hoti aur ek din
 * unme se ek jagah hadd lagni band ho jaati.
 */
export async function overDailyLimit(kind: ReelUsageKind): Promise<string | null> {
  const limit = dailyLimitFor(kind);
  if (limit === 0) return null;

  const used = await countReelCallsToday(kind);
  if (used === null || used < limit) return null;

  const what = kind === "tts" ? "awaaz" : "AI se scene";
  const envName = kind === "tts" ? "REEL_TTS_DAILY_LIMIT" : "REEL_AI_DAILY_LIMIT";
  return (
    `Aaj ki hadd poori ho gayi — ${used}/${limit} ${what} ban chuki hain. ` +
    `Ye hadd tumne khud lagayi hai taaki bill chup-chaap na badhe; kal apne aap ` +
    `khul jaayegi. Aaj hi aur chahiye to ${envName} badhao.`
  );
}
