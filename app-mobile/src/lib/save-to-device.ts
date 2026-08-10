import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";

import { resolveDocUri, type DocFile } from "./doc-cache";
import { reportError } from "./report-error";

/**
 * Document ko phone par save karna ("Download").
 *
 * Share se ye alag cheez hai: share dusri app ko bhejta hai, ye phone par apni
 * copy rakh deta hai — jise user kisi bhi gallery/file app me baad me dekh sakta
 * hai, app khole bina.
 *
 * ── Do raaste, aur DONO zaroori hain ─────────────────────────────────────
 *
 * ⚠️ Pehle yahan sirf `MediaLibrary.saveToLibraryAsync()` tha, aur wo Android
 * par teen aam soorat me chup-chaap fail ho jaata tha. Teenon ka nateeja user ke
 * liye ek hi tha: "Couldn't save — try Share instead", har baar, har document
 * par. Download button practically kaam hi nahi karta tha.
 *
 *   1. **Gallery sirf media leti hai.** `saveToLibraryAsync` andar se
 *      MediaStore ke Images/Video collection me daalta hai. PDF ya koi bhi
 *      non-image document wahan jaa hi nahi sakta — native side seedha throw
 *      karta hai. Bahut se documents PDF hi hote hain.
 *
 *   2. **Android 13+ (API 33) par permission ka matlab badal gaya.**
 *      `WRITE_EXTERNAL_STORAGE` ab diya hi nahi jaata, aur granular
 *      READ_MEDIA_* sirf PADHNE ke liye hai. Kai phone par
 *      `requestPermissionsAsync(true)` `granted: false` de deta hai — aur ye
 *      "user ne mana kiya" nahi, "ye permission is Android par hai hi nahi"
 *      hota hai. Hum use "denied" maan ke ruk jaate the.
 *
 *   3. **Purane build me native module hi nahi hota** (`expo-media-library`
 *      baad me juda tha) — wahan har call throw karti hai.
 *
 * Isliye ab dusra raasta hai: **Storage Access Framework (SAF)**. User ek baar
 * folder chunta hai (aam taur par Downloads), Android us folder ka haq app ko
 * hamesha ke liye de deta hai, aur uske baad har download bina kisi popup ke
 * seedha wahan chala jaata hai. SAF ko koi manifest permission chahiye hi nahi,
 * wo har mime type leta hai, aur Android 10+ par yahi sarkari tareeka hai.
 *
 * Tarteeb: image ho to pehle Gallery (wahan document photo ke saath dikhta hai,
 * jo log dhoondte hain), aur uske fail hote hi — ya file image na ho — SAF.
 */

export type SaveResult =
  /** Phone par chali gayi (gallery ya chune hue folder me). */
  | "saved"
  /** User ne permission/folder dena mana kar diya. */
  | "denied"
  /** File hi nahi mili (na cache me, na phone par, na cloud se). */
  | "nofile"
  /** Baaki kuch — dono raaste fail. */
  | "failed";

/** User ne jo folder chuna tha (SAF ka persisted URI) — dobara na poochhna pade. */
const DIR_KEY = "saathi-save-dir";

/**
 * File ka naam — extension ke saath.
 *
 * Ext zaroori hai: bina uske file manager use "unknown" dikhata hai aur tap
 * karne par koi app khulti hi nahi. Naam se woh sab hata dete hain jo Android
 * ke file naam me nahi chalta (`/`, `:` waghairah) — warna create hi fail hota
 * hai.
 */
