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
  created_at: string;
};

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

export async function listDocuments(): Promise<Document[]> {
  const { data, error } = await client()
    .from("documents")
    .select("*")
    .order("expiry", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Document[];
}

export async function addDocument(input: {
  name: string;
  type: string;
  expiry: string | null;
}): Promise<Document> {
  // Free plan limit check
  if (!(await canAddDocument())) throw new DocLimitError();

  const { data, error } = await client()
    .from("documents")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Document;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await client().from("documents").delete().eq("id", id);
  if (error) throw error;
}
