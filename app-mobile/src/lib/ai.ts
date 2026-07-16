import { supabase } from "./supabase";

/**
 * Saathi chat.
 *
 * Abhi stub mode: Supabase edge function `ai` bina ANTHROPIC_API_KEY ke ek fixed
 * reply deta hai. Key set karte hi wahi function asli Claude Haiku se jawab dega —
 * app me koi change nahi karna padega.
 *
 * Function call hone se message server-side `messages` table me record hota hai
 * (user_id ke saath) — referral ki "first chat" condition isi pe verify hoti hai.
 */

// Aakhri fallback — agar caller ne apni bhasha ka fallback na diya ho.
const STUB_REPLY =
  "Samajh gaya 👍 Isse yaad rakhne aur karne wala smart AI jald aa raha hai. Tab tak Documents aur Reminders tabs use karo!";

export type ChatTurn = { role: "user" | "assistant"; content: string };

type AskOpts = {
  /** User ki bhasha ka stub/fallback reply (dict se). */
  fallback?: string;
  /** User ka locale — server ko diya jaata hai taaki Claude usi bhasha me jawab de. */
  locale?: string;
};

export type AiReminder = { title: string | null; remind_at: string | null };

/**
 * Reminder text ko AI se samjhao (edge "reminder" task → Claude).
 * Best-effort: key/network na ho to `null`. Local parser jo na samajh paaye,
 * uske gaps ye bhar deta hai; phir bhi kuch missing ho to screen user se poochti.
 */
export async function aiParseReminder(
  text: string,
  locale?: string,
): Promise<AiReminder | null> {
  if (!supabase || !text.trim()) return null;
  try {
    const { data, error } = await supabase.functions.invoke("ai", {
      body: { task: "reminder", text, locale, now: new Date().toISOString() },
    });
    if (error || !data) return null;
    const d = data as { title?: string; remind_at?: string | null };
    return { title: d.title?.trim() || null, remind_at: d.remind_at ?? null };
  } catch {
    return null;
  }
}

/** Saathi se jawab lo. Network/config fail ho to bhi kuch na kuch lautata hai. */
export async function askSaathi(
  message: string,
  history: ChatTurn[] = [],
  name?: string,
  opts: AskOpts = {},
): Promise<string> {
  const fallback = opts.fallback ?? STUB_REPLY;
  if (!supabase) return fallback;
  try {
    const { data, error } = await supabase.functions.invoke("ai", {
      body: { task: "chat", message, history, name, locale: opts.locale },
    });
    if (error) return fallback;
    const reply = (data as { reply?: string } | null)?.reply;
    return reply && reply.trim() ? reply : fallback;
  } catch {
    return fallback;
  }
}
