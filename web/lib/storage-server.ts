import { deleteObject, headObject, isOwnDocumentPath, r2Key } from "@/lib/r2";

/**
 * File upload ke niyam — ek hi jagah.
 *
 * ⚠️ Pehle ye niyam Supabase ke bucket config me the (`file_size_limit`,
 * `allowed_mime_types`) — yaani DB khud rok deta tha. R2 me aisi koi rok hai hi
 * nahi: presigned PUT ke saamne bucket ek khuli almari hai. Isliye ab har rok
 * YAHAN se lagti hai, aur upload ke BAAD `commitUpload` dobara jaanchta hai ki
 * jo sach me chadha wo bhi in hi hadd me tha.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOCUMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/** contentType → file extension. Ext hum khud tay karte hain, client nahi. */
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export type UploadKind = "avatar" | "document";

export function rulesFor(kind: UploadKind): {
  maxBytes: number;
  types: readonly string[];
} {
  return kind === "avatar"
    ? { maxBytes: AVATAR_MAX_BYTES, types: AVATAR_TYPES }
    : { maxBytes: DOCUMENT_MAX_BYTES, types: DOCUMENT_TYPES };
}

export function extFor(contentType: string): string | null {
  return EXT[contentType] ?? null;
}

/* ------------------------------ Version wale naam ------------------------------ */

/**
 * Document ki file ka naam — version ke saath.
 *
 * ⚠️ Ye ek hi jagah hona ZAROORI hai. `upload-url` presigned URL is naam par
 * banata hai aur `commit` usi naam par HEAD maar kar DB bharta hai. Dono ka
 * hisaab alag hua to upload chadh jaayega aur commit "file R2 pe mili nahi"
 * keh kar fail hoga — ek aisa fail jise pakadna bahut mushkil hai.
 *
 * Version 1 (ya bina version) jaan-boojh ke PURANA raasta hai —
 * `<docId>.<ext>`, bilkul waisa jaisa aaj har document ka hai. Isliye is poore
 * badlaav se ek bhi purana document nahi hilta: unka path waisa ka waisa rehta
 * hai, aur unki file wahin padi rehti hai.
 *
 * Version 2 se aage `<docId>-v<n>.<ext>` — aur yahi wo cheez hai jo renew par
 * purani photo ko bachati hai. Nayi file ka naam alag hai, isliye wo purani ke
 * upar chadh hi nahi sakti.
 *
 * ⚠️ `-` aur ank dono `isOwnDocumentPath()` ke `[A-Za-z0-9._-]` me pehle se
 * allowed hain, isliye purani versions padhna aur delete karna bina kisi aur
 * badlaav ke chalta hai.
 */
export function documentFileName(docId: string, ext: string, version?: number): string {
  return version && version > 1 ? `${docId}-v${version}.${ext}` : `${docId}.${ext}`;
}

/**
 * Body se aaya `version` — sirf 1 se 9999 tak ka poora ank.
 *
 * ⚠️ Ye jaanch dheeli nahi chhodi ja sakti: ye ginti seedha R2 key ke NAAM me
 * jaati hai. Sirf ank hone se `..`, `/` aur baaki har chaalaki apne aap ruk
 * jaati hai — bilkul waise hi jaise extension client se nahi liya jaata.
 *
 * Galat/khaali ho to `undefined` (yaani purana `<docId>.<ext>` wala raasta),
 * kyunki purani app is field ko bhejti hi nahi hai aur usse kuch tootna nahi
 * chahiye.
 */
export function parseVersion(raw: unknown): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 9999 ? n : undefined;
}

/* ------------------------------ Supabase REST ------------------------------ */

function sbHeaders(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function storageDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/**
 * Kya ye document sach me isi user ka hai?
 *
 * ⚠️ Bina is jaanch ke ek user doosre ke `docId` par `commit` maar kar uski row
 * ka `file_path` apni file par mod sakta tha. Key to apne folder me hi banti
 * (uid token se aata hai), par DB ki row kisi aur ki hoti.
 */
export async function documentBelongsTo(docId: string, uid: string): Promise<boolean> {
  if (!/^[0-9a-fA-F-]{36}$/.test(docId)) return false;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?select=id&id=eq.${docId}&user_id=eq.${uid}`,
    { headers: sbHeaders(), cache: "no-store" },
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/** Upload ke baad document row par file ki asli jaankari likho. */
export async function saveDocumentFile(
  docId: string,
  uid: string,
  filePath: string,
  fileSize: number,
  mimeType: string,
): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?id=eq.${docId}&user_id=eq.${uid}`,
    {
      method: "PATCH",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        file_path: filePath,
        file_size: fileSize,
        mime_type: mimeType,
      }),
      cache: "no-store",
    },
  );
  return res.ok;
}

/** Document ka pada hua `file_path` (delete ke waqt key banane ke liye). */
export async function documentFilePath(docId: string, uid: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?select=file_path&id=eq.${docId}&user_id=eq.${uid}`,
    { headers: sbHeaders(), cache: "no-store" },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { file_path: string | null }[];
  return rows?.[0]?.file_path ?? null;
}

/* -------------------------------- Commit ---------------------------------- */

export type CommitResult =
  | { ok: true; size: number; contentType: string | null }
  | { ok: false; status: number; error: string };

/**
 * "Jo sach me chadha, wo niyam ke andar tha?"
 *
 * Presigned PUT me size ki rok lagayi hi nahi ja sakti — `content-length-range`
 * sirf browser wale POST-policy form me hota hai. To hum ulta karte hain: upload
 * hone ke baad R2 se HEAD maar kar asli size poochhte hain, aur hadd se bahar ho
 * to object wahin mita dete hain. Isi wajah se DB me jaane wali `file_size` bhi
 * app ki batayi hui nahi, R2 ki batayi hui hoti hai.
 */
export async function commitUpload(key: string, kind: UploadKind): Promise<CommitResult> {
  const info = await headObject(key);
  if (!info) return { ok: false, status: 404, error: "file R2 pe mili nahi" };

  const { maxBytes, types } = rulesFor(kind);

  if (info.size <= 0) {
    await deleteObject(key);
    return { ok: false, status: 400, error: "khaali file" };
  }
  if (info.size > maxBytes) {
    await deleteObject(key);
    return {
      ok: false,
      status: 413,
      error: `file ${Math.round(maxBytes / 1024 / 1024)} MB se badi hai`,
    };
  }
  // contentType signed tha, par R2 ka jawab kabhi charset jod deta hai.
  const base = (info.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (base && !types.includes(base)) {
    await deleteObject(key);
    return { ok: false, status: 415, error: `is tarah ki file allowed nahi (${base})` };
  }

  return { ok: true, size: info.size, contentType: info.contentType };
}

/* ---------------------------------- Keys ---------------------------------- */

/** DB me pada `<uid>/<file>` → R2 key, sirf tab jab wo isi user ka ho. */
export function documentKeyFor(filePath: string, uid: string): string | null {
  return isOwnDocumentPath(filePath, uid) ? r2Key.documentPath(filePath) : null;
}
