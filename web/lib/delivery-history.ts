/**
 * Ek user ka delivery itihaas — "kis kaam ke liye kya-kya gaya".
 *
 * ⚠️ Ye `delivery-check.ts` se ALAG hai, aur dono chahiye. Wo AAGE ki baat
 * karta hai ("is user ko WhatsApp jaayega ya nahi, aur nahi to kis wajah se") —
 * ek diagnostic. Ye PEECHE ki baat karta hai: jo ho chuka, wo sach me kya hua.
 *
 * Dono ek jagah dikhte hain kyunki support ka sawaal aksar dono ko chhoota hai:
 * "mujhe reminder nahi aaya" ka jawab ya to setup me hota hai (check), ya us din
 * sach me kya hua usme (itihaas).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Ek raaste ka nateeja. */
export type DeliveryChannelResult = {
  status: "sent" | "skipped" | "failed";
  reason: string | null;
  /** User ne ise sach me dekha — abhi sirf notification par bharta hai. */
  seen_at: string | null;
  detail: string | null;
};

/** Ek khabar — ek kaam, ek lamha, aur uske teen raaste. */
export type DeliveryHistoryRow = {
  kind: "reminder" | "document";
  item_id: string;
  /** Reminder ka title / document ka naam. Delete ho chuka ho to `null`. */
  item_name: string | null;
  due_at: string;
  /** Us WAQT ka plan — aaj ka nahi. */
  plan: "free" | "plus";
  /** Sirf wahi raaste jinpar kuch hua. Khaali khaana = koshish hi nahi hui. */
  channels: Partial<Record<"notification" | "email" | "whatsapp", DeliveryChannelResult>>;
};

export async function getDeliveryHistory(
  userId: string,
  limit = 40,
): Promise<DeliveryHistoryRow[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_delivery_log`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_user_id: userId, p_limit: limit }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `delivery history read failed: HTTP ${res.status} (supabase/delivery-log.sql run kiya?)`,
    );
  }
  const rows = (await res.json()) as DeliveryHistoryRow[] | null;
  return Array.isArray(rows) ? rows : [];
}
