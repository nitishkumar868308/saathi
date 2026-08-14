import { supabase } from "./supabase";
import type { DocFile } from "./doc-cache";

/**
 * Document ke PURANE version — renew se pehle wali photo aur expiry.
 *
 * ── Ye kyun hai ────────────────────────────────────────────────────────────
 *
 * Renew ab tak purane ko mita deta tha: nayi photo usi R2 key par chadh jaati
 * thi aur nayi expiry usi column par. Par asli zindagi me purana document renew
 * ke baad bhi kaam ka rehta hai — purana passport visa ke record ke liye, purani
 * policy claim ke liye, purana DL transfer/challan ke liye. Aur sabse aam
 * sawaal: "renew se pehle wali date kya thi?"
 *
 * Ab har renew par purana haal `document_versions` me chala jaata hai
 * (`supabase/document-versions.sql`), aur uski file R2 par apne alag naam se
 * padi rehti hai (`<uid>/<docId>-v<n>.<ext>`).
 *
 * ⚠️ Poora hissa "upar wali cheez" hai — history na mile to renew phir bhi
 * poora hona chahiye. Isliye yahan kuch bhi throw nahi karta: fail par khaali
 * list ya 0. Jis din tak `document-versions.sql` chalayi nahi jaati, app bilkul
 * pehle jaisi chalti hai.
 */

export type DocVersion = {
  id: string;
  document_id: string;
  /** 1 se shuru. R2 par file ka naam bhi isi se banta hai. */
  version: number;
  /** Us waqt ki expiry (renew se pehle wali). */
  expiry: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  /** Ye version kab tak "current" tha — yaani renew kab hua. */
  created_at: string;
};

/**
 * Abhi ka haal history me daal do, aur naya version number lauta do.
 *
 * Renew ke SABSE PEHLE chalta hai — kuch badalne se pehle. Lauta hua number `n`
 * ka matlab: purana haal `version = n` par mehfooz ho gaya, aur nayi file ka
 * naam `n + 1` se banna chahiye.
 *
 * ⚠️ `0` = history nahi bani (RPC deploy nahi hui, net nahi hai, ya document
 * apna nahi hai). Caller ko us par RUKNA NAHI hai — 0 ka matlab sirf itna hai
 * ki nayi photo purane hi naam par jaayegi, bilkul jaise pehle jaati thi.
 */
export async function snapshotVersion(docId: string, state?: string): Promise<number> {
  if (!supabase) return 0;

  // Wahi haal dobara = pichhli baar `documents` ki update chali hi nahi. Nayi
  // entry mat banao, pichhli hi lauta do. (Tafseel `versionState` par likhi hai.)
  if (state !== undefined) {
    const seen = lastSnapshot.get(docId);
    if (seen && seen.state === state) return seen.version;
  }

  try {
    const { data, error } = await supabase.rpc("snapshot_document_version", {
      p_document_id: docId,
    });
    if (error) return 0;
    const n = Number(data);
    if (!Number.isInteger(n) || n <= 0) return 0;
    if (state !== undefined) lastSnapshot.set(docId, { state, version: n });
    return n;
  } catch {
    return 0;
  }
}

/**
 * Is session me aakhri baar kis haal ka snapshot liya tha.
 *
 * Sirf memory me — app band hone par mit jaata hai, aur yahi theek hai: jis
 * naakaam koshish se ye bachata hai wo usi screen par, usi pal hoti hai.
 */
const lastSnapshot = new Map<string, { state: string; version: number }>();

/**
 * Document ka "renew se pehle wala haal", ek line me — retry pehchanne ke liye.
 *
 * ⚠️ Ye kyun chahiye: snapshot `documents` ki update se PEHLE chalta hai (aur
 * chalna bhi wahin chahiye, warna wo purana nahi naya haal copy karega). Par
 * beech me update fail ho sakti hai — net jhatka kha gaya, RLS ne rok diya —
 * aur tab user wahi "Save" dobara dabata hai, jo bilkul sahi bartaav hai.
 *
 * Bina is shart ke har aisi koshish ek nayi history entry banati: "Purane
 * versions" me ek hi date ki do-teen bilkul ek jaisi entry, jo theek us
 * `changing` wali shart ka maqsad tod deti hai jo upar iske liye lagai gayi hai.
 *
 * Kaamyab renew ke baad document ka haal khud badal jaata hai (expiry ya
 * file_path), isliye agli asli renew par ye key alag hoti hai aur naya snapshot
 * banta hai — jaisa banna chahiye.
 */
