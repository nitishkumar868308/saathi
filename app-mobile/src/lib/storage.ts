import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "./supabase";

/**
 * File storage — Cloudflare R2 (documents + profile photo).
 *
 * App khud R2 se baat NAHI karti. R2 ki access key poore bucket ka master key
 * hai; wo app me rakh dena matlab ek APK khol kar koi bhi sabki files padh le.
 * Isliye raasta ye hai:
 *
 *     1. app  -> web  : "mujhe upload karna hai" (apne Supabase token ke saath)
 *     2. web  -> app  : ek chhoti umar (5 min) ka presigned PUT URL
 *     3. app  -> R2   : seedha file (bytes phone se R2, beech me web nahi)
 *     4. app  -> web  : "ho gaya" — web R2 se asli size poochh kar DB bharta hai
 *
 * Kadam 3 seedha isliye hai ki 10 MB ki file web server se ho kar nikalne ka
 * koi fayda nahi — kharcha bhi, dher bhi. Kadam 4 isliye ki presigned PUT par
 * size ki koi rok lag hi nahi sakti; sach upload ke baad hi pata chalta hai.
 */

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://apkasaathi.com";

/** Net nahi tha — "fail" se alag, taaki user ko sahi baat batayi ja sake. */
export class StorageOfflineError extends Error {
  constructor() {
    super("Net nahi hai");
    this.name = "StorageOfflineError";
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

/** Local file ka size (bytes). Na mile to 0. */
export async function fileSizeBytes(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && "size" in info ? info.size : 0;
}

/* ------------------------------- web se baat ------------------------------- */

async function api<T>(path: string, body: unknown): Promise<T> {
  if (!supabase) throw new StorageError("Supabase set nahi hai");

  // Server pehchan SIRF is token se karta hai — user id bhejne ka koi matlab
  // nahi (aur bhejni bhi nahi chahiye).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new StorageError("Login zaroori hai");

  let res: Response;
  try {
    res = await fetch(`${WEB_URL}/api/storage/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new StorageOfflineError();
  }

  if (!res.ok) {
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    throw new StorageError(out.error ?? `storage ${res.status}`);
  }
  return (await res.json()) as T;
}

/* --------------------------------- upload --------------------------------- */

/**
 * Local file ko R2 pe chadhao.
 *
 * ⚠️ `uploadAsync` file ko seedha stream karta hai. Pehle wala tareeka file ko
 * base64 me padh kar memory me rakhta tha — 10 MB ki PDF wahan ~13 MB ki string
 * ban jaati thi, aur purane phone par wahi jagah app ko maar deti hai.
 */
async function putFile(url: string, uri: string, contentType: string): Promise<void> {
  let res: FileSystem.FileSystemUploadResult;
  try {
    res = await FileSystem.uploadAsync(url, uri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      // Content-Type signature ka hissa hai — badal diya to R2 403 dega.
      headers: { "Content-Type": contentType },
    });
  } catch {
    throw new StorageOfflineError();
  }
  if (res.status < 200 || res.status >= 300) {
    throw new StorageError(`upload fail (${res.status})`);
  }
}

/** Profile photo. Upload ke baad uska permanent URL lautata hai. */
export async function uploadAvatar(
  uri: string,
  contentType = "image/jpeg",
): Promise<{ size: number; url: string }> {
  const { url } = await api<{ url: string }>("upload-url", {
    kind: "avatar",
    contentType,
  });
  await putFile(url, uri, contentType);

  const done = await api<{ size: number }>("commit", { kind: "avatar", contentType });

  const { data } = await supabase!.auth.getSession();
  const uid = data.session?.user?.id ?? "";
  // `?t=` isliye ki photo badalne par purani cached image chipki na rah jaye.
  return { size: done.size, url: `${WEB_URL}/api/avatar/${uid}?t=${Date.now()}` };
}

/**
 * Document ki file. Server khud `documents` row me path/size/type bhar deta hai.
 * DB me jaane wala path (`<uid>/<docId>.<ext>`) lautata hai.
 *
 * `version` sirf RENEW par jaata hai (2 se shuru). Uske bina nayi photo purani
 * ke UPAR chadh jaati hai — jo naye document ke liye bilkul theek hai, par renew
 * par purani photo hamesha ke liye mita deta hai. Poori wajah
 * `supabase/document-versions.sql` ke upar likhi hai.
 *
 * ⚠️ Dono call me EK HI `version` jaana chahiye. `upload-url` us naam par
 * presigned URL banata hai aur `commit` usi naam par file dhoondhta hai; alag
 * hone par upload chadh jaata hai par commit "file R2 pe mili nahi" keh deta
 * hai. Isliye wo yahan ek hi jagah se dono me jaata hai.
 */
export async function uploadDocument(
  docId: string,
  uri: string,
  contentType: string,
  version?: number,
): Promise<{ path: string; size: number }> {
  const { url } = await api<{ url: string; path: string }>("upload-url", {
    kind: "document",
    docId,
    contentType,
    version,
  });
  await putFile(url, uri, contentType);
  return api<{ path: string; size: number }>("commit", {
    kind: "document",
    docId,
    contentType,
    version,
  });
}

/* -------------------------------- padhna --------------------------------- */

/**
 * Apni document file ka short-lived URL (dekhne/utaarne ke liye).
 * Kuch bhi gadbad ho to `null` — caller ko rukna nahi chahiye.
 */
export async function documentUrl(path: string): Promise<string | null> {
  try {
    const { url } = await api<{ url: string }>("download-url", { path });
    return url ?? null;
  } catch {
    return null;
  }
}

/** Document delete hua — R2 ki file bhi le jao. */
export async function deleteDocumentFile(path: string): Promise<void> {
  try {
    await api("delete", { path });
  } catch {
    /* file reh gayi to reh gayi — user ka kaam yahan rukna nahi chahiye */
  }
}
