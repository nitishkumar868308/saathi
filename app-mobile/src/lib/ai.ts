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

/** Saathi chat se aane wala action — client execute karta hai (limits + notifications reuse). */
export type SaathiAction =
  | { type: "create_reminder"; title: string; remind_at: string }
  | { type: "navigate"; to: "add_document" };

export type SaathiReply = { reply: string; action: SaathiAction | null };

/** Abhi ka LOCAL time naive ISO me (bina Z) — server isi se remind_at nikaalta hai. */
function localNowIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/** Saathi se jawab lo. Network/config fail ho to bhi kuch na kuch lautata hai. */
export async function askSaathi(
  message: string,
  history: ChatTurn[] = [],
  name?: string,
  opts: AskOpts = {},
): Promise<SaathiReply> {
  const fallback = opts.fallback ?? STUB_REPLY;
  if (!supabase) return { reply: fallback, action: null };
  try {
    const { data, error } = await supabase.functions.invoke("ai", {
      body: {
        task: "chat",
        message,
        history,
        name,
        locale: opts.locale,
        context: opts.context,
        now: localNowIso(),
      },
    });
    if (error) return { reply: fallback, action: null };
    const d = data as { reply?: string; action?: SaathiAction | null } | null;
    const reply = d?.reply && d.reply.trim() ? d.reply : fallback;
    return { reply, action: d?.action ?? null };
  } catch {
    return { reply: fallback, action: null };
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
