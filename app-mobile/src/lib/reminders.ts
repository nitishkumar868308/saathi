import { supabase } from "./supabase";

export type Reminder = {
  id: string;
  title: string;
  time_label: string | null;
  remind_at: string | null; // ISO timestamp
  is_on: boolean;
  bucket: string; // 'today' | 'upcoming'
  created_at: string;
};

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai");
  return supabase;
}

export async function listReminders(): Promise<Reminder[]> {
  const { data, error } = await client()
    .from("reminders")
    .select("*")
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
  const { data, error } = await client()
    .from("reminders")
    .insert(input)
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
