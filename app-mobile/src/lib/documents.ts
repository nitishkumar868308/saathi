import { supabase } from "./supabase";
import { canAddDocument, FREE_DOC_LIMIT } from "./plan";
import { deleteDocumentFile, uploadDocument } from "./storage";
import {
  readCachedDocs,
  removeCachedFile,
  syncDocumentFiles,
  writeCachedDocs,
} from "./doc-cache";

/** Free-plan document limit cross hone par throw hota hai. */
export class DocLimitError extends Error {
  constructor() {
    super(
      `Free plan mein sirf ${FREE_DOC_LIMIT} documents rakh sakte ho. Unlimited ke liye Saathi Plus lo.`,
    );
    this.name = "DocLimitError";
  }
}

export type Document = {
  id: string;
  name: string;
  type: string;
  expiry: string | null; // 'YYYY-MM-DD'
  /** AI scan ka poora samajh — kya document hai, kaunse fields mile. */
  summary: string | null;
  file_uri: string | null; // local device path (fast offline view)
  file_path: string | null; // R2 ka rasta `<uid>/<docId>.<ext>` (cloud backup)
  file_size: number | null; // bytes
  mime_type: string | null;
  /** Plus expire hone pe 3 se aage ke documents lock ho jaate hain. */
  is_locked: boolean;
  created_at: string;
};

/** Local file ke naam se uska type. Server bhi in hi chaar ko maanta hai. */
function mimeFromUri(uri: string): string {
  const ext = (uri.split("?")[0].split(".").pop() ?? "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg";
}

/**
 * Document ki file R2 pe chadhao.
 *
 * `file_path` / `file_size` / `mime_type` ab server khud bharta hai (upload ke
 * baad R2 se asli size poochh kar) — isliye yahan koi DB update nahi hai.
 */
export async function uploadDocumentImage(docId: string, localUri: string): Promise<void> {
  await uploadDocument(docId, localUri, mimeFromUri(localUri));
}

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

/**
 * Abhi kaun logged-in hai — bina network ke.
 *
 * ⚠️ Yahan pehle `auth.getUser()` tha, aur wahi offline ka sabse chhupa hua
 * kaanta tha: `getUser()` JWT ko SERVER se verify karta hai, yaani wo ek network
 * request hai. Net na hone par hum query tak pahunchte hi nahi the — uid
 * nikaalte waqt hi gir jaate the. Sirf query ka nateeja cache karna is wajah se
 * kaafi nahi hota.
 *
 * `getSession()` local storage se padhta hai. Suraksha me koi farq nahi — rows
 * server par RLS se waise bhi apne-apne user tak seemit hain.
 */
async function currentUid(): Promise<string | null> {
  const { data } = await client().auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Sirf apne documents — offline bhi.
 *
 * RLS bhi ab own-row hai, par filter yahan bhi rakha hai — do reasons:
 * (1) RLS galat configure ho to bhi leak na ho, (2) count sahi rahe.
 *
 * Net ho to server se, aur saath hi cache bhar do. Net na ho to cache se —
 * khaali list ya error nahi. Isi wajah se Documents tab, Home aur chat ka
 * context, teenon bina kisi badlav ke offline kaam karne lagte hain.
 */
export async function listDocuments(): Promise<Document[]> {
  const sb = client();
  const uid = await currentUid();
  if (!uid) return [];

  try {
    const { data, error } = await sb
      .from("documents")
      .select("*")
      .eq("user_id", uid)
      .order("expiry", { ascending: true, nullsFirst: false });
    if (error) throw error;

    const docs = (data ?? []) as Document[];
    void writeCachedDocs(uid, docs);
    // Fire-and-forget — list turant dikhni chahiye, files peeche utarti rahein.
    syncDocumentFiles(docs);
    return docs;
  } catch (e) {
    const cached = await readCachedDocs(uid);
    if (cached) return cached;
    // Cache bhi nahi hai — pehli baar hai aur net bhi nahi. Ab sach batana hi
    // theek hai; screen error dikha degi.
    throw e;
  }
}

export async function addDocument(input: {
  name: string;
  type: string;
  expiry: string | null;
  summary?: string | null;
  file_uri?: string | null;
}): Promise<Document> {
  // Free plan limit check
  if (!(await canAddDocument())) throw new DocLimitError();

  const sb = client();
  // Referral qualification (document upload) server-side isi se verify hota hai.
  const { data: u } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("documents")
    .insert({
      name: input.name,
      type: input.type,
      expiry: input.expiry,
      summary: input.summary ?? null,
      file_uri: input.file_uri ?? null,
      user_id: u.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Document;
}

/**
 * Document hatao — server se bhi, aur phone se bhi.
 *
 * Poora `doc` isliye chahiye (sirf id nahi): cached file ka naam uske
 * `file_path`/`mime_type` se banta hai. Bina safai ke deleted documents ki
 * files phone par padi rehti thi aur "offline documents" ka size kabhi ghatta
 * hi nahi.
 */
export async function deleteDocument(doc: Document): Promise<void> {
  const { error } = await client().from("documents").delete().eq("id", doc.id);
  if (error) throw error;

  await removeCachedFile(doc);
  // Cloud copy bhi jaani chahiye. ⚠️ Pehle sirf DB row aur local cache hatti
  // thi — bucket me file padi rehti thi: user ke liye "delete", bill me zinda,
  // aur kisi purane signed URL se abhi bhi khulne layak.
  if (doc.file_path) await deleteDocumentFile(doc.file_path);
  // Metadata cache bhi turant sudhaaro — warna offline jaate hi delete kiya
  // hua document wapas list me aa jaata.
  const uid = await currentUid();
  if (uid) {
    const cached = await readCachedDocs(uid);
    if (cached) await writeCachedDocs(uid, cached.filter((x) => x.id !== doc.id));
  }
}
