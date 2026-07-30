import { supabase } from "./supabase";
import { canAddReminder, FREE_REMINDER_LIMIT } from "./plan";

export type Reminder = {
  id: string;
  title: string;
  /**
   * User ne apne shabdon me jo likha/bola tha. Title AI se saaf kiya hua chhota
   * version hota hai; note poora context rakhta hai taaki reminder email/WhatsApp
   * me sirf "Test" na jaye — user ko padh ke samajh aa jaye kis baare me tha.
   */
  note: string | null;
  time_label: string | null;
  /**
   * AGLI baar kab (ISO timestamp).
   *
   * ⚠️ Roz wale reminder me ye har occurrence ke baad aage sarak jaata hai —
   * "wo ek baar kab tha" nahi. Purani screens jo isse "reminder ka time" maanti
   * thi wo ab bhi theek chalti hain, kyunki agla time bhi wahi time-of-day hota
   * hai, bas din badalta hai.
   */
  remind_at: string | null;
  /** Kitne din baad dobara. null/0 = ek hi baar. 1 = roz, 7 = har hafte. */
  repeat_every_days: number | null;
  /** Aakhri din (YYYY-MM-DD). null = jab tak user khud band na kare. */
  repeat_until: string | null;
  /** Aaj ka "ho gaya" kab hua. Roz wale me ye sirf ek din ke liye ginta hai. */
  last_done_at: string | null;
  is_on: boolean;
  /** Plus expire hone pe 5 se aage ke reminders paused ho jaate hain. */
  is_paused: boolean;
  bucket: string; // 'today' | 'upcoming'
  user_id: string | null;
  created_at: string;
};

/** Free limit (5) cross karne pe. */
export class ReminderLimitError extends Error {
  constructor() {
    super(
      `Free plan me sirf ${FREE_REMINDER_LIMIT} active reminders. Unlimited ke liye Saathi Plus lo.`,
    );
    this.name = "ReminderLimitError";
  }
}

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai");
  return supabase;
}

/** Sirf apne reminders (RLS ke saath double safety). */
export async function listReminders(): Promise<Reminder[]> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return [];

  const { data, error } = await sb
    .from("reminders")
    .select("*")
    .eq("user_id", uid)
    .order("remind_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Reminder[];
}

export async function addReminder(input: {
  title: string;
  note?: string | null;
  time_label: string | null;
  remind_at: string | null;
  bucket: string;
  /** Roz/har-hafte wala reminder — kitne din baad dobara. */
  repeat_every_days?: number | null;
  /** Aakhri din (YYYY-MM-DD) — "90 din tak" wali baat. */
  repeat_until?: string | null;
}): Promise<Reminder> {
  // Free plan limit (5) — Plus na ho to naya reminder block.
  if (!(await canAddReminder())) throw new ReminderLimitError();

  const sb = client();
  // WhatsApp/email reminder ke liye backend ko user chahiye.
  const { data: u } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("reminders")
    .insert({ ...input, user_id: u.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Reminder;
}

export async function setReminderOn(id: string, is_on: boolean): Promise<void> {
  const { error } = await client().from("reminders").update({ is_on }).eq("id", id);
  if (error) throw error;
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await client().from("reminders").delete().eq("id", id);
  if (error) throw error;
}

/** Reminder roz/har-hafte chalta hai? (UI isi se "Roz" wala tag dikhata hai.) */
export function isRepeating(r: Pick<Reminder, "repeat_every_days">): boolean {
  return !!r.repeat_every_days && r.repeat_every_days >= 1;
}

/**
 * User ne kaha "ye kaam ho gaya".
 *
 * Roz wale reminder me ye SIRF AAJ ka kaam band karta hai — kal wahi time phir
 * aayega. Ek baar wale reminder me poora reminder off ho jaata hai. Dono ka
 * hisaab server (`complete_reminder`) karta hai, taaki app aur cron kabhi alag
 * din na nikalein.
 *
 * Lautata hai: agli baar kab — ya null, agar series khatam ho gayi.
 */
export async function completeReminder(id: string): Promise<string | null> {
  const { data, error } = await client().rpc("complete_reminder", { p_id: id });
  if (error) throw error;
  return (data as string | null) ?? null;
}