export function versionState(doc: { expiry: string | null; file_path?: string | null }): string {
  return `${doc.expiry ?? ""}|${doc.file_path ?? ""}`;
}

/** Is document ke saare purane version — sabse naya pehle. */
export async function listVersions(docId: string): Promise<DocVersion[]> {
  if (!supabase || !docId) return [];
  try {
    const { data, error } = await supabase
      .from("document_versions")
      .select("id, document_id, version, expiry, file_path, file_size, mime_type, created_at")
      .eq("document_id", docId)
      .order("version", { ascending: false });
    if (error || !data) return [];
    return data as DocVersion[];
  } catch {
    return [];
  }
}

/**
 * Purane version ki file kahan hai — `resolveDocUri()` ke liye shape.
 *
 * ⚠️ `id` yahan SEEDHA `document_id` hai, aur ye badla hua hai.
 *
 * Pehle yahan `${document_id}-v${version}` daala jaata tha, aur uski wajah
 * theek thi: cache ka naam us waqt sirf `<id>.<ext>` hota tha, isliye asli
 * docId dene par purana version CURRENT document ki cached file ke UPAR baith
 * jaata — aur user ko document-view par purani photo dikhne lagti.
 *
 * Ab wo jugaad ki zaroorat nahi rahi: cache ka naam khud `file_path` se version
 * nikaal leta hai (`utils/doc-file-name.ts`), isliye har version ka apna naam
 * apne aap ban jaata hai. Ulta, purani jugaad ke saath naam me version DO baar
 * chadh jaata tha (`<docId>-v2-v2.jpg`) — chalta to tha, par wo ek aisi cheez
 * hai jise agla padhne wala "galti" samajh ke theek karne baith jaata.
 *
 * Ab cache ka naam R2 ki key ke aakhri hisse se hubahu milta hai — wahi sabse
 * saaf niyam hai jo yahan ho sakta tha.
 *
 * ⚠️ `file_path` null ho to koi takraav nahi hota: `cachedFileUri()` aur
 * `downloadToCache()` dono uspar turant `null` laut jaate hain, yaani us version
 * ki koi file dhoondhi hi nahi jaati.
 *
 * `file_uri` hamesha null: purana version is phone par kabhi tha hi nahi (wo
 * doosre phone par bhi ho sakta hai), wo hamesha R2 se hi aata hai.
 */
export function versionDocFile(v: DocVersion): DocFile {
  return {
    id: v.document_id,
    file_uri: null,
    file_path: v.file_path,
    mime_type: v.mime_type,
  };
}

/**
 * Is document ke saare version ki file paths — DELETE se PEHLE poochne ke liye.
 *
 * ⚠️ Tarteeb maayne rakhti hai: `documents` ki row hatte hi `document_versions`
 * bhi cascade se hat jaati hai, aur uske baad ye paths kahin se nahi milte. Us
 * soorat me purani files R2 par hamesha ke liye padi reh jaati — user ke liye
 * "delete", bill me zinda, aur kisi purane signed URL se khulne layak. Wahi
 * chhed jo `storage.sql` aur `deleteDocument()` par pehle se likha hai, bas
 * nayi shakl me.
 */
export async function versionFilePaths(docId: string): Promise<string[]> {
  if (!supabase || !docId) return [];
  try {
    const { data, error } = await supabase.rpc("my_document_version_paths", {
      p_document_id: docId,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as { file_path?: string | null }[])
      .map((r) => r.file_path)
      .filter((p): p is string => typeof p === "string" && p.length > 0);
  } catch {
    return [];
  }
}
