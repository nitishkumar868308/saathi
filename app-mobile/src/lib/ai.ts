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
  /**
   * Kahin le jao — screen kholna.
   *
   * ⚠️ Pehle yahan sirf `add_document` tha, aur wahi is poori file ki sabse badi
   * kami thi. User chat me kuch bhi kehta ("profile kholo", "notes dikhao",
   * "settings me le chalo") aur Saathi ek lamba jawab likh deta ki khud kaise
   * jaana hai — jabki wo ek tap door tha. Bujurg user ke liye wo jawab bekaar
   * hai: use raasta yaad nahi rakhna, use wahan PAHUNCHNA hai.
   */
  | {
      type: "navigate";
      to:
        | "add_document"
        | "add_reminder"
        | "documents"
        | "reminders"
        | "notes"
        | "profile"
        | "settings"
        | "app_lock"
        | "support"
        | "upgrade";
    }
  /**
   * App ki setting badlo — theme, bhasha, alert ki awaaz.
   *
   * ⚠️ Ye teenon jaan-boojh ke chuni gayi hain: teenon poori tarah IS PHONE ki
   * hain aur inhe badalne se kuch khoya nahi ja sakta (ulta karna ek shabd door
   * hai). Documents delete karna, plan badalna ya number badalna yahan
   * JAAN-BOOJH KE nahi hai — un sab ka ulta karna aasan nahi hai, aur AI ke
   * galat samajhne ka nuksaan wahan wapas nahi aata.
   *
   * User ne theek pakda tha: "profile me jo setting hai wo change karne ka
   * bolta hoon to wo nahi karta". Saathi keh deta tha "main aapke phone ki
   * settings nahi badal sakta" — jo APP ki apni settings ke liye sach hi nahi
   * tha.
   */
  | { type: "set_theme"; value: "light" | "dark" | "system" }
  | { type: "set_language"; value: "hinglish" | "hi" | "en" }
  | { type: "set_alert_mode"; value: "ring" | "vibrate" | "silent" };

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
/**
 * Date → naive LOCAL ISO (`2026-08-13T20:00:00`), bina `Z` aur bina offset.
 *
 * ⚠️ Ye `export` hai, aur uski wajah ek asli bug hai jise user ne theek pakda:
 * **"chat se pichhle reminder ka time poocho to wo galat time batata hai."**
 *
 * Prompt me "abhi ka time" to yahin se (local) jaata tha — wo hissa sahi tha.
 * Par uske saath jo `context` jaata hai usme reminders ka `when` seedha DB ka
 * `remind_at` hota tha, yaani **UTC** (`2026-08-13T14:30:00.000Z`). Model ke
 * saamne ek hi prompt me do alag timezone rakh dena, aur ummeed karna ki wo
 * khud jod-ghata lega — wo kabhi nahi hota. Wo `Z` wali ginti seedha padh ke
 * bol deta tha, aur India me har jawab **theek 5:30 ghante peeche** hota tha.
 *
 * Isliye ab context me jaane wala har waqt isi shakl me jaata hai. Ek hi
 * timezone, jise samajhne ke liye model ko kuch karna hi nahi padta.
 *
 * `Z` jaan-boojh ke nahi lagate: server ka prompt in dono ko "user ke apne waqt"
 * ki tarah padhta hai, aur usi shakl me `remind_at` wapas maangta hai.
 */
