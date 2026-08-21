import type { Doc, Item } from "../schema/project";
import { normalizeTtsText } from "./cacheKey";

/**
 * Batch generate — "kis-kis par kaam baaki hai?" (22.12)
 *
 * Poora batch isi ek list par khada hai, aur list ka galat hona **do tarah se**
 * mehnga hai, isliye dono shartein yahan ek jagah likhi hain:
 *
 *  - **List badi ho jaaye** → wo awaazein dobara banti hain jo pehle se theek
 *    hain. Cache bahut kuch bacha leta hai, par jo text badla hi nahi uske liye
 *    call bhejna hi bekaar hai.
 *  - **List chhoti ho jaaye** → user "sab bana do" dabata hai, kuch scene chup
 *    reh jaate hain, aur ye baat **export ke baad** pata chalti hai. Ye zyada
 *    bura hai: nuksaan der se dikhta hai.
 */

export interface PendingVoice {
  itemId: string;
  /** Jo bolna hai — normalize kiya hua (wahi jo cache key me jaata hai). */
  text: string;
  categoryId: string;
  providerId: string;
  rate: number;
  pitch: number;
}

/**
 * Kis item ki voice abhi banni baaki hai?
 *
 * Teen shartein, teeno zaroori:
 *  1. Us item par voice ka form khula ho (`audio.source` null na ho) aur mode
 *     `generate` ya `both` ho — `upload` me generate ka matlab hi nahi.
 *  2. Text me kuch ho. Khaali text par awaaz banti hi nahi (`ttsCacheKey` bhi
 *     usi par error deta hai), isliye use list me daalna sirf ek nakaam call hai.
 *  3. Ya to koi voice bani hi na ho, **ya** jo bani ho wo purane text ki ho —
 *     wahi "voice purani hai" wali haalat (22.10). Text badalne ke baad purani
 *     awaaz chup-chaap chalti rehti hai, aur batch ka sabse bada faayda yahi hai
 *     ki wo un sab ko ek saath pakad leta hai.
 */
export function itemsNeedingVoice(doc: Doc): PendingVoice[] {
  const out: PendingVoice[] = [];

  for (const item of doc.items as readonly Item[]) {
    const source = item.audio?.source;
    if (!source) continue;
    if (source.mode !== "generate" && source.mode !== "both") continue;

    const text = normalizeTtsText(source.text ?? "");
    if (!text) continue;

    const hasVoice = Boolean(source.generatedAssetId);
    const stale = normalizeTtsText(source.generatedFromText ?? "") !== text;
    if (hasVoice && !stale) continue;

    out.push({
      itemId: item.id,
      text,
      categoryId: source.categoryId || "male",
      providerId: source.providerId || "",
      rate: source.rate ?? 1,
      pitch: source.pitch ?? 0,
    });
  }

  return out;
}
