import { supabase } from "./supabase";
import { reportError } from "./report-error";

/**
 * Admin ke bheje message par "maine khola" wapas batana.
 *
 * Admin panel ki Report screen ye poochti hai: kisne notification par tap kiya,
 * kaun bina khole chala gaya. Email ka jawab pixel se mil jaata hai, par phone
 * ki notification ka koi pixel nahi hota — sirf app hi bata sakti hai.
 *
 * Push ke `data` me `send_id` aata hai (`web/lib/fcm.ts`). Tap hote hi wahi id
 * server ko chali jaati hai. Server apni taraf se jaanch karta hai ki wo row
 * ISI user ki hai — isliye yahan se kuch galat bhejna kaam nahi karta.
 *
 * ⚠️ Ye poori tarah best-effort hai. Fail hona kabhi user ko dikhna nahi chahiye:
 * usne notification khol li hai, uska kaam ho chuka hai. Isliye har fail sirf
 * admin > Logs me jaata hai.
 */

/** Ek hi tap do raaste se aa sakta hai — dobara na ginein. */
const done = new Set<string>();

/** Push ke data payload me se send id nikaalo. */
export function sendIdFrom(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as Record<string, unknown>).send_id;
  return typeof raw === "string" && raw.length > 20 ? raw : null;
}

/**
 * Notification par tap hua — server ko bata do.
 *
 * ⚠️ Dedupe zaroori hai. Cold-start par ek hi tap DO jagah se aata hai:
 * `getInitialNotification()` se aur (kabhi-kabhi) `onNotificationOpenedApp` se.
 * Bina iske ek tap do baar ginta aur report me har user "2 baar khola" dikhata.
 */
export async function recordPushOpen(sendId: string | null): Promise<void> {
  if (!sendId || !supabase || done.has(sendId)) return;
  done.add(sendId);
  try {
    const { error } = await supabase.rpc("record_push_open", { p_send_id: sendId });
    // ⚠️ `supabase.rpc` fail par throw nahi karta — `{ error }` lauta deta hai.
    // Bina is check ke RPC ka na hona (migration na chali ho) bilkul chup rehta.
    if (error) throw error;
  } catch (e) {
    // Dobara koshish ho sake isliye nishaan hata dete hain.
    done.delete(sendId);
    reportError(e, { screen: "push", action: "record_push_open" }, "warn");
  }
}

/** Push ke data se seedha — sabse aam call. */
export function recordPushOpenFrom(data: unknown): void {
  void recordPushOpen(sendIdFrom(data));
}

/**
 * Notification tap ke baad user ko kahan le jaana hai.
 *
 * Abhi sirf support ke jawab ka apna thikana hai. Baaki (admin ka broadcast)
 * ka koi khaas panna nahi hota — app jahan thi wahin khulti hai, jo sahi hai:
 * ek khabar padhne ke liye user ko kisi nayi screen par pheknaa bura lagta hai.
 */
export function routeFromPush(data: unknown): { pathname: string; params?: Record<string, string> } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.kind === "support" && typeof d.ticket_id === "string" && d.ticket_id) {
    return { pathname: "/support", params: { ticketId: d.ticket_id } };
  }
  return null;
}