export function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Abhi ka waqt, naive local ISO me. */
export function localNowIso(): string {
  return localIso(new Date());
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
 * Reminder parse ka nateeja — samajh, ya na samajh paane ki WAJAH.
 *
 * ⚠️ Pehle `parseReminderAI` sirf `ReminderAI | null` lautata tha, aur `null`
 * ka koi matlab nahi tha. Add-reminder screen us `null` par bilkul chup reh
 * jaati thi: user text likhta, patli patti chalti, ruk jaati, aur screen par
 * kuch nahi hota. Chaar bilkul alag halaat ek jaisi dikhti thi — net band,
 * Gemini bhara hua, key set nahi, aur AI ka sach me na samajh paana. User ke
 * liye chaaron ka ek hi matlab tha: "AI kuch karta hi nahi". Ab wajah bahar
 * aati hai aur screen usi hisaab se saaf baat kehti hai.
 */
export type ReminderParse =
  | { ok: true; data: ReminderAI }
  | { ok: false; failure: AiFailure };

/**
 * Ek reminder = ek AI call. Text bhejo, structured samajh wapas lo.
 * Fail ho to wajah ke saath — caller local UI (pickers) se aage badha sakta hai.
 */
export async function parseReminderAI(
  text: string,
  locale?: string,
): Promise<ReminderParse> {
  if (!supabase) return { ok: false, failure: "server" };
  if (!text.trim()) return { ok: false, failure: "server" };
  try {
    const data = await callAi<(Partial<ReminderAI> & { error?: string }) | null>(
      /**
       * ⚠️ `now` LOCAL me — `toISOString()` (UTC) me nahi.
       *
       * Server ka prompt saaf likhta hai "Abhi ka time (ISO, user ke timezone
       * me)", par yahan se UTC ja raha tha. India me iska matlab tha ki AI ko
       * hamesha 5:30 ghante purana waqt milta tha — aur uska sabse bura roop
       * raat me dikhta: 11 baje bola gaya "kal subah 8 baje" AI ke liye abhi
       * 5:30 shaam tha, yaani "kal" ka matlab hi ek din khisak jaata.
       */
      { task: "reminder", text, locale, now: localNowIso() },
      TASK_TIMEOUT_MS,
    );
    // Server ne jawab to diya, par usme samajh nahi thi — ye AI ki apni baat
    // hai, net ki nahi.
    const title = data?.title;
    if (!data || data.error || typeof title !== "string") {
      return { ok: false, failure: "server" };
    }
    const r = data;
    return {
      ok: true,
      data: {
        title,
        remind_at: r.remind_at ?? null,
        label: r.label ?? null,
        needsDate: r.needsDate ?? !r.remind_at,
        needsTime: r.needsTime ?? !r.remind_at,
        repeat_every_days: r.repeat_every_days ?? null,
        repeat_until: r.repeat_until ?? null,
      },
    };
  } catch (e) {
    // Net/timeout — caller local pickers par chalta rehta hai, screen kabhi
    // khaali nahi rehti. Par ab use wajah bhi pata hai.
    return { ok: false, failure: failureOf(e) };
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
      // Aaj ki taarikh LOCAL din se — UTC se lene par raat 12 se 5:30 ke beech
      // "aaj" kal ki date ban jaata tha.
      { task: "docfollow", document: doc, locale, now: localNowIso().slice(0, 10) },
      TASK_TIMEOUT_MS,
    );
    if (!data?.ask) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Din ka hissa — brief ko "abhi" ka pata isi se chalta hai.
 *
 * ⚠️ Ye bantwara sirf greeting ke liye nahi hai. Home ka cache bhi isi par
 * bandha hai, isliye din me char baar brief apne aap taaza ho jaata hai.
 */
export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function dayPart(d = new Date()): DayPart {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

/**
 * Aaj ka brief — Saathi apne shabdon me, aaj ke data se (Plus feature).
 *
 * ⚠️ Ye server par kab se bana pada tha (`task: "brief"`) par app ne use kabhi
 * bulaya hi nahi. Home ka card ek fixed template line dikhata tha ("aapke {n}
 * documents ko dhyan chahiye") — free aur Plus dono ko bilkul ek jaisi. Yaani
 * "Subah ka daily brief" bech to rahe the, milta kisi ko nahi tha.
 *
 * ── Aur ye "MORNING brief" nahi hai ────────────────────────────────────────
 *
 * ⚠️ Pehle yahan waqt bheja hi nahi jaata tha — sirf `today` (taarikh). Server
 * ka prompt bhi "morning brief" maangta tha. Nateeja bilkul wahi tha jo user ne
 * pakda: subah 6 baje ka reminder nipat chuka hai, par 1 baje app kholne par
 * card ab bhi "chalo gym jao" keh raha hai. AI ke paas ye jaanne ka koi tareeka
 * hi nahi tha ki abhi kitne baje hain — na wo greeting badal sakta tha, na ye
 * bata sakta tha ki kaunsa kaam beet chuka hai.
 *
 * Ab local waqt aur din ka hissa dono jaate hain. Aur Home ka cache bhi din ke
 * hisse par bandha hai, warna subah bana hua brief poore din chipka rehta.
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
      {
        task: "brief",
        data,
        name,
        locale,
        // ⚠️ LOCAL waqt (bina Z). UTC bhejne par bharat me shaam ka brief
        // "dopahar" ban jaata hai — 5:30 ka farak theek is jagah kaat-ta hai.
        now: localNowIso(),
        part: dayPart(),
      },
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
/**
 * Scan ka nateeja — kaamyabi, ya wajah.
 *
 * ⚠️ Pehle ye sirf `DocumentAI | null` tha, aur `null` ka koi matlab nahi tha.
 * Ye bilkul wahi galti thi jo `parseReminderAI` me pakdi ja chuki hai (upar
 * `ReminderParse` par likhi hai), bas yahan wo theek karna chhoot gaya tha —
 * aur document wali screen par ye zyada chubhti hai, kyunki wahan user ek photo
 * kheench chuka hota hai aur intezaar kar raha hota hai.
 *
 * Paanch bilkul alag halaat ek hi line dikhati thi ("Padha, par saaf nahi —
 * details khud daal do"): net band, net dheema, Gemini bhara hua, server ki
 * dikkat, aur AI ka sach me kuch na dhoondh paana. Pehli chaar me wo line
 * JHOOTH hai — AI ne kuch padha hi nahi tha.
 *
 * `unclear` isliye alag hai: wo akela aisa nateeja hai jisme AI sach me chala
 * tha. Us par "details khud daal do" kehna sahi hai; baaki par dobara koshish
 * karne ko kehna sahi hai.
 */
export type DocumentScan =
  | { ok: true; data: DocumentAI }
  /** AI chala aur jawab bhi diya, par usme kuch kaam ka nahi tha. */
  | { ok: false; failure: "unclear" }
  | { ok: false; failure: AiFailure };

export async function scanDocumentAI(
  base64: string,
  locale?: string,
  mime = "image/jpeg",
): Promise<DocumentScan> {
  if (!supabase || !base64) return { ok: false, failure: "server" };
  try {
    const data = await callAi<(Partial<DocumentAI> & { error?: string }) | null>(
      { task: "scan", image: base64, mime, locale },
      // Image bhejni hai — scan ko thodi zyada mohlat.
      TASK_TIMEOUT_MS * 2,
    );
    // Server ne jawab diya, par usme samajh nahi thi — ye AI ki apni baat hai,
    // net ki nahi. Isliye `unclear`, `server` nahi.
    if (!data || data.error) return { ok: false, failure: "unclear" };
    const r = data;
    return {
      ok: true,
      data: {
        type: r.type || "other",
        name: r.name || "",
        expiry: r.expiry ?? null,
        summary: r.summary || "",
      },
    };
  } catch (e) {
    return { ok: false, failure: failureOf(e) };
  }
}
