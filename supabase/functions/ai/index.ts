// Saathi — ek hi AI function (chat + document scan + reminder parse + daily brief).
// Ab Google Gemini pe: sasta + Hindi/Hinglish strong + accha vision (OCR).
// Secret chahiye: GEMINI_API_KEY  (Google AI Studio se — aistudio.google.com).
// Key set karte hi sab live ho jaata hai — app me koi change nahi.
//
// App is function ko { task, ... } bhejti hai:
//   chat     → sirf app ke sawaal (reminders/tasks/documents), context ke saath
//   scan     → document image se { type, name, expiry, summary }
//   reminder → text se { title, remind_at, label, needsTime, needsDate }
//   brief    → aaj ke data se chhota morning brief

const KEY = Deno.env.get("GEMINI_API_KEY");
// ── Model ka naam do baar tod chuka hai; dono baar alag tarah se ──────────
//
// ⚠️ Pehle: tay kiye hue naam (gemini-2.5-flash) naye users ke liye band kar
//    diye gaye → 404 "no longer available to new users". Uska ilaaj "-latest"
//    alias tha, is soch ke saath ki wo hamesha current model par point karega.
//
// ⚠️ Phir wahi ilaaj hi bimari ban gaya. 28 July tak sab theek chal raha tha, 31 July ko har call
// 401 `ACCESS_TOKEN_TYPE_UNSUPPORTED` dene lagi — "is method ke liye API key
// nahi, OAuth chahiye". Key wahi thi jo pehle chal rahi thi (24 July se badli
// hi nahi). Yaani galti key ki nahi, MODEL ke naam ki thi: Google `-latest`
// alias ko kabhi bhi aise tier par sarka deta hai jahan API key nahi chalti.
//
// Isliye ab teen cheezein:
//   1. Model ka naam env se aa sakta hai — agle baar code badalna hi na pade.
//   2. Ek FALLBACK model hai jo pakka API-key se chalta hai. Pehla mana kare to
//      doosra apne aap chal jaata hai (`gemini()` neeche ye khud karta hai).
//   3. `task: "health"` batata hai ki is key se kaun-kaun se model chalte hain.
//
// Env (optional): GEMINI_MODEL, GEMINI_VISION_MODEL, GEMINI_FALLBACK_MODELS
//
// ── Model kyun yahi ────────────────────────────────────────────────────────
// Tarteeb: pehle TEZ aur SAHI, uske baad sasta.
//
//   chat/reminder → gemini-3.5-flash
//        Bahut tez hai aur Google khud ise low-latency chat ke liye kehta hai.
//        Yahi wo jagah hai jahan galti sabse mehngi padti hai: reminder ka din
//        ya time galat samjha to alarm galat waqt bajta hai, aur user ko pata
//        bhi nahi chalta. Isliye yahan flash-lite se thoda mehnga theek hai.
//
//   scan (vision) → gemini-3.6-flash
//        Document padhna sabse nazuk kaam hai — ek galat expiry date poore
//        reminder ko galat din par le jaati hai. Ye multimodal me sabse accha
//        hai, aur token bhi kam kharch karta hai (yaani 3.5 Flash se sasta bhi).
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash";
const VISION_MODEL = Deno.env.get("GEMINI_VISION_MODEL") ?? "gemini-3.6-flash";

/**
 * Jab upar wala model API key se mana kar de — ye chain ek-ek karke try hoti hai.
 *
 * ⚠️ Yahan `-latest` alias JAAN-BOOJH KE nahi hai. Wahi poore outage ki jad tha:
 * `gemini-flash-lite-latest` chal raha tha, phir Google ne alias ko aise tier
 * par sarka diya jahan API key nahi chalti, aur ek raat me har call 401 dene
 * lagi — bina hamare kuch badle. Tay kiye hue (pinned) version aise nahi
 * sarakte.
 *
 * ⚠️ Aur `gemini-2.0-flash` bhi mat daalna — wo 1 June 2026 ko band ho chuka hai.
 *
 * `gemini-2.5-flash` isliye hai ki wo alag generation ka stable model hai:
 * 3.x family me ek saath kuch gadbad ho jaye to bhi ye chalta rahega. Sasta bhi
 * sabse zyada hai — fallback ka kaam bachana hai, shaan dikhana nahi.
 */
const FALLBACK_MODELS = (
  Deno.env.get("GEMINI_FALLBACK_MODELS") ?? "gemini-3.5-flash-lite,gemini-2.5-flash"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// Supabase auto-injects ye edge functions me.
const SB_URL = Deno.env.get("SUPABASE_URL");
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY");
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/** Caller ka user id (JWT se). Referral anti-fraud ke liye server-side chahiye. */
async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth || !SB_URL || !SB_ANON) return null;
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: SB_ANON },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Chat ko DB me record karo (service_role se, user_id ke saath).
 * Best-effort — fail ho to chat fail nahi hota.
 */
async function recordChat(userId: string, userMsg: string, reply: string) {
  if (!SB_URL || !SB_SERVICE) return;
  try {
    await fetch(`${SB_URL}/rest/v1/messages`, {
      method: "POST",
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify([
        { role: "user", content: userMsg, user_id: userId },
        { role: "saathi", content: reply, user_id: userId },
      ]),
    });
  } catch {
    /* best-effort */
  }
}

/**
 * User ka Plus chalu hai?
 *
 * ⚠️ Daily brief Plus ka feature hai. App usse free plan par bulaati hi nahi,
 * par sirf app par bharosa karna kaafi nahi: ye function har logged-in user ke
 * liye khula hai, aur kisi bhi paid cheez ka darwaza sirf UI me band karna
 * band karna nahi hota — wahan Gemini ka kharcha seedha hum par aata hai.
 *
 * Hisaab wahi jo app ka `getPlan()` aur cron ka `toReminderProfile()` lagate
 * hain: plan 'plus' HO aur expiry nikli na ho (null = koi expiry nahi).
 */
