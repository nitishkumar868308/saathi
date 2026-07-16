import { supabase } from "./supabase";
import { canAddDocument, FREE_DOC_LIMIT } from "./plan";

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
  file_uri: string | null;
  /** Plus expire hone pe 3 se aage ke documents lock ho jaate hain. */
  is_locked: boolean;
  created_at: string;
};

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

/**
 * Sirf apne documents.
 *
 * RLS bhi ab own-row hai, par filter yahan bhi rakha hai — do reasons:
 * (1) RLS galat configure ho to bhi leak na ho, (2) count sahi rahe.
 */
export async function listDocuments(): Promise<Document[]> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return [];

  const { data, error } = await sb
    .from("documents")
    .select("*")
    .eq("user_id", uid)
    .order("expiry", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Document[];
}

export async function addDocument(input: {
  name: string;
  type: string;
  expiry: string | null;
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
      file_uri: input.file_uri ?? null,
      user_id: u.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Document;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await client().from("documents").delete().eq("id", id);
  if (error) throw error;
}
