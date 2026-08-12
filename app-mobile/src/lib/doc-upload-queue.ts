import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { uploadDocument } from "./storage";
import { reportError } from "./report-error";
import type { Document } from "./documents";

/**
 * Jo document abhi tak R2 par nahi pahuncha, uski kataar.
 *
 * ── Ye kyun bana ───────────────────────────────────────────────────────────
 *
 * ⚠️ Pehle upload ek hi baar hota tha, aur wo bhi aise:
 *
 *     if (savedUri) uploadDocumentImage(doc.id, savedUri).catch(() => {});
 *
 * Yaani: chalao, aur fail ho jaye to CHUP-CHAAP bhool jao. Koi retry nahi, koi
 * khabar nahi, kahin koi nishaan nahi.
 *
 * Aur wo fail hona koi virli baat nahi thi — document banta hi tab hai jab wo
 * saamne hota hai: bank ke bahar, RTO ke bahar, hospital me. Wahin signal sabse
 * kharab hota hai. Ek bhi baar fail hone ka matlab tha ki wo document HAMESHA ke
 * liye sirf us ek phone par reh gaya:
 *
 *   • Phone kho jaye / toot jaye → document gaya. Backup ka poora waada tha hi
 *     yahi, aur wahi chup-chaap toota hua tha.
 *   • Doosre phone par login karo → wo document dikhta to hai, khulta nahi.
 *   • Admin panel me wo "Sirf device" pada rehta tha — jo asal me "hum ise kho
 *     chuke hain" ka doosra naam hai.
 *
 * Ab har upload kataar me jaata hai aur tab tak kataar me rehta hai jab tak
 * kaamyaab na ho — bilkul `reminder-outbox` ki tarah. Flush app khulne par, net
 * wapas aane par, aur har baar list padhne par chalta hai.
 */

const KEY = "saathi-doc-upload-queue";

/**
 * Itni koshishon ke baad haar maan lete hain.
 *
 * ⚠️ Ye zaroori hai. Kuch fail hamesha fail hi rahenge — file phone se hi mit
 * gayi ho, ya document server par delete ho chuka ho. Bina chhat ke wo entry
 * hamesha kataar me padi rehti aur har flush par ek bekaar network call karti,
 * jo battery aur data dono khaata hai.
 *
 * 25 jaan-boojh ke bada hai: flush din me kai baar chalta hai, isliye 25 koshish
 * asal me kai dinon me phailti hain — aur asli dikkat (net na hona) tab tak
 * hazaar baar theek ho chuki hoti hai.
 */
const MAX_TRIES = 25;

export type PendingUpload = {
  docId: string;
  uri: string;
  mime: string;
  tries: number;
  /** Pehli baar kab kataar me aaya. */
  at: number;
};

async function read(): Promise<PendingUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PendingUpload[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function write(list: PendingUpload[]): Promise<void> {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage bhar gaya — agli baar */
  }
}

/**
 * Is document ki file ko kataar me daalo.
 *
 * Ek hi document do baar kataar me nahi aata: doosri entry pehli ko badal deti
 * hai (user ne photo dobara li ho sakti hai, aur nayi hi sach hai).
 */
export async function queueUpload(docId: string, uri: string, mime: string): Promise<void> {
  const list = await read();
  const rest = list.filter((x) => x.docId !== docId);
  rest.push({ docId, uri, mime, tries: 0, at: Date.now() });
  await write(rest);
}

export async function pendingUploadCount(): Promise<number> {
  return (await read()).length;
}

/** Kataar me hai kya — Documents screen "backup baaki hai" isse dikhati hai. */
export async function isUploadPending(docId: string): Promise<boolean> {
  return (await read()).some((x) => x.docId === docId);
}

let flushing = false;

/**
 * Kataar khaali karo.
 *
 * ⚠️ Ek waqt me ek hi flush. Do saath chalne par dono ek hi file do baar upload
 * karte hain — R2 par wo bharpai ho jaata hai (same key) par network aur waqt
 * dono do guna lagta hai, aur dheeme connection par yahi upload ko poori tarah
 * atka deta hai.
 */
export async function flushUploads(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const list = await read();
    if (list.length === 0) return;

    const left: PendingUpload[] = [];
    for (const item of list) {
      /**
       * File abhi phone par hai bhi?
       *
       * ⚠️ Ye check zaroori hai. Android app ka cache kabhi bhi saaf kar sakta
       * hai, aur user khud bhi file hata sakta hai. Bina iske hum ek na maujood
       * file par baar-baar upload chalate rehte aur har baar network par jaate —
       * 25 baar, bina kisi ummeed ke.
       */
      let exists = true;
      try {
        exists = (await FileSystem.getInfoAsync(item.uri)).exists;
      } catch {
        exists = true; // pata na chale to koshish karna hi behtar hai
      }
      if (!exists) continue; // chhod do — file hi nahi bachi

      try {
        await uploadDocument(item.docId, item.uri, item.mime);
        // Kaamyab — kataar se bahar (server khud `file_path`/`file_size` bhar
        // chuka hai, yahan DB ko chhoone ki zaroorat nahi).
      } catch (e) {
        const tries = item.tries + 1;
        if (tries >= MAX_TRIES) {
          // Ab bhi nahi chala — ab chup rehna galat hai. Admin > Logs me dikhe,
          // warna "document backup nahi hua" ka pata kabhi kisi ko nahi chalega.
          reportError(e, { screen: "doc-upload-queue", action: "give_up", docId: item.docId }, "warn");
          continue;
        }
        left.push({ ...item, tries });
        /**
         * ⚠️ Net na ho to baaki entries par koshish karne ka koi matlab nahi —
         * wo sab bhi wahin girengi aur har ek apni ek koshish ganwa degi. Ek
         * fail ke baad ruk jaate hain; baaki jaisi hain waisi rehti hain.
         */
        const idx = list.indexOf(item);
        left.push(...list.slice(idx + 1));
        break;
      }
    }
    await write(left);
  } finally {
    flushing = false;
  }
}

/**
 * Purane, chhoot chuke documents ko kataar me le aao.
 *
 * ⚠️ Ye "self-healing" wala hissa hai, aur iske bina naya code sirf AAGE ke
 * documents bachata. Jo document pehle hi fail ho chuke hain (admin me "Sirf
 * device" wale) wo hamesha waise hi pade rehte — aur wahi to asli shikayat hai.
 *
 * Shart soch ke lagai hai: local file ho (`file_uri`) par cloud path na ho
 * (`file_path`). Bilkul wahi soorat jo ek chhoote hue upload ke baad banti hai.
 */
export async function requeueMissingUploads(docs: Document[]): Promise<void> {
  const missing = docs.filter((d) => d.file_uri && !d.file_path);
  if (missing.length === 0) return;

  const list = await read();
  const known = new Set(list.map((x) => x.docId));
  let added = false;
  for (const d of missing) {
    if (known.has(d.id)) continue;
    list.push({
      docId: d.id,
      uri: d.file_uri as string,
      mime: d.mime_type || mimeFromUri(d.file_uri as string),
      tries: 0,
      at: Date.now(),
    });
    added = true;
  }
  if (added) await write(list);
}

/** Local file ke naam se uska type — `documents.ts` wali hi soch. */
function mimeFromUri(uri: string): string {
  const ext = (uri.split("?")[0].split(".").pop() ?? "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg";
}
