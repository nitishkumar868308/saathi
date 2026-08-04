import { supabase } from "./supabase";
import { aiCallEnded, aiCallStarted, isReachable, reportOnline } from "./network";
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
      /**
       * Pehli baar kab — ABSOLUTE time ("kal subah 8 baje"). Aage ka hisaab
       * client/server khud karte hain. Relative reminder me ye null hota hai.
       */
      remind_at: string | null;
      /**
       * "30 second baad", "5 minute baad" — ab se kitni der baad.
       *
       * ⚠️ Ye alag field isliye hai, aur yahi is file ka sabse zaroori design
       * faisla hai: **relative waqt ka hisaab CLIENT par hona chahiye, server par
       * nahi.** Server jis lamhe `remind_at` banata hai, wo lamha user tak
       * pahunchte-pahunchte 5-20 second purana ho chuka hota hai (AI ko sochne me
       * itna lagta hi hai). Absolute time par is der se kuch nahi bigadta, par
       * relative par poora matlab hi badal jaata hai — "30 second baad" wala
       * reminder aane se pehle hi beet chuka hota tha.
       *
       * Isliye: relative ho to server sirf GINTI bhejta hai, aur client jawab
       * milte hi `Date.now() + in_seconds` nikaal leta hai.
       */
      in_seconds?: number | null;
      /** Roz wala reminder — kitne din baad dobara. null = ek hi baar. */
      repeat_every_days?: number | null;
      /** Aakhri din (YYYY-MM-DD) — "90 din tak". null = koi limit nahi. */
      repeat_until?: string | null;
    }
  | { type: "navigate"; to: "add_document" };

/**
 * AI ka jawab kyun nahi aaya.
 *
 * ⚠️ Pehle yahan sirf ek `failed: boolean` tha, aur chat usse dekh ke seedha
 * "internet ne saath nahi diya" wala POORI SCREEN ka popup khol deta tha — awaaz
 * ke saath. Char bilkul alag cheezein ek hi shakl me dikhti thi: sach me offline
 * hona, Gemini ka 429, `GEMINI_API_KEY` ka set na hona, aur AI ka der karna.
 * Inme se teen ka internet se koi lena-dena hi nahi hai. Yahi wo "net theek hai
 * phir bhi internet wala message aata hai" wali shikayat ki jad thi.
 *
 * Ab har fail ki apni wajah hoti hai, aur `offline` ke alawa kisi par bhi wo
 * full-screen popup nahi khulta.
 */
export type AiFailure =
  /** Probe bhi fail — internet sach me nahi hai. Sirf yahi popup ke laayak hai. */
  | "offline"
  /** 429/503 — Gemini ya edge function bhara hua hai. Net theek hai. */
  | "busy"
  /** Baaki server-side galti (key nahi, function deploy nahi, 5xx). Net theek hai. */
  | "server"
  /** Timeout, par probe pass — AI ne der ki, net ne nahi. */
  | "slow";

