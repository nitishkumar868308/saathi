import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { documentUrl } from "./storage";
import type { Document } from "./documents";

/**
 * Documents ka offline cache — list bhi, files bhi.
 *
 * Pehle aisa tha: file to phone par hoti thi (`add-document` use
 * `documentDirectory/documents/` me copy karta hai), par uska RASTA database me
 * pada tha. Net na ho to list hi nahi aati thi, aur app ko pata hi nahi chalta
 * tha ki file kahan rakhi hai. Document saamne pada tha aur khulta nahi tha.
 *
 * ⚠️ File cache jaan-boojh ke `file_uri` se ALAG hai. `file_uri` us ek phone ka
 * rasta hai jisne document banaya tha — naya phone lene ya app dobara install
 * karne par wo rasta khaali ho jaata hai. Document-id se cache karne par wahi
 * cache har device par khud ban jaata hai, aur "naye phone par document nahi
 * khulta" wali dikkat jad se khatam ho jaati hai.
 */

/* ------------------------------ metadata ------------------------------ */

const LIST_KEY = "saathi-docs:";

/** Cache me rakhi list. Kuch na mile to null (khaali list se alag baat hai). */
export async function readCachedDocs(uid: string): Promise<Document[] | null> {
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Document[]) : null;
  } catch {
    // Corrupt/purana data — cache na hone jaisa hi hai.
    return null;
  }
}

export async function writeCachedDocs(uid: string, docs: Document[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LIST_KEY + uid, JSON.stringify(docs));
  } catch {
    /* storage bhara ho to bhi app chalti rahe */
  }
}

/* -------------------------------- files -------------------------------- */

/**
 * File dhoondhne ke liye document ka minimum shape.
 *
 * Poora `Document` maangna yahan galat hota: `document-view` ko router se sirf
 * kuch params milte hain, poori row nahi. Utna hi maango jitna sach me chahiye.
 */
export type DocFile = Pick<Document, "id" | "file_uri" | "file_path" | "mime_type">;

const DIR = (FileSystem.documentDirectory ?? "") + "doccache/";

/**
 * Is document ki cached file ka rasta — bina kuch padhe, sirf hisaab se.
 *
 * Ext `file_path` se (upload wahi ext use karta hai), warna `mime_type` se.
 * Deterministic hone ka faayda ye hai ki koi manifest file rakhni hi nahi
 * padti — rasta hamesha nikala ja sakta hai, offline bhi.
 */
function cachePath(doc: Pick<DocFile, "id" | "file_path" | "mime_type">): string {
  const raw = doc.file_path?.split(".").pop()?.split("?")[0] ?? "";
  // ⚠️ Sirf saaf-suthre akshar. Bina is jaanch ke ek aisa `file_path` jisme
  // aakhri dot ke BAAD slash ho (jaise "a/b.c/d") ext ko "c/d" bana deta, aur
  // rasta `doccache/<id>.c/d` — yaani cache folder se bahar. Ext ki jagah ext
  // hi aana chahiye.
  const ext = /^[a-z0-9]{1,5}$/i.test(raw)
    ? raw.toLowerCase()
    : doc.mime_type === "image/png"
      ? "png"
      : "jpg";
  return `${DIR}${doc.id}.${ext}`;
}

async function ensureDir(): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {
    /* pehle se hai */
  }
}

async function exists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/** Cached file ka rasta, agar wo sach me padi hai. Warna null. */
export async function cachedFileUri(
  doc: Pick<DocFile, "id" | "file_path" | "mime_type">,
): Promise<string | null> {
  if (!doc.file_path) return null;
  const uri = cachePath(doc);
  return (await exists(uri)) ? uri : null;
}

/**
 * Cloud copy ko cache me utaaro. Pehle se ho to kuch nahi karta.
 * Net/permission fail par null — caller ko rukna nahi chahiye.
 */
