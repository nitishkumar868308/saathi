import { supabase } from "./supabase";
import { cancelDocumentExpiry } from "./notifications";

/**
 * Document expiry notification ko user ne dekh/OK kiya — server pe record karo.
 * Isse WhatsApp reminder (#8) skip ho jaata hai (follow-up nahi jaata).
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

/**
 * User ne kaha "kaam ho gaya" (item 18).
 *
 * Dekh lena aur kar lena do alag baatein hain: `acknowledgeDocument` sirf ek
 * moment ka WhatsApp rokta hai, ye us document ke AAGE ke saare reminder band
 * kar deta hai — phone ke local alarm bhi, aur server ka email/WhatsApp bhi.
 */
export async function renewDocument(docId: string): Promise<void> {
  if (!docId) return;
  // Local alarm pehle — ye bina net ke bhi chalta hai, aur yahi user ko sabse
  // pehle dikhta hai. Server fail bhi ho jaye to phone chup ho jaata hai.
  await cancelDocumentExpiry(docId).catch(() => {});
  if (!supabase) return;
  try {
    await supabase.rpc("renew_document", { p_doc_id: docId });
  } catch {
    /* best-effort */
  }
}
