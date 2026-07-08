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

const STUB_REPLY =
  "Samajh gaya 👍 Isse yaad rakhne aur karne wala smart AI jald aa raha hai. Tab tak Documents aur Reminders tabs use karo!";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Saathi se jawab lo. Network/config fail ho to bhi kuch na kuch lautata hai. */
export async function askSaathi(
  message: string,
  history: ChatTurn[] = [],
  name?: string,
): Promise<string> {
  if (!supabase) return STUB_REPLY;
  try {
    const { data, error } = await supabase.functions.invoke("ai", {
      body: { task: "chat", message, history, name },
    });
    if (error) return STUB_REPLY;
    const reply = (data as { reply?: string } | null)?.reply;
    return reply && reply.trim() ? reply : STUB_REPLY;
  } catch {
    return STUB_REPLY;
  }
}
