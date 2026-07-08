import { supabase } from "./supabase";

export type Reminder = {
  id: string;
  title: string;
  time_label: string | null;
  remind_at: string | null; // ISO timestamp
  is_on: boolean;
  bucket: string; // 'today' | 'upcoming'
  user_id: string | null;
  created_at: string;
};

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
  time_label: string | null;
  remind_at: string | null;
  bucket: string;
}): Promise<Reminder> {
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