async function downloadToCache(
  doc: Pick<DocFile, "id" | "file_path" | "mime_type">,
): Promise<string | null> {
  if (!doc.file_path) return null;
  const dest = cachePath(doc);
  if (await exists(dest)) return dest;

  const url = await documentUrl(doc.file_path);
  if (!url) return null;

  await ensureDir();
  try {
    // ⚠️ Seedha `dest` par download karna khatarnak hai: beech me net toota to
    // aadhi file `dest` par pad jaati hai, aur `exists()` use poora maan leta
    // hai — document hamesha ke liye toota hua dikhta rehta. Isliye pehle ek
    // arzi naam par utaarte hain, poora hone par hi asli naam dete hain.
    const tmp = `${dest}.part`;
    await FileSystem.downloadAsync(url, tmp);
    await FileSystem.moveAsync({ from: tmp, to: dest });
    return dest;
  } catch {
    try {
      await FileSystem.deleteAsync(`${dest}.part`, { idempotent: true });
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * Is document ki file kahan hai — poore app ka ek hi raasta.
 *
 * Tarteeb jaan-boojh ke yahi hai:
 *   1. cache      — har device par kaam karta hai, offline bhi
 *   2. file_uri   — isi phone ka document; cache bharne se PEHLE bhi mil jaata hai
 *   3. signed URL — sirf net ke saath, aur saath hi cache bhi bhar deta hai
 *
 * Pehle `document-view`, `share` aur download — teenon ka apna aadha-adhoora
 * logic tha, aur teenon offline alag-alag tarah se fail hote the.
 */
export async function resolveDocUri(doc: DocFile): Promise<string | null> {
  const cached = await cachedFileUri(doc);
  if (cached) return cached;

  if (doc.file_uri && (await exists(doc.file_uri))) return doc.file_uri;

  return downloadToCache(doc);
}

/** Document delete hua — uski file bhi le jao. */
export async function removeCachedFile(
  doc: Pick<DocFile, "id" | "file_path" | "mime_type">,
): Promise<void> {
  try {
    await FileSystem.deleteAsync(cachePath(doc), { idempotent: true });
  } catch {
    /* na hui to na sahi */
  }
}

/* ----------------------------- background sync ----------------------------- */

/**
 * Kitni documents apne aap utaari jayein.
 *
 * ⚠️ Ye chhat zaroori hai. 200 documents wale Plus user ka ~400 MB phone me
 * chala jaata, aur user ne saaf kaha tha ki app "smooth and fast" rehni chahiye.
 * Is 50 se purani koi document jab user KHOLTA hai tab wo cache ho jaati hai
 * (`resolveDocUri` khud bhar deta hai) aur uske baad hamesha offline rehti hai.
 */
const AUTO_CACHE_LIMIT = 50;
/** Ek waqt me kitni file — poori bandwidth kha ke baaki app dheemi na ho. */
const CONCURRENCY = 2;

let syncing = false;

/** Kuch kaam, thode-thode karke. Ek ka fail baaki ko nahi rokta. */
async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await work(item);
      } catch {
        /* agli baar phir koshish ho jayegi */
      }
    }
  });
  await Promise.all(runners);
}

/**
 * Documents ko chupchaap phone par utaaro — taaki net na hone par bhi khulein.
 *
 * Fire-and-forget: `listDocuments()` ise bulata hai aur intezaar NAHI karta.
 * Ye "smooth and fast" wali shart ka asli hissa hai — list turant dikhni
 * chahiye, download peeche chalte rehna chahiye.
 */
export function syncDocumentFiles(docs: Document[]): void {
  if (syncing) return;

  const targets = docs
    // Locked = free plan ki limit ke baad wale. Wo khulte hi nahi, utaarna
    // sirf user ka data aur storage kharch karna hoga.
    .filter((d) => !d.is_locked && d.file_path)
    // "Nayi 50" — list expiry se sorted aati hai, isliye yahan created_at se
    // dobara sort karna zaroori hai.
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, AUTO_CACHE_LIMIT);

  if (targets.length === 0) return;

  syncing = true;
  void pool(targets, CONCURRENCY, async (d) => {
    await downloadToCache(d);
  }).finally(() => {
    syncing = false;
  });
}

/* ------------------------------ size + safai ------------------------------ */

/** Cache kitni jagah le raha hai (bytes). */
export async function cacheSizeBytes(): Promise<number> {
  try {
    const names = await FileSystem.readDirectoryAsync(DIR);
    let total = 0;
    for (const n of names) {
      const info = await FileSystem.getInfoAsync(DIR + n);
      if (info.exists && "size" in info) total += info.size;
    }
    return total;
  } catch {
    // Directory bani hi nahi — kuch cached nahi hai.
    return 0;
  }
}

/** Saari cached files hatao. Documents khud safe hain — dobara utar jayengi. */
export async function clearFileCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(DIR, { idempotent: true });
  } catch {
    /* ignore */
  }
}

/**
 * Logout — is phone par is user ka kuch na bache.
 *
 * List cache user-wise hai, isliye uska key hatate hain; files ek hi folder me
 * hain isliye poora folder. Dono cheezein server par surakshit hain.
 */
export async function clearDocCache(uid?: string | null): Promise<void> {
  if (uid) {
    try {
      await AsyncStorage.removeItem(LIST_KEY + uid);
    } catch {
      /* ignore */
    }
  }
  await clearFileCache();
}

/** "42 MB" jaisa chhota label. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
