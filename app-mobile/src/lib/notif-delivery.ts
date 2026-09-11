import { supabase } from "./supabase";

/**
 * "Notification sach me user tak pahunchi" — server par record.
 *
 * ── Ye app me kyun hai, server me kyun nahi ────────────────────────────
 *
 * ⚠️ Reminder aur expiry ki notification SERVER bhejta hi nahi. App use phone
 * par khud local schedule karti hai (`scheduleReminderSeries`,
 * `scheduleDocumentExpiry`). Cron ko sirf email aur WhatsApp ka pata hota hai.
 *
 * Isliye admin panel me "notification gaya ✅" likhne ka koi sach server ke paas
 * tha hi nahi — aur andaza likh dena us poore panel ko jhootha bana deta. Free
 * plan wale user ke liye to notification hi IKLAUTA raasta hai, yaani theek wahi
 * khaana khaali rehta jo sabse zyada poochha jaata hai.
 *
 * Sach app ke paas hai, aur sabse pakke roop me: full-screen alert ka DIKHNA hi
 * saboot hai ki notification baji aur user ke saamne aayi. Wahi lamha yahan
 * likha jaata hai.
 *
 * ⚠️ `dueIso` wo waqt hai jis par alarm LAGA tha — `Date.now()` nahi. Yahi baat
 * is poore raaste ko jodti hai: cron bhi usi lamhe par apni row likhta hai
 * (`remind_at` / expiry ka notice-moment), aur dono ek hi row par milti hain.
 * `now` bhejne par har khabar do tukdon me bant jaati — ek me notification,
 * doosre me email/WhatsApp — aur admin ko kabhi poori tasveer na dikhti.
 */
export async function logNotificationSeen(
  kind: "reminder" | "document",
  itemId: string,
  dueIso: string,
  /** User ne uspar kuch dabaya (OK / ho gaya) — sirf dikhna nahi. */
  seen: boolean,
): Promise<void> {
  if (!supabase || !itemId || !dueIso) return;
  try {
    await supabase.rpc("log_notification", {
      p_kind: kind,
      p_item_id: itemId,
      p_due_at: dueIso,
      p_seen: seen,
    });
  } catch {
    /* best-effort — khabar rakhna khabar dene se zyada zaroori nahi */
  }
}
