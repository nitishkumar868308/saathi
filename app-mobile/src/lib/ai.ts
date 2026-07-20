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
