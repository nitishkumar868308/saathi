import * as MediaLibrary from "expo-media-library";

import { resolveDocUri, type DocFile } from "./doc-cache";

/**
 * Document ko phone ki Gallery / Photos me save karna.
 *
 * Share se ye alag cheez hai: share dusri app ko bhejta hai, ye phone par apni
 * copy rakh deta hai — jise user kisi bhi gallery app me baad me dekh sakta hai,
 * app khole bina.
 *
 * ⚠️ `expo-media-library` ek NATIVE module hai. Ye code purane build me chalega
 * nahi — naya `eas build` chahiye. Baaki offline features (list, view, share)
 * purane build par bhi chalte hain, isliye is ek button ke fail hone se baaki
 * kuch nahi rukna chahiye.
 */

export type SaveResult =
  /** Gallery me chali gayi. */
  | "saved"
  /** User ne permission nahi di. */
  | "denied"
  /** File hi nahi mili (na cache me, na phone par, na cloud se). */
  | "nofile"
  /** Baaki kuch — native module missing, storage bhara, etc. */
  | "failed";

export async function saveDocumentToDevice(doc: DocFile): Promise<SaveResult> {
  // Pehle file — permission tabhi maango jab dene layak kuch ho. Warna user ko
  // permission ka popup milta hai aur uske baad "file nahi mili" — bhaddi baat.
  let uri: string | null = null;
  try {
    uri = await resolveDocUri(doc);
  } catch {
    return "failed";
  }
  if (!uri) return "nofile";

  try {
    // `true` = sirf likhne ki ijaazat. Poori gallery padhne ki zaroorat nahi
    // hai, aur kam maangna hamesha behtar hai.
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return "denied";
  } catch {
    // Native module hi nahi hai (purana build) — yahi wo soorat hai jiske liye
    // caller ko Share ka raasta khula rakhna chahiye.
    return "failed";
  }

  try {
    await MediaLibrary.saveToLibraryAsync(uri);
    return "saved";
  } catch {
    return "failed";
  }
}
