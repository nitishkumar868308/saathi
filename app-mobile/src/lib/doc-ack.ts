import { supabase } from "./supabase";

/**
 * Document expiry notification ko user ne dekh/OK kiya — server pe record karo.
 * Isse WhatsApp reminder (#8) skip ho jaata hai (1 ghante wala follow-up nahi jaata).
 * Best-effort: RPC/table na ho to chup-chaap ignore.
 */
export async function acknowledgeDocument(docId: string): Promise<void> {
  if (!supabase || !docId) return;
  try {
    await supabase.rpc("acknowledge_document", { p_doc_id: docId });
  } catch {
    /* best-effort */
  }
}
