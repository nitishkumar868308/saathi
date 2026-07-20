import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { signedUrl } from "./storage";

/** Share ke liye document ka minimum shape. */
export type Shareable = {
  name: string;
  file_uri: string | null;
  file_path: string | null;
};

async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

function safeName(name: string): string {
  const base = name.replace(/[^\w.\- ]+/g, "").trim() || "document";
  return base.toLowerCase().endsWith(".jpg") || base.toLowerCase().endsWith(".png")
    ? base
    : `${base}.jpg`;
}

/**
 * Ek document ka shareable local uri nikaalo — pehle local file, na ho to
 * private storage se signed URL download karke cache me. Na mile to null.
 */
async function resolveShareUri(doc: Shareable): Promise<string | null> {
  if (doc.file_uri && (await fileExists(doc.file_uri))) return doc.file_uri;
  if (doc.file_path) {
    const url = await signedUrl("documents", doc.file_path);
    if (url) {
      try {
        const dest = (FileSystem.cacheDirectory ?? "") + safeName(doc.name);
        const res = await FileSystem.downloadAsync(url, dest);
        return res.uri;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Ek document share karo (system share sheet). true = share sheet khul gaya. */
export async function shareDocument(doc: Shareable): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const uri = await resolveShareUri(doc);
  if (!uri) return false;
  await Sharing.shareAsync(uri, { dialogTitle: doc.name });
  return true;
}

/**
 * Kai documents share karo. expo-sharing ek baar me ek hi file share karta hai,
 * isliye ek-ek karke share sheet khulta hai. Kitne share hue wo count lautata hai.
 */
export async function shareDocuments(docs: Shareable[]): Promise<number> {
  if (!(await Sharing.isAvailableAsync())) return 0;
  let shared = 0;
  for (const doc of docs) {
    const uri = await resolveShareUri(doc);
    if (!uri) continue;
    await Sharing.shareAsync(uri, { dialogTitle: doc.name });
    shared++;
  }
  return shared;
}