async function isPlusUser(userId: string | null): Promise<boolean> {
  if (!userId || !SB_URL || !SB_SERVICE) return false;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/profiles?id=eq.${userId}&select=plan,plan_expires_at&limit=1`,
      { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } },
    );
    if (!res.ok) return false;
    const rows = await res.json();
    const row = rows?.[0];
    if (row?.plan !== "plus") return false;
    const exp = row?.plan_expires_at;
    return !exp || new Date(exp).getTime() > Date.now();
  } catch {
    // Plan padh hi na paaye to naa hi bolo — free ko paid feature dene se
    // behtar hai Plus wale ko ek baar default line dikhna.
    return false;
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

/**
 * Har Gemini call ka hisaab rakho — kitne token lage (item 3).
 *
 * Bina iske ye pata hi nahi chalta ki AI ka kharcha kahan se aa raha hai —
 * chat se, document scan se, ya reminder parse se. Bill aane par pata chalna
 * bahut der ho jaati hai.
 *
 * Best-effort: fail ho to AI ka kaam nahi rukta. Hisaab kitaab se zyada zaroori
 * user ka jawab hai.
 */
async function logUsage(
  kind: string,
  units: number,
  ok: boolean,
  userId: string | null,
  meta?: Record<string, unknown>,
) {
  if (!SB_URL || !SB_SERVICE) return;
  try {
    await fetch(`${SB_URL}/rest/v1/service_usage`, {
      method: "POST",
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        service: "gemini",
        kind,
        user_id: userId,
        units,
        ok,
        meta: meta ?? null,
      }),
    });
  } catch {
    /* best-effort */
  }
}

type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

/** Ek Gemini generateContent call. Sirf text lautata hai. */
async function gemini(opts: {
  model: string;
  system: string;
  contents: GeminiContent[];
  json?: boolean;
  maxTokens?: number;
  /** Hisaab ke liye — kaunsa kaam tha aur kiske liye. */
  track?: { kind: string; userId: string | null };
}): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${KEY}`;
  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: opts.contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: opts.maxTokens ?? 1024,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  let res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  /**
   * Model ne API key se mana kar diya — pakke wale model par chale jao.
   *
   * ⚠️ Ye 401/403 "key galat hai" NAHI hai. Google ye tab deta hai jab MODEL
   * API-key se chalne wale tier me na ho. Aur `-latest` alias kabhi bhi udhar
   * sarak sakta hai — bina kisi khabar ke, bina kuch badle. Exactly yahi 28-31
   * July ke beech hua tha: ek din sab chal raha tha, agle din har call 401.
   *
   * Pehle iska koi ilaaj nahi tha — poora AI band pad jaata tha aur wajah kahin
   * dikhti bhi nahi thi. Ab wo apne aap ek stable model par chala jaata hai.
   */
  /** Model ne mana kiya (key ne nahi) — tabhi agle model par jaana hai. */
  const rejected = (r: Response) =>
    r.status === 401 || r.status === 403 || r.status === 404;

  let usedModel = opts.model;
  if (rejected(res)) {
    const why = (await res.clone().text()).slice(0, 200);
    for (const alt of FALLBACK_MODELS) {
      if (alt === opts.model) continue;
      const tryRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${alt}:generateContent?key=${KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      res = tryRes;
      usedModel = alt;
      if (tryRes.ok) {
        // Chalu to ho gaya, par ye chup-chaap nahi hona chahiye — warna mahino
        // tak pata hi nahi chalega ki asli model band pada hai aur app poore
        // waqt ek doosre (aksar kamzor) model par chal rahi hai.
        void logUsage("model_fallback", 0, true, opts.track?.userId ?? null, {
          from: opts.model,
          to: alt,
          why,
        });
        break;
      }
      // Ye bhi mana kar gaya to agle par; kisi aur tarah ka fail ho to yahin
      // ruk jao (retry se wo theek nahi hoga, sirf der lagegi).
      if (!rejected(tryRes)) break;
    }
  }

  if (!res.ok) {
    const text = await res.text();
    if (opts.track) {
      // Fail bhi ginte hain — retry ka apna kharcha hota hai, aur "AI kaam nahi
      // kar raha" wali shikayat ka sabse pehla sabooot yahi hota hai.
      void logUsage(opts.track.kind, 0, false, opts.track.userId, {
        model: usedModel,
        status: res.status,
      });
    }
    throw new Error(text);
  }
  const data = await res.json();
  if (opts.track) {
    const um = data?.usageMetadata ?? {};
    void logUsage(
      opts.track.kind,
      Number(um.totalTokenCount ?? 0),
      true,
      opts.track.userId,
      {
        model: usedModel,
        prompt: Number(um.promptTokenCount ?? 0),
        output: Number(um.candidatesTokenCount ?? 0),
      },
    );
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: GeminiPart) => p.text ?? "").join("").trim();
}

// JSON reply se pehla {...} nikaalta hai (responseMimeType json ho to seedha parse).
function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Model se aayi repeat ki baat ko bharose laayak banao.
 *
 * Model kabhi-kabhi "1" string me deta hai, kabhi 0 ya -3 jaisa bekaar number,
 * kabhi "har roz" jaisa text date ki jagah. In sab ka seedha DB me chala jaana
 * sabse bura hoga: ek galat repeat_every_days user ko 4000 alarm de sakta hai.
 * Isliye yahan sirf wahi guzarta hai jo sach me kaam ka ho.
 *
 * 366 ki chhat: isse zyada ka "repeat" repeat rehta hi nahi — wo saal me ek baar
 * hai, aur uske liye user agle saal khud reminder bana lega.
 */
function repeatFields(a: any): { repeat_every_days: number | null; repeat_until: string | null } {
  const raw = Number(a?.repeat_every_days);
  const every = Number.isFinite(raw) && raw >= 1 && raw <= 366 ? Math.floor(raw) : null;

  const u = typeof a?.repeat_until === "string" ? a.repeat_until.trim() : "";
  // Sirf saaf YYYY-MM-DD. Aadhi-adhoori date se series galat din band ho jaati.
  const until = every && /^\d{4}-\d{2}-\d{2}$/.test(u) ? u : null;

  return { repeat_every_days: every, repeat_until: until };
}

/**
 * Jo action app sach me chala sakti hai — allow-list, block-list nahi.
 *
 * ⚠️ Allow-list hona ZAROORI hai. Model kabhi bhi apni marzi ka `to` ya `value`
 * likh sakta hai ("to":"delete_all", "value":"blue"), aur wo seedha app tak
 * pahunch jaata. App unhe chup-chaap gira degi (wahan bhi map hai), par tab
 * user ko "haan kar diya" wala reply dikhta hai aur kuch hota nahi — jo sabse
 * uljhan wali soorat hai. Yahin rok dena behtar hai: action null jaayega, aur
 * reply bhi usi hisaab se banega.
 */
const NAV_TARGETS = new Set([
  "add_document",
  "add_reminder",
  "documents",
  "reminders",
  "notes",
  "profile",
  "settings",
  "app_lock",
  "support",
  "upgrade",
]);
const THEME_VALUES = new Set(["light", "dark", "system"]);
const LANG_VALUES = new Set(["hinglish", "hi", "en"]);
const ALERT_VALUES = new Set(["ring", "vibrate", "silent"]);

