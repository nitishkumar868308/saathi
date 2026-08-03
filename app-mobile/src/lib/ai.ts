import { supabase } from "./supabase";
import { timed } from "./network";
import { reportError } from "./report-error";

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
  | {
      type: "create_reminder";
      title: string;
      /** Pehli baar kab. Aage ka hisaab client/server khud karte hain. */
      remind_at: string;
      /** Roz wala reminder — kitne din baad dobara. null = ek hi baar. */
      repeat_every_days?: number | null;
      /** Aakhri din (YYYY-MM-DD) — "90 din tak". null = koi limit nahi. */
      repeat_until?: string | null;
    }
  | { type: "navigate"; to: "add_document" };

export type SaathiReply = {
  reply: string;
  action: SaathiAction | null;
  /**
   * AI tak baat pahunchi hi nahi (net/timeout/server) — `reply` sirf fallback
   * text hai, Saathi ka asli jawab nahi.
   *
   * ⚠️ Ye flag isliye hai kyunki pehle dono cheezein ek jaisi dikhti thi: net
   * fail hone par bhi wahi "main sirf reminders/documents me madad kar sakta
   * hoon" wala message aata tha. User ko lagta tha Saathi ne mana kar diya,
   * jabki asal me request pahunchi hi nahi thi (item 7 & 15).
   */
  failed?: boolean;
};

/**
 * AI call kitni der tak intezaar kare.
 *
 * Bina limit ke edge function kabhi-kabhi 30-60s tak latak jaati thi aur user ke
 * saamne loader ghoomta rehta tha. Ab tay hai: itne me jawab na aaya to fallback
 * de do — user ko rukna nahi padega. Chat me thoda zyada (jawab lamba hota hai),
 * reminder parse me kam (waha aage local pickers hain hi).
 */
const CHAT_TIMEOUT_MS = 25_000;
const TASK_TIMEOUT_MS = 15_000;

/** Timeout ka apna error — caller ise net-failure maan sakta hai. */
class AiTimeoutError extends Error {
  constructor() {
    super("AI timeout — network");
    this.name = "AiTimeoutError";
  }
}

/**
 * "Internet dheema" banner AI ke liye kab sach hai.
 *
 * ⚠️ Pehle yahan network.ts ka 4-second wala default lagta tha, aur wahi sabse
 * zyada dohrayi jaane wali shikayat ki jad tha: "net bilkul theek hai, phir bhi
 * slow-internet wala aa jaata hai". Baat seedhi hai — Gemini ko jawab BANANE me
 * hi 5–15 second lagte hain. Wo intezaar network ka nahi, AI ke sochne ka hai,
 * aur usse net ki dikkat batana galat hi tha.
 *
 * Ab threshold har call ke apne timeout se nikalta hai: 80% par pahunch gaye
 * matlab ye request sach me marne wali hai — tabhi banner sach bolta hai.
 */
const SLOW_AT = 0.8;

/** Promise ko time-box karo — der ho gayi to throw. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new AiTimeoutError()), ms);
  });
  try {
    return await timed(Promise.race([work, guard]), Math.round(ms * SLOW_AT));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Edge function ka ASLI karan nikalo.
 *
 * ⚠️ `supabase.functions.invoke` har fail par ek hi bemtlab ka message deta hai:
 * "Edge Function returned a non-2xx status code". Asli baat — function deploy hi
 * nahi hui, GEMINI_API_KEY nahi hai, Gemini ne 429 diya — response body me hoti
 * hai, jo `error.context` (ek Response) me chhupi rehti hai. Bina isse padhe
 * har AI fail ek jaisa dikhta hai aur kuch pata nahi chalta.
 */
async function describeError(e: unknown): Promise<unknown> {
  const ctx = (e as { context?: unknown })?.context as Response | undefined;
  if (!ctx || typeof ctx.text !== "function") return e;
  const msg = e instanceof Error ? e.message : String(e);
  try {
    const text = (await ctx.text()).slice(0, 300);
    // Status message me hi rakhte hain — `reportError` sirf Error ka `message`
    // uthata hai, uske upar chipkaye fields nahi.
    return new Error(text ? `${msg} [${ctx.status}] — ${text}` : `${msg} [${ctx.status}]`);
  } catch {
    // Body pehle hi padhi ja chuki hai — status hi kaafi hai.
    return new Error(`${msg} [${ctx.status}]`);
  }
}

/**
 * Ek AI call, do koshish.
 *
 * Dheeme net par pehli request aksar beech me toot jaati hai — aur wahi "AI kaam
 * nahi kar raha" wali shikayat banti thi. Ek chhoti si dobara-koshish 90% aise
 * cases nikaal deti hai. Do se zyada nahi: usse user ka intezaar hi lamba hoga.
 */