function fileNameFor(doc: DocFile, uri: string, name?: string): string {
  const fromUri = uri.split("?")[0].split(".").pop() ?? "";
  const ext = /^[a-z0-9]{1,5}$/i.test(fromUri)
    ? fromUri.toLowerCase()
    : doc.mime_type === "application/pdf"
      ? "pdf"
      : doc.mime_type === "image/png"
        ? "png"
        : "jpg";
  const base = (name || "document").replace(/[^\w\-. ]+/g, "_").trim() || "document";
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

function mimeFor(doc: DocFile, fileName: string): string {
  if (doc.mime_type) return doc.mime_type;
  if (fileName.endsWith(".pdf")) return "application/pdf";
  if (fileName.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

/** Gallery me daalne laayak hai? Sirf image/video — baaki sab SAF se jaayega. */
function isMedia(mime: string): boolean {
  return mime.startsWith("image/") || mime.startsWith("video/");
}

/**
 * Gallery wala raasta.
 *
 * `null` ka matlab "yahan se nahi hua" — caller ko SAF par chala jaana chahiye.
 * `"denied"` yahan JAAN-BOOJH KE nahi lautaya jaata: Android 13+ par permission
 * ka mana karna aksar user ka faisla hota hi nahi (upar wajah 2), aur uspar ruk
 * jaana user ko ek aisi baat par rok deta hai jise wo badal hi nahi sakta.
 */
async function saveToGallery(uri: string): Promise<"saved" | null> {
  try {
    // `true` = sirf likhne ki ijaazat. Poori gallery padhne ki zaroorat nahi.
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return null;
    await MediaLibrary.saveToLibraryAsync(uri);
    return "saved";
  } catch {
    // Native module missing (purana build), non-media file, ya OEM ki apni
    // rok — teenon me SAF abhi bhi chal sakta hai.
    return null;
  }
}

/** Pehle se chuna hua folder, agar wo abhi bhi hamara hai. */
async function savedDir(): Promise<string | null> {
  try {
    const uri = await AsyncStorage.getItem(DIR_KEY);
    if (!uri) return null;
    // Folder hata diya gaya ho ya haq chala gaya ho — tab isse aage use karna
    // sirf ek aur fail hai. Ek halki jaanch se pata chal jaata hai.
    await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
    return uri;
  } catch {
    await AsyncStorage.removeItem(DIR_KEY).catch(() => {});
    return null;
  }
}

/**
 * SAF wala raasta — Android.
 *
 * Pehli baar user se ek folder poochha jaata hai (Downloads default hota hai),
 * aur uska haq phone par bach jaata hai. Uske baad har download chup-chaap wahan
 * chala jaata hai — koi popup nahi.
 */
async function saveViaSaf(
  uri: string,
  fileName: string,
  mime: string,
): Promise<SaveResult> {
  const SAF = FileSystem.StorageAccessFramework;

  let dir = await savedDir();
  if (!dir) {
    let perm;
    try {
      perm = await SAF.requestDirectoryPermissionsAsync(null);
    } catch (e) {
      reportError(e, { screen: "save-to-device", action: "saf_permission" }, "warn");
      return "failed";
    }
    if (!perm.granted) return "denied";
    dir = perm.directoryUri;
    await AsyncStorage.setItem(DIR_KEY, dir).catch(() => {});
  }

  try {
    // ⚠️ base64 se hi copy hota hai. `copyAsync` SAF ke content:// URI par har
    // Android par bharosemand nahi hai (kuch par chup-chaap 0 byte ki file
    // banti hai), aur adhuri file poori dikhne se bura kuch nahi.
    const data = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });
    const dest = await SAF.createFileAsync(dir, fileName, mime);
    await FileSystem.writeAsStringAsync(dest, data, {
      encoding: "base64",
    });
    return "saved";
  } catch (e) {
    // Folder ka haq beech me chala gaya ho sakta hai — agli baar dobara poochho.
    await AsyncStorage.removeItem(DIR_KEY).catch(() => {});
    reportError(e, { screen: "save-to-device", action: "saf_write" }, "warn");
    return "failed";
  }
}

export async function saveDocumentToDevice(
  doc: DocFile & { name?: string },
): Promise<SaveResult> {
  // Pehle file — permission tabhi maango jab dene layak kuch ho. Warna user ko
  // permission ka popup milta hai aur uske baad "file nahi mili" — bhaddi baat.
  let uri: string | null = null;
  try {
    uri = await resolveDocUri(doc);
  } catch {
    return "failed";
  }
  if (!uri) return "nofile";

  const fileName = fileNameFor(doc, uri, doc.name);
  const mime = mimeFor(doc, fileName);

  // Image/video ho to Gallery pehle — user documents ko wahin dhoondhta hai.
  if (isMedia(mime)) {
    const viaGallery = await saveToGallery(uri);
    if (viaGallery) return viaGallery;
  }

  if (Platform.OS === "android") return saveViaSaf(uri, fileName, mime);

  /**
   * iOS: SAF hai hi nahi, aur app ke apne sandbox me copy karne ka user ke liye
   * koi matlab nahi (wo file kahin dikhti hi nahi). Non-media file wahan Share
   * sheet se hi "Save to Files" hoti hai — isliye caller ko wahi raasta batana
   * sabse sachhi baat hai.
   */
  return "failed";
}
