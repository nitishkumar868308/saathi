import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "./supabase";
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
 *     uploadDocumentImage(doc.id, savedUri).catch(() => {});
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

/**
 * Kataar ki chaabi — HAR USER KI ALAG (`saathi-doc-upload-queue:<uid>`).
 *
 * ⚠️ Pehle ek hi global chaabi thi. A ka upload atka, A ne logout kiya, B aaya —
 * aur flush A ki file B ke session se chadhane ki koshish karta (server use B
 * ka document na paa kar mana karta), 25 baar, aur phir A ka backup hamesha ke
 * liye chhod deta. Ab A ki kataar A ke agle login tak surakshit padi rehti hai.
 *
 * Purani global chaabi ek hi baar padhi jaati hai — `adoptLegacy()`.
 */
const KEY = "saathi-doc-upload-queue";
const keyFor = (uid: string) => `${KEY}:${uid}`;

/** Abhi kaun logged-in hai — local session se (bina network ke). */
async function currentUid(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

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
  /**
   * Renew ka version — R2 par file ka naam isi se banta hai.
   *
   * ⚠️ Ye kataar me RAKHNA zaroori hai, sirf call ke waqt bhejna kaafi nahi.
   * Renew net ke bina bhi hota hai (wahi to poora point hai), aur us haalat me
   * asli upload ghanton baad chalta hai. Version yahan na pada ho to wo upload
   * purane naam (`<docId>.<ext>`) par chala jaata — yaani theek wahi purani
   * photo mit jaati jise bachane ke liye ye poora intezaam hai.
   *
   * `undefined` = pehla version (naya document) — purana raasta, jaisa tha.
   */
  version?: number;
};

function parseList(raw: string | null): PendingUpload[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as PendingUpload[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Purani global kataar — update ke baad ek hi baar.
 *
 * ⚠️ Items me user id hoti hi nahi, isliye maalik pakka nahi bataya ja sakta.
 * Update ke baad pehli baar padhne wala user lagbhag hamesha wahi hota hai
 * jiske ye uploads the (update logout nahi karta), isliye wo unhe apna leta hai
 * aur global chaabi mit jaati hai — aaj ka ek-user wala vyavhaar waisa hi.
 * Promise isliye ki saath chalne wale `read()` adoption ka intezaar karein.
 */
let legacyAdopt: Promise<void> | null = null;

function adoptLegacy(uid: string): Promise<void> {
  if (!legacyAdopt) {
    legacyAdopt = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw === null) return;
        const old = parseList(raw);
        if (old.length > 0) {
          const mine = parseList(await AsyncStorage.getItem(keyFor(uid)));
          const known = new Set(mine.map((x) => x.docId));
          await AsyncStorage.setItem(
            keyFor(uid),
            JSON.stringify([...mine, ...old.filter((x) => !known.has(x.docId))]),
          );
        }
        await AsyncStorage.removeItem(KEY);
      } catch {
        legacyAdopt = null; // agli baar phir koshish
      }
    })();
  }
  return legacyAdopt;
}

async function read(uid: string): Promise<PendingUpload[]> {
  await adoptLegacy(uid);
  try {
    return parseList(await AsyncStorage.getItem(keyFor(uid)));
  } catch {
    return [];
  }
}

async function write(uid: string, list: PendingUpload[]): Promise<void> {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(keyFor(uid));
    else await AsyncStorage.setItem(keyFor(uid), JSON.stringify(list));
  } catch {
    /* storage bhar gaya — agli baar */
  }
}

/**
 * Kisi user ki kataar — logout ki safai ke liye (`clearDocCache`).
 *
 * ⚠️ Logout par offline cache ka folder poora udta tha, jabki "Phone par rakho"
 * wale document ki EK MAATR copy wahi hoti hai (`file_uri` usi par hai). Us
 * safai ko pata hona chahiye ki kaunsi file abhi cloud tak pahunchi hi nahi.
 */
export async function pendingUploadsFor(uid: string): Promise<PendingUpload[]> {
  return read(uid);
}

/**
 * Is document ki file ko kataar me daalo.
 *
 * Ek hi document do baar kataar me nahi aata: doosri entry pehli ko badal deti
 * hai (user ne photo dobara li ho sakti hai, aur nayi hi sach hai).
 */
export async function queueUpload(
  docId: string,
  uri: string,
  mime: string,
  version?: number,
): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  const list = await read(uid);
  const rest = list.filter((x) => x.docId !== docId);
  rest.push({ docId, uri, mime, tries: 0, at: Date.now(), version });
  await write(uid, rest);
}

/**
 * Is document ki entry kataar se hatao.
 *
 * ⚠️ Ye tab chahiye jab file kataar se NAHI, seedhe chadh gayi ho
 * (`uploadDocumentFile`). Entry bachi rehne par do cheezein bigadti hain, aur
 * dono chup hain:
 *
 *   • `flushUploads()` wahi file dobara chadha deta hai — bekaar ka net.
 *   • Aur zyada bura: agli baar renew par `pendingUploadVersion()` use dekh kar
 *     "pichhla renew abhi cloud tak pahuncha hi nahi" samajh leta hai, aur nayi
 *     photo USI version ke naam par bhej deta hai — yaani wo abhi-abhi chadhi
 *     hui file ko upar se daba deti hai aur history me ek version gum ho jaata
 *     hai.
 */
