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
  remind_at: string | null; // ISO timestamp
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