export type SaathiReply = {
  reply: string;
  action: SaathiAction | null;
  /**
   * AI tak baat pahunchi hi nahi — `reply` sirf fallback text hai, Saathi ka
   * asli jawab nahi.
   *
   * ⚠️ Ye isliye hai kyunki pehle dono cheezein ek jaisi dikhti thi: net fail
   * hone par bhi wahi "main sirf reminders/documents me madad kar sakta hoon"
   * wala message aata tha. User ko lagta tha Saathi ne mana kar diya, jabki
   * asal me request pahunchi hi nahi thi (item 7 & 15).
   */
  failure?: AiFailure;
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

/**
 * Timeout ka apna error.
 *
 * ⚠️ Iska message pehle `"AI timeout — network"` tha — aur `net-alert.ts` ka
 * `isNetworkError()` "timeout" aur "network" DONO par match karta hai. Yaani AI
 * ka der se jawab dena definition se hi internet ki galti gina jaata tha, chahe
 * net fibre ka ho. Ab message me wo shabd nahi hai, aur wajah `classify()` ek
 * asli probe chala ke tay karta hai — shabd dekh ke nahi.
 */
class AiTimeoutError extends Error {
  constructor() {
    super("AI timeout");
    this.name = "AiTimeoutError";
  }
}

/** AI ka fail, apni asli wajah ke saath. */
class AiError extends Error {
  constructor(
    readonly kind: AiFailure,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Kisi bhi error se AI ki wajah nikaalo (na mile to server-side maano). */
function failureOf(e: unknown): AiFailure {
  return e instanceof AiError ? e.kind : "server";
}

/**
 * Promise ko time-box karo — der ho gayi to throw.
 *
 * ⚠️ Yahan pehle `timed()` lagta tha, yaani AI ka intezaar seedha "internet
 * dheema" banner chala deta tha. Gemini ko jawab BANANE me hi 5-20 second lagte
 * hain, chahe net fibre ka ho — wo intezaar network ka nahi, AI ke sochne ka
 * hai. Pehle ise 80% threshold se dabaya gaya tha, par wo sirf number badalna
 * tha: 25 second wali chat par banner ab bhi 20 second par aa jaata tha. Ab AI
 * us banner ko chhoo hi nahi sakti (doosri parat `callAi` ka `aiCallStarted()`
 * hai, jo doosri requests ko bhi rokta hai).
 *
 * `reportOnline()` phir bhi zaroori hai — jawab aa gaya matlab net chalu hai, aur
 * usse OS ka jhoota "offline" flag turant kat jaata hai.
 */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new AiTimeoutError()), ms);
  });
  try {
    const out = await Promise.race([work, guard]);
    reportOnline();
    return out;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Server ne jawab diya tha ya request pahunchi hi nahi?
 *
 * Status ka hona apne aap me ek badi khabar hai: iska matlab hai ki request
 * server tak gayi AUR jawab wapas aaya — yaani **internet bilkul theek hai**,
 * galti doosre chhor ki hai. `classify()` ka aadha kaam yahi batata hai.
 */
function statusOf(e: unknown): number | null {
  const ctx = (e as { context?: unknown })?.context as Response | undefined;
  return ctx && typeof ctx.status === "number" ? ctx.status : null;
}

/**
 * Fail ki asli wajah — shabd dekh ke nahi, saboot dekh ke.
 *
 * ⚠️ Yahi wo jagah hai jiske na hone se poori shikayat paida hoti thi. Pehle har
 * fail seedha "internet ne saath nahi diya" ban jaata tha. Ab:
 *   - status mila     → server bola, net theek hai (429/503 = busy, baaki = server)
 *   - status nahi mila → probe chalao. Probe pass = net theek hai; fail = offline.
 */
async function classify(e: unknown): Promise<AiFailure> {
  const status = statusOf(e);
  if (status !== null) return status === 429 || status === 503 ? "busy" : "server";
  // Na status, na jawab — ya timeout, ya request nikli hi nahi. Net ko jaancho.
  if (!(await isReachable())) return "offline";
  return e instanceof AiTimeoutError ? "slow" : "server";
}

/**
 * Edge function ka ASLI karan nikalo.
 *
 * ⚠️ `supabase.functions.invoke` har fail par ek hi bemtlab ka message deta hai:
 * "Edge Function returned a non-2xx status code". Asli baat — function deploy hi
 * nahi hui, GEMINI_API_KEY nahi hai, Gemini ne 429 diya — response body me hoti
 * hai, jo `error.context` (ek Response) me chhupi rehti hai. Bina isse padhe
 * har AI fail ek jaisa dikhta hai aur kuch pata nahi chalta.
 *
 * ⚠️ Ye response ka body PADH leta hai, jo ek hi baar padha ja sakta hai —
 * isliye `classify()` (jo sirf `status` dekhta hai) hamesha isse PEHLE chalna
 * chahiye.
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
 * Ek AI call.
 *
 * **Dobara koshish sirf turant toote connection par.** Dheeme net par pehli
 * request kabhi-kabhi seconds me hi toot jaati hai; wahan ek chhoti si retry
 * sach me kaam bacha leti hai.
 *
 * ⚠️ Par pehle retry HAR fail par hoti thi — timeout par bhi. Timeout ka matlab
 * hai hum pehle hi poore 25 second de chuke hain; 25 aur dena sazaa hai. Chat me
 * iska seedha nateeja ye tha ki user 50+ second tak latka rehta tha, do baar
 * "internet dheema" banner dekhta tha, aur aakhir me full-screen internet wala
 * popup — jabki net bilkul theek tha. Ab timeout ya HTTP status wale fail par
 * dobara nahi bhejte: dono ka matlab hai ki request pahunch chuki thi.
 *
 * `aiCallStarted/Ended` poore is call ke dauraan slow-banner band rakhta hai —
 * app ki KISI bhi doosri request se bhi. Wahi cross-talk tha jisse "AI use karte
 * hi internet slow ho jaata hai" wala ehsaas banta tha.
 */
async function callAi<T>(
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  if (!supabase) throw new AiError("server", "supabase not configured");

  aiCallStarted();
  try {
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
        // Server tak baat pahunch chuki thi (timeout ya status) — dobara bhejna
        // sirf intezaar lamba karega, kaamyabi ka mauka nahi badhayega.
        if (e instanceof AiTimeoutError || statusOf(e) !== null) break;
        // Thoda ruk ke dobara — turant retry usi toote connection par jaata hai.
        await new Promise((r) => setTimeout(r, 700));
      }
    }

    const kind = await classify(lastErr);
    // ⚠️ Har caller ka catch khaali tha (`catch { return null }`), isliye "AI kahin
    // bhi kaam nahi kar raha" ka koi nishaan kahin nahi bachta tha — na app me, na
    // admin > Logs me. Ab har fail apne asli message ke saath wahan dikhta hai.
    const described = await describeError(lastErr);
    reportError(described, { screen: "ai", action: String(body.task ?? "unknown") }, "warn");
    throw new AiError(
      kind,
      described instanceof Error ? described.message : String(described),
    );
  } finally {
    aiCallEnded();
  }
}

