import { supabase } from "./supabase";

/**
 * Saathi AI — sab kuch ek hi Supabase edge function `ai` se hota hai (Gemini pe).
 *
 * Jab tak GEMINI_API_KEY set nahi hai, chat ek fixed reply deta hai (stub) aur
 * reminder/scan local fallback pe chalte hain. Key set karte hi sab live —
 * app me koi change nahi karna padta.
 *
 * Chat call hone se message server-side `messages` table me record hota hai
 * (user_id ke saath) — referral ki "first chat" condition isi pe verify hoti hai.
 */

// Aakhri fallback — agar caller ne apni bhasha ka fallback na diya ho.
const STUB_REPLY =
  "Samajh gaya 👍 Isse yaad rakhne aur karne wala smart AI jald aa raha hai. Tab tak Documents aur Reminders tabs use karo!";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Chat ko user ka apna data pata ho — taaki "mere reminders kaun se hain?" ka jawab de. */
export type ChatContext = {
  reminders?: { title: string; when: string | null; on?: boolean }[];
  documents?: { name: string; type: string; expiry: string | null }[];
  today?: string;
};

type AskOpts = {
  /** User ki bhasha ka stub/fallback reply (dict se). */
  fallback?: string;
  /** User ka locale — server ko diya jaata hai taaki AI usi bhasha me jawab de. */
  locale?: string;
  /** User ka apna data (reminders/documents) — app-scoped jawab ke liye. */
  context?: ChatContext;
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
      body: {
        task: "chat",
        message,
        history,
        name,
        locale: opts.locale,
        context: opts.context,
      },
    });
    if (error) return fallback;
    const reply = (data as { reply?: string } | null)?.reply;
    return reply && reply.trim() ? reply : fallback;
  } catch {
    return fallback;
  }
}

/** Reminder text ko AI se samajho. Local logic time/date combine karta hai. */
export type ReminderAI = {
  title: string;
  /** ISO 8601 datetime ya null. */
  remind_at: string | null;
  label: string | null;
  needsDate: boolean;
  needsTime: boolean;
};

/**
 * Ek reminder = ek AI call. Text bhejo, structured samajh wapas lo.
 * Key/network fail ho to null — caller local UI (pickers) se aage badha sakta hai.
 */
export async function parseReminderAI(
  text: string,
  locale?: string,
): Promise<ReminderAI | null> {
  if (!supabase || !text.trim()) return null;
  try {
    const { data, error } = await supabase.functions.invoke("ai", {
      body: { task: "reminder", text, locale, now: new Date().toISOString() },
    });
    if (error || !data) return null;
    const r = data as Partial<ReminderAI> & { error?: string };
    if (r.error || typeof r.title !== "string") return null;
    return {
      title: r.title,
      remind_at: r.remind_at ?? null,
      label: r.label ?? null,
      needsDate: r.needsDate ?? !r.remind_at,
      needsTime: r.needsTime ?? !r.remind_at,
    };
  } catch {
    return null;
  }
}

/** Document image ko AI se padho. */
export type DocumentAI = {
  type: string;
  name: string;
  expiry: string | null;
  summary: string;
};

/**
 * Document image (base64) ko Gemini vision se samajho.
 * Fail/no-key ho to null — caller local OCR pe fallback kar sakta hai.
 */
export async function scanDocumentAI(
  base64: string,
  locale?: string,
  mime = "image/jpeg",
): Promise<DocumentAI | null> {
  if (!supabase || !base64) return null;
  try {
    const { data, error } = await supabase.functions.invoke("ai", {
      body: { task: "scan", image: base64, mime, locale },
    });
    if (error || !data) return null;
    const r = data as Partial<DocumentAI> & { error?: string };
    if (r.error) return null;
    return {
      type: r.type || "other",
      name: r.name || "",
      expiry: r.expiry ?? null,
      summary: r.summary || "",
    };
  } catch {
    return null;
  }
}