async function callAi<T>(
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  if (!supabase) throw new Error("supabase not configured");
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("ai", { body }),
        timeoutMs,
      );
      if (error) throw error;
      return data as T;
    } catch (e) {
      lastErr = e;
      // Aakhri koshish thi — aage error hi jayega.
      if (attempt === 1) break;
      // Thoda ruk ke dobara — turant retry usi toote connection par jaata hai.
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  // ⚠️ Har caller ka catch khaali tha (`catch { return null }`), isliye "AI kahin
  // bhi kaam nahi kar raha" ka koi nishaan kahin nahi bachta tha — na app me, na
  // admin > Logs me. Ab har fail apne asli message ke saath wahan dikhta hai.
  reportError(
    await describeError(lastErr),
    { screen: "ai", action: String(body.task ?? "unknown") },
    "warn",
  );
  throw lastErr;
}

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
  if (!supabase) return { reply: fallback, action: null, failed: true };
  try {
    const d = await callAi<{ reply?: string; action?: SaathiAction | null } | null>(
      {
        task: "chat",
        message,
        history,
        name,
        locale: opts.locale,
        context: opts.context,
        now: localNowIso(),
      },
      CHAT_TIMEOUT_MS,
    );
    const reply = d?.reply && d.reply.trim() ? d.reply : fallback;
    // Server ne jawab to diya — ye AI ki apni baat hai, net ki nahi.
    return { reply, action: d?.action ?? null };
  } catch {
    // Yahan pahunchna hamesha "baat pahunchi hi nahi" hai. `failed` se caller
    // retry dikha deta hai — decline message nahi.
    return { reply: fallback, action: null, failed: true };
  }
}

/** Reminder text ko AI se samajho. Local logic time/date combine karta hai. */
export type ReminderAI = {
  title: string;
  /** ISO 8601 datetime ya null — PEHLI baar ka time. */
  remind_at: string | null;
  label: string | null;
  needsDate: boolean;
  needsTime: boolean;
  /** Roz wala reminder — kitne din baad dobara. null = ek hi baar. */
  repeat_every_days: number | null;
  /** Aakhri din (YYYY-MM-DD). null = jab tak user khud band na kare. */
  repeat_until: string | null;
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
    const data = await callAi<(Partial<ReminderAI> & { error?: string }) | null>(
      { task: "reminder", text, locale, now: new Date().toISOString() },
      TASK_TIMEOUT_MS,
    );
    if (!data) return null;
    const r = data;
    if (r.error || typeof r.title !== "string") return null;
    return {
      title: r.title,
      remind_at: r.remind_at ?? null,
      label: r.label ?? null,
      needsDate: r.needsDate ?? !r.remind_at,
      needsTime: r.needsTime ?? !r.remind_at,
      repeat_every_days: r.repeat_every_days ?? null,
      repeat_until: r.repeat_until ?? null,
    };
  } catch {
    // Net/timeout — caller local parser par chalta rehta hai, isliye `null` hi
    // theek hai. Screen kabhi khaali nahi rehti.
    return null;
  }
}

/**
 * Expiry alert ke baad ka follow-up — "ye kaam ho gaya kya?" (item 18).
 *
 * Lines AI banata hai, static nahi: passport "renew" hota hai, insurance "phir
 * se karana" hota hai, warranty bas khatam ho jaati hai. Ek hi ratta-lagaya
 * wakya teenon par bhadda lagta hai.
 *
 * Fail ho to null — screen apni default lines dikha deti hai, flow rukta nahi.
 */
export type DocFollowUp = {
  ask: string | null;
  done: string | null;
  later: string | null;
  addNew: string | null;
};

export async function documentFollowUp(
  doc: { name: string; type?: string; expiry?: string | null },
  locale?: string,
): Promise<DocFollowUp | null> {
  if (!supabase || !doc?.name) return null;
  try {
    const data = await callAi<DocFollowUp | null>(
      { task: "docfollow", document: doc, locale, now: new Date().toISOString().slice(0, 10) },
      TASK_TIMEOUT_MS,
    );
    if (!data?.ask) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Subah ka daily brief — Saathi apne shabdon me, aaj ke data se (Plus feature).
 *
 * ⚠️ Ye server par kab se bana pada tha (`task: "brief"`) par app ne use kabhi
 * bulaya hi nahi. Home ka card ek fixed template line dikhata tha ("aapke {n}
 * documents ko dhyan chahiye") — free aur Plus dono ko bilkul ek jaisi. Yaani
 * "Subah ka daily brief" bech to rahe the, milta kisi ko nahi tha.
 *
 * Fail ho to null — home apni purani template line dikha deta hai. Brief ek
 * upar wali cheez hai; uske liye screen kabhi khaali nahi rehni chahiye.
 */
export async function dailyBrief(
  data: {
    reminders: { title: string; when: string | null }[];
    documents: { name: string; expiry: string | null }[];
    today: string;
  },
  name?: string,
  locale?: string,
): Promise<string | null> {
  if (!supabase) return null;
  try {
    const d = await callAi<{ brief?: string } | null>(
      { task: "brief", data, name, locale },
      TASK_TIMEOUT_MS,
    );
    const brief = d?.brief?.trim();
    return brief ? brief : null;
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
    const data = await callAi<(Partial<DocumentAI> & { error?: string }) | null>(
      { task: "scan", image: base64, mime, locale },
      // Image bhejni hai — scan ko thodi zyada mohlat.
      TASK_TIMEOUT_MS * 2,
    );
    if (!data) return null;
    const r = data;
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