const SAATHI_SYSTEM = `Tum "Saathi" ho — ek warm, caring AI dost (India ke liye). Chhota, pyaara jawab do. Zaroorat se zyada mat likho. Ek emoji kabhi-kabhi. Honest raho.`;

/**
 * User ne app mein jo bhasha chuni hai usi mein jawab aaye — chahe wo kisi aur
 * bhasha mein type kare. App har request mein `locale` bhejti hai.
 */
function langNote(locale?: string): string {
  switch (locale) {
    case "hi":
      return ` HAMESHA shuddh Hindi mein (Devanagari script) jawab do.`;
    case "en":
      return ` ALWAYS reply in English.`;
    case "hinglish":
    default:
      return ` Hamesha Hinglish mein jawab do (Roman script, Hindi-English mix jaise log WhatsApp pe likhte hain).`;
  }
}

/**
 * Out-of-scope decline (locale-aware) — jab user app ke bahar ka sawaal pooche.
 *
 * Do baatein jaan-boojh ke isi kram me:
 *
 *   1. Pehle maafi — "sorry". User ne kuch galat nahi kiya; usne ek seedha sawaal
 *      poocha hai. Bina maafi ke ye line ek rok jaisi lagti hai, jawab jaisi nahi.
 *   2. Phir ummeed — "ye feature abhi nahi hai, par bahut jald aa raha hai".
 *      Sirf "nahi kar sakta" keh dena app ko chhota dikhata hai; ye batana ki
 *      raasta band nahi, sirf abhi nahi, poori baat badal deta hai.
 *
 * ⚠️ Ye line model ko HUBAHU copy karne ko kahi jaati hai (neeche `scope` me).
 * Pehle "yahi bhaav do" likha tha, aur uska natija ye hota tha ki model aadha
 * jawab de deta aur aakhir me ye jod deta — yaani mana karne ke naam par duniya
 * bhar ki baat ho jaati thi.
 */
function declineLine(locale?: string): string {
  switch (locale) {
    case "hi":
      return "माफ़ करें, यह फ़ीचर अभी नहीं है — फ़िलहाल मैं सिर्फ़ आपके reminders, tasks और documents में मदद कर सकता हूँ। 🙂 बाक़ी सब भी बहुत जल्द आ रहा है!";
    case "en":
      return "Sorry, that feature isn't here yet — right now I can only help with your reminders, tasks and documents. 🙂 Everything else is coming very soon!";
    case "hinglish":
    default:
      return "Sorry, ye feature abhi nahi hai — filhaal main sirf aapke reminders, tasks aur documents me madad kar sakta hoon. 🙂 Baaki sab bhi bahut jald aa raha hai!";
  }
}

/**
 * "Samajh nahi aaya, dobara bolo" — jab model ka apna jawab toot jaye.
 *
 * Decline line se alag rakhna zaroori hai: decline ka matlab hai "ye mera kaam
 * nahi", aur ye galat sandesh deta hai jab asal me sirf parse fail hua ho.
 */
function retryLine(locale?: string): string {
  switch (locale) {
    case "hi":
      return "माफ़ करें, यह ठीक से समझ नहीं आया। थोड़ा और साफ़ बताएँगे? 🙂";
    case "en":
      return "Sorry, I didn't quite catch that. Could you say it once more? 🙂";
    case "hinglish":
    default:
      return "Maaf karna, ye theek se samajh nahi aaya. Ek baar aur bataoge? 🙂";
  }
}

/**
 * Bina key ke chat ye reply deta hai (stub mode). Key set karte hi asli Gemini
 * jawab dene lagega — koi code change nahi.
 */