export async function dropPendingUpload(docId: string): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  const list = await read(uid);
  const rest = list.filter((x) => x.docId !== docId);
  if (rest.length !== list.length) await write(uid, rest);
}

/** Abhi wale user ki kataar. Logged-out = khaali. */
async function readMine(): Promise<PendingUpload[]> {
  const uid = await currentUid();
  return uid ? read(uid) : [];
}

export async function pendingUploadCount(): Promise<number> {
  return (await readMine()).length;
}

/** Kataar me hai kya — Documents screen "backup baaki hai" isse dikhati hai. */
export async function isUploadPending(docId: string): Promise<boolean> {
  return (await readMine()).some((x) => x.docId === docId);
}

/**
 * Kataar me padi file kis version ke naam par chadhne wali hai. `0` = kuch nahi.
 *
 * ⚠️ Ye `documents.file_path` ka net-ke-bina wala jawab hai, aur renew ko isi ki
 * zaroorat hai. Version number asal me `documents.file_path` se banta hai, par wo
 * column upload COMMIT hone par bharta hai — yaani net aane par. Beech me
 * (offline renew ke baad) wo column purani file par hi khada rehta hai.
 *
 * Bina iske dobara renew karne par snapshot wahi purana path dobara copy kar
 * leta tha: history me ek jaisi do entry ban jaati (dono purani photo dikhati),
 * aur `queueUpload` beech wali photo ko kataar se gira deta — wo kabhi upload
 * hoti hi nahi. Caller ise dekh kar samajh jaata hai ki pichhla renew abhi cloud
 * tak pahuncha hi nahi, aur nayi photo usi version ke naam par bhej deta hai.
 */
export async function pendingUploadVersion(docId: string): Promise<number> {
  const hit = (await readMine()).find((x) => x.docId === docId);
  return hit?.version ?? 0;
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
    // Sirf ABHI wale user ki kataar (wajah `keyFor` par).
    const uid = await currentUid();
    if (!uid) return;
    const list = await read(uid);
    if (list.length === 0) return;

    /**
     * Kya badla — aakhir me storage par sirf yahi lagega.
     *
     * Entry ki pehchaan `docId + at + uri`: beech me `queueUpload` usi document
     * ki NAYI entry (naya `at`) daal de to wo purani samajh ke na hat jaye.
     */
    const itemKey = (x: PendingUpload) => `${x.docId}|${x.at}|${x.uri}`;
    const removed = new Set<string>();
    const updated = new Map<string, PendingUpload>();
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
      if (!exists) {
        removed.add(itemKey(item)); // chhod do — file hi nahi bachi
        continue;
      }

      try {
        await uploadDocument(item.docId, item.uri, item.mime, item.version);
        // Kaamyab — kataar se bahar (server khud `file_path`/`file_size` bhar
        // chuka hai, yahan DB ko chhoone ki zaroorat nahi).
        removed.add(itemKey(item));
      } catch (e) {
        const tries = item.tries + 1;
        if (tries >= MAX_TRIES) {
          // Ab bhi nahi chala — ab chup rehna galat hai. Admin > Logs me dikhe,
          // warna "document backup nahi hua" ka pata kabhi kisi ko nahi chalega.
          reportError(e, { screen: "doc-upload-queue", action: "give_up", docId: item.docId }, "warn");
          removed.add(itemKey(item));
          continue;
        }
        updated.set(itemKey(item), { ...item, tries });
        /**
         * ⚠️ Net na ho to baaki entries par koshish karne ka koi matlab nahi —
         * wo sab bhi wahin girengi aur har ek apni ek koshish ganwa degi. Ek
         * fail ke baad ruk jaate hain; baaki jaisi hain waisi rehti hain.
         */
        break;
      }
    }

    /**
     * ⚠️ Storage DOBARA padho aur sirf apne badlaav lagao — shuru wali list
     * (`left`) seedha mat likho.
     *
     * Upload me minute lag sakte hain. Us beech naya document "Phone par rakho"
     * se kataar me aaya ho to wo shuru ki list me hota hi nahi, aur purani list
     * likh dene se chup-chaap mit jaata — us document ka backup kabhi hota hi
     * nahi.
     */
    if (removed.size > 0 || updated.size > 0) {
      const now = await read(uid);
      await write(
        uid,
        now
          .filter((x) => !removed.has(itemKey(x)))
          .map((x) => updated.get(itemKey(x)) ?? x),
      );
    }
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
 *
 * ⚠️ Isi jaal ki wajah se `keepOnPhone()` `file_uri` bharta hai. Jo document
 * upload fail hone par sirf phone par raha, uska `file_path` khaali hai — aur
 * agar `file_uri` bhi khaali ho to ye poora self-healing us par kabhi chalta hi
 * nahi. Wo document 25 koshishein haar jaane ke baad hamesha ke liye us ek phone
 * par reh jaata, aur kisi ko pata bhi nahi chalta.
 */
export async function requeueMissingUploads(docs: Document[]): Promise<void> {
  const missing = docs.filter((d) => d.file_uri && !d.file_path);
  if (missing.length === 0) return;

  const uid = await currentUid();
  if (!uid) return;
  const list = await read(uid);
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
  if (added) await write(uid, list);
}

/** Local file ke naam se uska type — `documents.ts` wali hi soch. */
function mimeFromUri(uri: string): string {
  const ext = (uri.split("?")[0].split(".").pop() ?? "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg";
}