/**
 * Abhi ka LOCAL time naive ISO me (bina Z) — server isi se remind_at nikaalta hai.
 *
 * ⚠️ Seconds pehle hardcoded `:00` the, yaani AI ko hamesha ek aisa waqt milta
 * tha jo 0-59 second PEECHE hota tha. Absolute time ("10:45 am") par isse kuch
 * fark nahi padta, isliye ye kabhi pakda nahi gaya. Par har RELATIVE reminder
 * utna hi jaldi baj jaata tha — aur "30 second baad" to bilkul hi kaam nahi
 * karta tha: AI ka nikala hua time aane se pehle hi beet chuka hota tha, aur
 * chat use "beeta hua time" maan ke Add-reminder screen par phenk deti thi.
 */
function localNowIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Saathi se jawab lo. Network/config fail ho to bhi kuch na kuch lautata hai. */
export async function askSaathi(
  message: string,
  history: ChatTurn[] = [],
  name?: string,
  opts: AskOpts = {},
): Promise<SaathiReply> {
  const fallback = opts.fallback ?? STUB_REPLY;
  // Key hi set nahi hai — ye setup ki galti hai, internet ki nahi.
  if (!supabase) return { reply: fallback, action: null, failure: "server" };
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
  } catch (e) {
    // Yahan pahunchna hamesha "baat pahunchi hi nahi" hai. `failure` se caller
    // sahi baat aur retry dikha deta hai — decline message nahi.
    return { reply: fallback, action: null, failure: failureOf(e) };
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
