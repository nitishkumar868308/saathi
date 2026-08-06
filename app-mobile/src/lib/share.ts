import * as Sharing from "expo-sharing";

import { withoutLock } from "./app-lock";
import { resolveDocUri, type DocFile } from "./doc-cache";

/**
 * Document share karna.
 *
 * ⚠️ Yahan pehle apna alag resolve-logic tha: local `file_uri` dekho, na mile to
 * signed URL se cache directory me download karo. Wo do wajah se galat tha —
 * (1) `cacheDirectory` OS kabhi bhi khaali kar deta hai, isliye wahi file baar
 * baar download hoti thi, aur (2) offline me signed URL milta hi nahi, to naye
 * phone par share bilkul kaam nahi karta tha.
 *
 * Ab file dhoondhne ka poore app me ek hi raasta hai — `resolveDocUri` — jo
 * pehle offline cache dekhta hai. Isliye share ab bina internet ke bhi chalta
 * hai.
 */

/** Share ke liye document ka minimum shape — file dhoondhne bhar ka, aur naam. */
export type Shareable = DocFile & { name: string };

/**
 * Ek document share karo (system share sheet). true = share sheet khul gaya.
 *
 * ⚠️ `withoutLock` zaroori hai. Share sheet khulte hi app background me chali
 * jaati hai, aur WhatsApp/Gmail chun ke wapas aane me aaram se ek minute lag
 * jaata hai. Uske bina user apna document share karke lautta tha aur app lock
 * maang leti thi — usne app chhodi hi nahi thi, app hi use bahar bhej rahi thi.
 */
export async function shareDocument(doc: Shareable): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const uri = await resolveDocUri(doc);
  if (!uri) return false;
  await withoutLock(() => Sharing.shareAsync(uri, { dialogTitle: doc.name }));
  return true;
}

/**
 * Kai documents share karo. expo-sharing ek baar me ek hi file share karta hai,
 * isliye ek-ek karke share sheet khulta hai. Kitne share hue wo count lautata hai.
 */
export async function shareDocuments(docs: Shareable[]): Promise<number> {
  if (!(await Sharing.isAvailableAsync())) return 0;
  // Poore loop ko ek hi interlude me lapeta hai — beech me app baar-baar bahar
  // jaayegi, aur har share ke beech lock lagana yahan sabse bura hoga.
  return withoutLock(async () => {
    let shared = 0;
    for (const doc of docs) {
      const uri = await resolveDocUri(doc);
      if (!uri) continue;
      await Sharing.shareAsync(uri, { dialogTitle: doc.name });
      shared++;
    }
    return shared;
  });
}