const STUB_REPLY =
  "Samajh gaya 👍 Isse yaad rakhne aur karne wala smart AI jald aa raha hai. Tab tak Documents aur Reminders tabs use karo!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const task = payload.task ?? "chat";

  /**
   * `task: "health"` — "AI kyun nahi chal raha?" ka jawab, ek call me.
   *
   * ⚠️ Ye isliye bana kyunki ek baar poora AI hafton band pada raha aur wajah
   * dhoondhne me bahut waqt gaya. Har jagah se ek hi bemtlab line aati thi
   * ("Edge Function returned a non-2xx status code"), aur asli baat — Gemini ne
   * key hi nahi maani — kahin dikhti nahi thi.
   *
   * Yahan key KABHI nahi lautti, sirf uski shakal: kitni lambi hai, kis se shuru
   * hoti hai, aur (sabse aam galti) kahin uske aage-peeche space/newline to
   * nahi chipka. Dashboard me paste karte waqt newline chala jaana bahut aam hai
   * aur usse Google ka jawab bilkul "key hi nahi bheji" jaisa ho jaata hai.
   */
  if (task === "health") {
    const raw = KEY ?? "";
    const trimmed = raw.trim();
    const shape = {
      present: !!raw,
      length: raw.length,
      // AI Studio ki key hamesha "AIza" se shuru hoti hai.
      looksLikeAiStudioKey: trimmed.startsWith("AIza"),
      hasSurroundingWhitespace: raw !== trimmed,
      hasQuotes: /^["']|["']$/.test(trimmed),
    };

    if (!shape.present) {
      return json({
        ok: false,
        shape,
        problem: "GEMINI_API_KEY set hi nahi hai.",
        fix: "Supabase → Edge Functions → Secrets me GEMINI_API_KEY daalo, phir `npx supabase functions deploy ai`.",
      });
    }

    // Sabse halki call jo Google se ho sakti hai — model list. Isse pata chal
    // jaata hai ki key chalti hai ya nahi, bina ek bhi token kharch kiye.
    let status = 0;
    let body = "";
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`,
      );
      status = res.status;
      body = await res.text();
    } catch (e) {
      return json({ ok: false, shape, problem: `Google tak pahunch hi nahi paaye: ${e}` });
    }

    if (status === 200) {
      // Kaun-kaun se model is key se generateContent kar sakte hain — yahi wo
      // list hai jo "AI kyun band hua" ka jawab seedha de deti hai.
      let usable: string[] = [];
      try {
        const parsed = JSON.parse(body || "{}");
        usable = (parsed.models ?? [])
          .filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
          .map((m: any) => String(m.name ?? "").replace("models/", ""));
      } catch {
        /* list na mile to bhi key theek hai — wahi sabse zaroori baat hai */
      }
      return json({
        ok: true,
        shape,
        configured: { chat: MODEL, vision: VISION_MODEL, fallbacks: FALLBACK_MODELS },
        chatModelUsable: usable.length === 0 || usable.includes(MODEL),
        visionModelUsable: usable.length === 0 || usable.includes(VISION_MODEL),
        fallbacksUsable: FALLBACK_MODELS.filter((m) => usable.length === 0 || usable.includes(m)),
        usable,
        problem: null,
        fix: null,
      });
    }

    // Google ke do alag jawab, do bilkul alag ilaaj. Inhe ek jaisa dikhana hi
    // wo galti thi jisme itna waqt gaya.
    let problem = `Google ne ${status} diya.`;
    let fix = "";
    if (body.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")) {
      problem =
        "Google is key ko API key maanta hi nahi — wo OAuth token maang raha hai. " +
        "Matlab ye key AI Studio ki nahi hai (aksar Google Cloud / Vertex AI wali key hoti hai), " +
        "ya value me space/newline chipka hai.";
      fix =
        "aistudio.google.com/apikey se NAYI key banao (wo 'AIza…' se shuru hoti hai), " +
        "Supabase Secrets me bina kisi space/newline ke paste karo, phir `npx supabase functions deploy ai`.";
    } else if (body.includes("API_KEY_INVALID")) {
      problem = "Key ki shakal to theek hai par Google ke paas wo hai nahi (delete/rotate ho chuki).";
      fix = "aistudio.google.com/apikey se nayi key banao aur Supabase Secrets me badal do.";
    } else if (body.includes("SERVICE_DISABLED") || body.includes("PERMISSION_DENIED")) {
      problem = "Key to hai, par us project me Generative Language API band hai.";
      fix = "Google Cloud console me 'Generative Language API' enable karo.";
    } else if (status === 429) {
      problem = "Key theek hai — par abhi rate limit / quota khatam hai.";
      fix = "Thodi der baad dobara dekho, ya billing/quota badhao.";
    }
    return json({ ok: false, shape, status, problem, fix, detail: body.slice(0, 400) });
  }

  // Key nahi hai: chat stub-mode me chalta hai (message phir bhi record hota hai,
  // taaki referral ki "first chat" condition kaam kare). Baaki tasks bina key nahi.
  if (!KEY) {
    if (task === "chat") {
      const userMsg = payload.message ?? "";
      const uid = await getUserId(req);
      if (uid && userMsg.trim()) await recordChat(uid, userMsg, STUB_REPLY);
      return json({ reply: STUB_REPLY, stub: true });
    }
    return json({ error: "GEMINI_API_KEY set nahi hai" }, 500);
  }

  // Ek hi baar nikaalo — har task ke hisaab me user ka pata chahiye (item 3),
  // aur chat me referral verify ke liye bhi wahi chahiye.
  const uid = await getUserId(req);

  try {
    // 1. CHAT — app ke sawaal + AGENTIC reminder banana. Bahar ka nahi.
    if (task === "chat") {
      const nameNote = payload.name
        ? ` User ka naam "${payload.name}" hai — kabhi-kabhi naam se bulao, natural.`
        : "";
      // RAG-lite: app user ka apna data bhejti hai (reminders + documents snapshot),
      // taaki jawab usi data par grounded ho (kuch mat maano).
      const ctx = payload.context
        ? `\n\nUser ka abhi ka data (isi se jawab do, aur kuch mat maano):\n${JSON.stringify(payload.context)}`
        : "";
      // Abhi ka LOCAL time (app naive-local ISO bhejti hai) — remind_at isse nikaalo.
      const now = payload.now ?? payload.context?.today ?? new Date().toISOString();
      /**
       * Saathi ka daayra — aur uske bahar ka jawab.
       *
       * ⚠️ Pehle yahan sirf "politely mana karo aur yahi bhaav do" likha tha, aur
       * wo kaafi nahi tha. Model "bhaav" ko apni tarah samajhta tha: wo aksar
       * pehle poora jawab de deta (Taj Mahal kahan hai, 17×23 kitna hota hai) aur
       * uske baad ye line jod deta — yaani mana karne ke naam par duniya bhar ki
       * baat ho jaati thi. Kabhi "main ek AI hoon" jaisi apni line likh deta, jo
       * Saathi ki awaaz hi nahi hai.
       *
       * Ab teen cheezein badli hain:
       *   1. Line HUBAHU copy karni hai — apne shabd nahi.
       *   2. Us line ke aage-peeche kuch bhi nahi. Aadha jawab bhi jawab hai.
       *   3. Kya "bahar" hai, uske saaf udaaharan — "general knowledge" jaisa
       *      abstract shabd model ke liye kaafi nahi tha.
       *
       * Aur ek chhoot jaan-boojh ke: agar user pichhle turn ke reminder ka koi
       * tukda bhej raha hai (ek shabd, ek time), wo BAHAR nahi hai. Wahi galti
       * pehle sabse zyada nuksaan karti thi (neeche AGENTIC me poora likha hai).
       */
      /**
       * ⚠️ Ye "chhoti baat" wala hissa baad me joda gaya, aur iske bina Saathi
       * bilkul ek dabba lagta tha.
       *
       * Purani list me "apne baare me sawaal" bhi BAHAR ki baat me likha tha,
       * aur uska asar wahi hua jo hona hi tha: "Kya kar rahi ho?", "Kya haal
       * chaal?", "Tum kaun ho?", "Hello" — har seedhi si baat par Saathi wahi
       * ratta-lagaya decline bol deta tha ("ye feature abhi nahi hai…"). Ek
       * dost se "kaise ho" poochhne par wo feature ki baat karne lage, to wo
       * dost nahi rehta.
       *
       * Ye rok kabhi zaroori bhi nahi thi. Jo bachana tha wo ye tha ki Saathi
       * duniya bhar ke sawaalon ka jawab na de (jahan wo galat ho sakta hai aur
       * jiska app se koi lena-dena nahi) — greeting aur apni pehchaan uska
       * hissa hai hi nahi. Isliye ab wo saaf ALLOWED hai, aur uske liye ek
       * chhota niyam bhi: jawab chhota rakho aur baat wapas app ke kaam par le
       * aao.
       */
      const smalltalk =
        `\n\nCHHOTI BAAT (ye BILKUL karni hai, mana MAT karna):` +
        ` salaam-dua aur haal-chaal ("hi", "hello", "namaste", "good morning", "kaise ho", "kya kar rahe ho", "kya haal hai"),` +
        ` shukriya/taareef ka jawab, maafi, "bye", aur apne baare me seedhe sawaal ("tum kaun ho", "tumhara naam kya hai", "tum kya kar sakte ho").` +
        ` In par garmajoshi se, 1-2 line me jawab do — jaise ek dost deta hai — aur halke se ye bhi bata do ki tum kis kaam me madad kar sakte ho` +
        ` (reminders, tasks, documents). Ye "bahar ki baat" NAHI hai; ispar decline wali line kabhi mat bolna.` +
        ` Apne baare me poochhne par apni pehchaan "Saathi" hi rakhna — kaunsa AI model ho, kis company ka ho, kaise bane ho, ye kabhi mat batao (wo bahar ki baat hai).`;

      const scope =
        ` TUM SIRF is app "Apka Saathi" ke baare me madad karte ho: (a) user ke reminders, tasks, documents aur unki expiry/dates, (b) app kaise use karein,` +
        ` (c) app khud kya hai — features, plan, price, referral, Saathi Plus, aur (d) saadharan salaam-dua/haal-chaal (neeche CHHOTI BAAT dekho).` +
        `\n\nBAHAR KI BAAT — ye sab is app se bahar hai, aur inka jawab tum KABHI nahi dete:` +
        ` general knowledge, itihaas, bhugol, science, news/current affairs, cricket/khel, mausam, share market/crypto,` +
        ` math ya calculation, coding, translation, recipe, health/dawai ki salah, kanoon ya paisa ki salah, shayari/kahani/joke likhna,` +
        ` kisi aur app/website ke baare me, aur ye ki tum kaunse AI model/company ke ho.` +
        `\n⚠️ Aisi kisi bhi baat par tumhara reply BILKUL YE HONA CHAHIYE, hubahu, shabd-ba-shabd:` +
        `\n"${declineLine(payload.locale)}"` +
        `\nUske aage ya peeche kuch bhi MAT likho — na thoda sa jawab, na "par main itna bata deta hoon", na koi apni line.` +
        ` Aadha jawab dena bhi jawab dena hai, aur wo saaf mana karne se bura hai.` +
        ` action bhi null rakho.` +
        `\n⚠️ Par ye rok us baat par NAHI lagti jo pichhle turn me tumne khud poochi thi (reminder ka kaam/din/time) — uska chhota jawab is app ki hi baat hai.` +
        smalltalk;

      // AGENTIC: chat se hi reminder ban jaaye — zaroori detail pucho, phir action do.
      const agentic =
        `\n\nAGENTIC REMINDER: Agar user kuch yaad dilane / reminder / alarm set karne ko kahe:` +
        ` 3 cheezein chahiye — (1) kaam kya (title), (2) kaunsa din, (3) kaun sa time.` +
        ` Jo missing ho wo pyaar se pucho (reply me, ek-do sawaal). Jab tak title AUR poora date+time na mile, action null rakho.` +
        ` Sab clear hote hi action bharo: {"type":"create_reminder","title":"<saaf kaam, bina time-phrase>","remind_at":"<naive local ISO jaise 2026-07-27T20:00:00, bina Z ya offset>","in_seconds":<number ya null>,"repeat_every_days":<number ya null>,"repeat_until":"<YYYY-MM-DD ya null>"}.` +
        ` Abhi ka local time: ${now}. Isi se remind_at nikaalo — "kal"=agla din, "subah 8"=08:00, "shaam 6"/"6 baje shaam"=18:00, "raat 9"=21:00, "dopahar 2"=14:00.` +
        // ⚠️ Relative waqt SERVER par mat ginno. Tumhara jawab banne me hi 5-20
        //    second lagte hain, aur utni der me "30 second baad" wala time beet
        //    chuka hota hai — app use "beeta hua time" maan ke gira deti thi.
        //    Isliye relative par sirf GINTI do; app jawab milte hi khud jodegi.
        `\nRELATIVE WAQT: "N second/minute/ghante baad" (ya "after N sec/min/hour", "abhi se N minute me") ho to` +
        ` remind_at ko null rakho aur in_seconds me SECONDS ki ginti do — "30 second baad"=30, "5 minute baad"=300, "2 ghante baad"=7200.` +
        ` Aise me din/time poochne ki zaroorat NAHI hai (din aaj hi hai, time abhi se ginna hai) — seedha action bhar do, bas title chahiye.` +
        ` Absolute din/time bola ho to ulta karo: remind_at bharo aur in_seconds null rakho. Dono ek saath kabhi mat bharo.` +
        // ⚠️ Ye poora hissa isliye hai ki user "roz gym 6 baje, 90 din tak" bolta
        //    tha aur reminder sirf EK BAAR bajta tha. Repeat nikalna model ka
        //    kaam hai — app me koi keyword-matching nahi hai (aur honi bhi nahi
        //    chahiye: "har doosre din" jaisi baat rule se kabhi nahi pakdi jaati).
        `\nREPEAT: user ki baat me dohraav ho to repeat_every_days bharo —` +
        ` "roz"/"har din"/"daily"/"har subah"/"har raat" = 1, "har doosre din"/"ek din chhod ke" = 2,` +
        ` "har hafte"/"weekly"/"har Somvar" = 7, "har 15 din" = 15, "har mahine"/"monthly" = 30.` +
        ` Ek hi baar ka kaam ho to repeat_every_days null rakho.` +
        `\nKAB TAK: "90 din tak"/"3 mahine tak"/"31 December tak" jaisi baat ho to repeat_until me us AAKHRI din ki date (YYYY-MM-DD) do,` +
        ` abhi ke date se ginti karke. Kuch na bola ho to repeat_until null — matlab jab tak user khud band na kare.` +
        ` remind_at hamesha PEHLI baar ka time hota hai (aage ka hisaab app khud karti hai).` +
        ` reply me short confirm karo, aur repeat ho to wo bhi bolo (jaise "Theek hai — roz subah 6 baje, 90 din tak ⏰").` +
        // ⚠️ Ye niyam sabse zaroori hai. Pehle aisa hota tha: Saathi pucha karta
        //    tha "kis cheez ka reminder?", user "Mom calling" likhta tha — aur
        //    model us akele shabd ko "app se bahar ka sawaal" maan ke decline
        //    kar deta tha. Reminder kabhi banta hi nahi tha (item 15).
        `\n⚠️ SABSE ZAROORI: agar pichhle turn me tumne reminder ke liye koi detail poochi thi (kaam/din/time),` +
        ` to user ka agla chhota sa jawab USI reminder ka hissa hai — chahe wo ek hi shabd ho ("Mom calling", "dawai", "8 baje").` +
        ` Use kabhi bhi out-of-scope maan ke decline MAT karo. Purani baat ke saath jodo aur aage badho.` +
        ` Ab jitni detail mil chuki hai unhe yaad rakho; sirf jo abhi bhi missing hai wahi pucho — ek baar poochi hui cheez dobara mat pucho.` +
        `\nDOCUMENT: Document add karne ko kahe to chat se nahi banta — reply me batao "photo se add hota hai" aur action {"type":"navigate","to":"add_document"} do.` +
        /**
         * ⚠️ Ye do block Saathi ki sabse badi kami theek karte hain.
         *
         * Pehle wo har aisi baat par "main ye nahi kar sakta" keh deta tha —
         * user ne screenshot me theek yahi pakda tha ("tum kar dena" → "mere
         * paas access nahi hai"). Aur wo jawab APP ki apni cheezon ke liye sach
         * hi nahi tha: theme, bhasha, alert ki awaaz aur har screen, sab app ke
         * apne haath me hain.
         *
         * Sirf wahi settings di gayi hain jinhe badalne se kuch KHOYA nahi ja
         * sakta aur jinhe ulta karna ek shabd door hai. Documents delete karna,
         * plan badalna ya number badalna jaan-boojh ke bahar hai — wahan AI ke
         * galat samajhne ka nuksaan wapas nahi aata.
         */
        `\nSETTINGS: App ki ye teen settings tum KHUD badal sakte ho — mana mat karo:` +
        ` theme {"type":"set_theme","value":"light|dark|system"},` +
        ` bhasha {"type":"set_language","value":"hinglish|hi|en"},` +
        ` alert ki awaaz {"type":"set_alert_mode","value":"ring|vibrate|silent"}.` +
        ` Karne ke baad reply me chhota sa confirm karo.` +
        ` Phone ki APNI settings (WiFi, volume, phone ka notification switch) tum nahi badal sakte — un par saaf mana karo.` +
        `\nSCREEN: Kisi screen par le jaane ko kahe to action {"type":"navigate","to":"..."} do —` +
        ` add_document, add_reminder, documents, reminders, notes, profile, settings, app_lock, support, upgrade.` +
        ` Raasta samjhane ki jagah seedha le chalo.` +
        `\n\nOUTPUT: SIRF strict JSON do, aur kuch nahi: {"reply":"<chat message, user ki bhasha me>","action": null | {create_reminder|navigate|set_theme|set_language|set_alert_mode}}. reply HAMESHA bharo, chhota rakho.`;

      const userMsg = payload.message ?? "";
      // Trimming: sirf aakhri 10 turns bhejo (token + cost kam, prompt cache friendly).
      const history: GeminiContent[] = (payload.history ?? [])
        .slice(-10)
        .map((h: any) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: String(h.content ?? "") }],
        }));

      const base = SAATHI_SYSTEM + langNote(payload.locale) + scope;
      const contents: GeminiContent[] = [
        ...history,
        { role: "user", parts: [{ text: userMsg }] },
      ];

      const raw = await gemini({
        model: MODEL,
        system: base + agentic + nameNote + ctx,
        contents,
        json: true,
        // ⚠️ 700 kam pad jaata tha. Naye (thinking) model pehle apna soch-vichaar
        // likhte hain aur wo bhi isi budget me ginta hai — chhoti si "8 baje
        // wake up" jaisi baat par bhi output budget khatam ho jaata tha aur
        // `parts` KHAALI aata tha. Screen par uska matlab ek hi dikhta tha:
        // "samajh nahi aaya" (item 1). Jagah kaafi rakho — chhote jawab me
        // extra budget kharch hota hi nahi, wo sirf chhat hai.
        maxTokens: 2048,
        track: { kind: "chat", userId: uid },
      });

      const parsed = parseJson(raw) ?? {};
      let reply =
        typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : "";

      /**
       * JSON aaya hi nahi (ya khaali aaya) — Saathi ko DOBARA mauka do, is baar
       * bina JSON ke.
       *
       * ⚠️ Pehle yahan seedha ek RATTA-LAGAYA line chali jaati thi ("samajh nahi
       * aaya, dobara bolo") — chahe user ne kitni bhi saaf baat kahi ho. "Wake
       * me at 8am" par Saathi ko poochna chahiye tha "kis din?", aur milta tha
       * ek bemtlab sa jawab (item 1). Galti user ki nahi thi: baat pahunch chuki
       * thi, bas envelope toot gaya tha.
       *
       * Plain text me model kabhi khaali nahi lautata — koi JSON schema nibhane
       * ka dabaav hi nahi hota. Action is turn me nahi banega, par baatcheet
       * zinda rehti hai: Saathi khud sawaal poochh lega aur agle turn me sab
       * detail milte hi action bhi bhej dega.
       */
      if (!reply) {
        void logUsage("chat_empty_json", 0, false, uid, { rawHead: raw.slice(0, 200) });
        const plain = await gemini({
          model: MODEL,
          system:
            base +
            nameNote +
            ctx +
            `\n\nAbhi ka local time: ${now}.` +
            ` Seedha jawab do — koi JSON nahi, sirf chat ka message (1-2 line).` +
            ` Agar user reminder/alarm maang raha hai aur din ya time saaf nahi hai,` +
            ` to pyaar se wahi ek cheez poochho (jaise "kis din?" ya "kis time?").` +
            ` Jo detail mil chuki hai wo dobara mat poochho.`,
          contents,
          // Pehli koshish khaali isi wajah se aayi thi ki budget chhota tha —
          // dobara wahi galti karna bemtlab hoga.
          maxTokens: 1024,
          track: { kind: "chat_retry", userId: uid },
        }).catch(() => "");
        if (plain.trim()) {
          reply = plain.trim();
          // Is raaste par action nahi banta — agla turn use bana dega.
          parsed.action = null;
        }
      }

      // Dono koshishein gayin — tabhi ratta-lagayi line. Ye ab sach me aakhri
      // sahara hai, pehla nahi.
      if (!reply) reply = retryLine(payload.locale);

      // Action sanitize — sirf allowed shapes.
      let action: unknown = null;
      const a = parsed.action;
      if (a && typeof a === "object") {
        // Reminder do me se EK tarah se aa sakta hai: absolute time, ya "ab se
        // itne second baad". Relative wala client par gina jaata hai (waha se
        // dekho: SaathiAction ka `in_seconds`), isliye yahan sirf ginti pass
        // karni hai.
        const absAt = typeof a.remind_at === "string" && a.remind_at.trim() ? a.remind_at : null;
        const relRaw = Number(a.in_seconds);
        // Upar ki chhat 24 ghante: usse aage relative maangna bemtlab hai (aur
        // ek bada number aksar model ki galti hoti hai, user ki baat nahi).
        const relSec =
          Number.isFinite(relRaw) && relRaw > 0 && relRaw <= 86_400 ? Math.round(relRaw) : null;

        if (a.type === "create_reminder" && typeof a.title === "string" && (absAt || relSec)) {
          action = {
            type: "create_reminder",
            title: a.title.trim(),
            // Dono kabhi saath nahi — relative ho to wahi jeetta hai.
            remind_at: relSec ? null : absAt,
            in_seconds: relSec,
            ...repeatFields(a),
          };
        } else if (a.type === "navigate" && NAV_TARGETS.has(String(a.to))) {
          action = { type: "navigate", to: String(a.to) };
        } else if (a.type === "set_theme" && THEME_VALUES.has(String(a.value))) {
          action = { type: "set_theme", value: String(a.value) };
        } else if (a.type === "set_language" && LANG_VALUES.has(String(a.value))) {
          action = { type: "set_language", value: String(a.value) };
        } else if (a.type === "set_alert_mode" && ALERT_VALUES.has(String(a.value))) {
          action = { type: "set_alert_mode", value: String(a.value) };
        }
      }

      // Server-side record (referral "first chat" isi se verify hota hai).
      if (uid && userMsg.trim()) await recordChat(uid, userMsg, reply);

      return json({ reply, action });
    }

    // 2. DOCUMENT SCAN (vision) — base64 image se {type, name, expiry, summary}
    if (task === "scan") {
      const b64 = payload.image;
      if (!b64) return json({ error: "image chahiye" }, 400);
      const mime = payload.mime ?? "image/jpeg";
      const system = `Tum ek document reader ho. Image me jo document hai use dhyan se padho aur SIRF JSON do (aur kuch nahi):
{"type": ["car","license","passport","fastag","warranty","health","other"] me se ek, "name": "chhota naam jaise 'Car Insurance'", "expiry": "YYYY-MM-DD ya null", "summary": "1 line me document kya hai (user ki bhasha me)"}
type rules: insurance/RC/vehicle = car; driving licence = license; health/life insurance = health; warranty/guarantee = warranty; toll/FASTag = fastag.
expiry: "valid till / expiry / renew by" jaisi date dhoondo, YYYY-MM-DD me do. Na mile to null.
summary:${langNote(payload.locale)}`;
      const text = await gemini({
        model: VISION_MODEL,
        system,
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mime, data: b64 } },
              { text: "Is document ka JSON do." },
            ],
          },
        ],
        json: true,
        maxTokens: 1024,
        track: { kind: "scan", userId: uid },
      });
      return json(parseJson(text) ?? { type: "other", name: "", expiry: null, summary: "" });
    }

    // 3. REMINDER PARSE — text se {title, remind_at, label, needsTime, needsDate}
    if (task === "reminder") {
      const now = payload.now ?? new Date().toISOString();
      const labelLang =
        payload.locale === "hi"
          ? "Hindi (Devanagari) jaise 'कल सुबह 8 बजे'"
          : payload.locale === "en"
            ? "English like 'Tomorrow 8 AM'"
            : "Hinglish jaise '1 minute baad' ya 'Kal subah 8 baje'";
      const system = `Abhi ka time (ISO, user ke timezone me): ${now}.
User ke reminder text (bol ke ya likh ke, spelling galtiyon ke saath) ko samajh ke SIRF JSON do:
{"title": "kaam kya hai (time/date/repeat phrase ke bina, saaf)", "remind_at": "ISO 8601 datetime ya null", "label": "chhota ${labelLang}", "needsDate": boolean, "needsTime": boolean, "repeat_every_days": number ya null, "repeat_until": "YYYY-MM-DD ya null"}

Rules:
- Sochne ka context: "subah 6" = 06:00, "shaam 6" ya "6 baje shaam" = 18:00, "raat 9" = 21:00, "dopahar 2" = 14:00.
- "kal" = agla din, "parso" = uske agle din, "aaj" = today, "N minute/ghante baad" = abhi se aage.
- "3 tarikh" jaisi date: agar wo din is mahine me nikal chuka hai to agla mahina, warna isi mahina.
- Agar date bilkul clear nahi → needsDate=true. Agar time bilkul clear nahi (jaise sirf "kal") → needsTime=true aur uska time abhi mat maano.
- Agar sab clear hai to remind_at bharo aur needsDate/needsTime false.

REPEAT (bahut zaroori):
- "roz"/"har din"/"daily"/"har subah"/"har raat" → repeat_every_days = 1
- "har doosre din"/"ek din chhod ke" → 2 | "har hafte"/"weekly"/"har Somvar" → 7
- "har 15 din" → 15 | "har mahine"/"monthly" → 30
- Ek hi baar ka kaam ho → repeat_every_days = null
- "90 din tak"/"3 mahine tak"/"31 December tak" → repeat_until me us AAKHRI din ki date (YYYY-MM-DD), upar diye abhi ke time se ginti karke. Kuch na bola ho → null.
- remind_at hamesha PEHLI baar ka time hai. Roz wale me title me "roz" mat likho.
- Repeat ho to needsDate false hi rakho jab tak pehla din saaf ho (jaise "roz subah 6" ka pehla din aaj/kal khud tay ho jaata hai).`;
      const text = await gemini({
        model: MODEL,
        system,
        contents: [{ role: "user", parts: [{ text: payload.text ?? "" }] }],
        json: true,
        // ⚠️ Yahan 300 tha aur yahi wo jagah thi jahan LIKHA hua reminder aksar
        // "samajh me nahi aaya" (item 4). Model pehle apna soch-vichaar likhta
        // hai — wo bhi isi budget me ginta hai — aur budget khatam hote hi JSON
        // aadha ya khaali aata tha. Uska natija screen par ek hi dikhta tha:
        // din/time khaali, user ko sab khud bharna pada. Jawab chhota hi rehta
        // hai; ye sirf chhat hai, kharcha nahi.
        maxTokens: 1024,
        track: { kind: "reminder", userId: uid },
      });
      let r = parseJson(text);

      /**
       * Ek khaali/toota jawab poore reminder ko khaali chhod deta hai — aur us
       * soorat me user ko din, time, sab khud bharna padta hai (item 4). Wo
       * screen par bilkul aisa lagta hai jaise AI ne kuch samjha hi nahi.
       *
       * Model ka jawab har baar bilkul ek jaisa nahi hota, isliye ek chhoti si
       * dobara-koshish yahan sach me bachaa leti hai. Sirf EK — usse zyada me
       * user ka intezaar hi lamba hoga, aur pickers waise bhi maujood hain.
       */
      if (!r) {
        void logUsage("reminder_empty_json", 0, false, uid, { head: text.slice(0, 200) });
        const again = await gemini({
          model: MODEL,
          system,
          contents: [{ role: "user", parts: [{ text: payload.text ?? "" }] }],
          json: true,
          maxTokens: 1024,
          track: { kind: "reminder_retry", userId: uid },
        }).catch(() => "");
        r = parseJson(again);
      }

      if (!r) {
        return json({
          title: payload.text ?? "",
          remind_at: null,
          label: null,
          needsDate: true,
          needsTime: true,
          repeat_every_days: null,
          repeat_until: null,
        });
      }
      // Repeat wahi sanitizer se guzarta hai jo chat ke action me chalta hai —
      // dono raaste se banne wala reminder ek jaisa hona chahiye.
      return json({ ...r, ...repeatFields(r) });
    }

    // 4. DOCUMENT FOLLOW-UP — expiry alert ke baad "ye ho gaya kya?" (item 18)
    //
    // Ye jaan-boojh ke AI se banta hai, fixed lines se nahi. Har document alag
    // hota hai — passport "renew" hota hai, insurance "phir se karana" hota
    // hai, warranty bas khatam ho jaati hai. Ek hi ratta-lagaya wakya teenon
    // par bhadda lagta hai, isliye Saathi khud us document ke hisaab se poochta
    // hai.
    if (task === "docfollow") {
      const doc = payload.document ?? {};
      const system =
        `${SAATHI_SYSTEM}${langNote(payload.locale)}` +
        ` User ka ek document expire ho raha hai / ho chuka hai. Tumhe 4 chhoti lines deni hain, SIRF JSON me:` +
        `\n{"ask":"...","done":"...","later":"...","addNew":"..."}` +
        `\n- ask: is document ke hisaab se poocho ki kaam ho gaya kya (jaise renew/naya banwana/phir se karana). Ek line, warm, sawaal ke saath.` +
        `\n- done: user "haan ho gaya" kahe to uska jawab — chhota, khush, aur ye batao ki ab is document ke reminder band kar diye.` +
        `\n- later: user "abhi nahi" kahe to uska jawab — bina taana mare, bharosa dilao ki phir yaad dila dunga.` +
        `\n- addNew: user se kaho ki naye/renew kiye document ki photo daal de taaki nayi expiry bhi Saathi sambhal le. Ek line.` +
        `\nHar line 18 shabd se chhoti. Ek emoji tak theek hai.`;

      const text = await gemini({
        model: MODEL,
        system,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({
                  name: doc.name ?? "",
                  type: doc.type ?? "other",
                  expiry: doc.expiry ?? null,
                  today: payload.now ?? new Date().toISOString().slice(0, 10),
                }),
              },
            ],
          },
        ],
        json: true,
        maxTokens: 800,
        track: { kind: "docfollow", userId: uid },
      });
      const p = parseJson(text) ?? {};
      // Kuch bhi missing ho to null — app apni default lines dikha degi.
      return json({
        ask: typeof p.ask === "string" ? p.ask : null,
        done: typeof p.done === "string" ? p.done : null,
        later: typeof p.later === "string" ? p.later : null,
        addNew: typeof p.addNew === "string" ? p.addNew : null,
      });
    }

    // 5. DAILY BRIEF — Plus only
    if (task === "brief") {
      // App free plan par ye bulaati hi nahi, par darwaza yahan bhi band hona
      // chahiye — warna "Plus feature" sirf UI ka vaada reh jaata hai.
      if (!(await isPlusUser(uid))) {
        return json({ brief: null, error: "plus required" }, 403);
      }
      const nameNote = payload.name ? ` User ka naam "${payload.name}" hai — naam se greet karo.` : "";
      /**
       * ⚠️ Brief ko "abhi kitne baje hain" pata hona ZAROORI hai.
       *
       * Pehle yahan sirf `payload.data` jaata tha (aaj ki taarikh, reminders,
       * documents) aur prompt "morning brief" maangta tha. Yaani AI ke paas waqt
       * ka koi zariya hi nahi tha, aur wo hamesha subah wali baat likhta tha.
       * User ne wahi pakda: 6 baje ka gym wala reminder nipat chuka hai, par 1
       * baje app kholne par card ab bhi "chalo jaldi ready ho jao" keh raha hai.
       *
       * Ab do cheezein jaati hain — local waqt aur din ka hissa — aur prompt
       * saaf kehta hai ki beet chuke kaam ko aage ka kaam mat batao.
       */
      const now = typeof payload.now === "string" ? payload.now : "";
      const part = typeof payload.part === "string" ? payload.part : "";
      const timeNote = now
        ? ` Abhi ka local waqt: ${now}${part ? ` (${part})` : ""}.` +
          ` Greeting isi waqt ke hisaab se do (subah/dopahar/shaam/raat).` +
          ` Jo reminder ka waqt ABHI SE PEHLE ka hai use "aage karna hai" mat kaho —` +
          ` ya to use chhod do ya "ho gaya hoga" ki tarah halke se chhoo lo.` +
          ` Sirf aane wale kaam par zor do; koi na bacha ho to din ke us hisse ke` +
          ` hisaab se ek chhoti si tasalli wali line likho.`
        : "";
      const reply = await gemini({
        model: MODEL,
        system: `${SAATHI_SYSTEM}${langNote(payload.locale)}${nameNote}${timeNote} User ke aaj ke data se ek chhota warm brief likho (2-3 line). Sirf brief text do.`,
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify({ ...(payload.data ?? {}), now, part }) }],
          },
        ],
        // Wahi baat jo chat/reminder me thi: model pehle soch-vichaar likhta hai
        // aur wo bhi isi budget me ginta hai. 300 par jawab aksar khaali aata.
        maxTokens: 1024,
        track: { kind: "brief", userId: uid },
      });
      return json({ brief: reply });
    }

    return json({ error: "unknown task" }, 400);
  } catch (e) {
    return json({ error: "AI error", detail: String(e) }, 502);
  }
});
