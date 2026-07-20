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
const MODEL = "gemini-2.5-flash-lite"; // chat, reminder, brief — sasta
const VISION_MODEL = "gemini-2.5-flash"; // document reading — accurate

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

type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

/** Ek Gemini generateContent call. Sirf text lautata hai. */
async function gemini(opts: {
  model: string;
  system: string;
  contents: GeminiContent[];
  json?: boolean;
  maxTokens?: number;
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
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
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

/** Out-of-scope decline (locale-aware) — jab user app ke bahar ka sawaal pooche. */
function declineLine(locale?: string): string {
  switch (locale) {
    case "hi":
      return "फ़िलहाल मैं सिर्फ़ आपके reminders, tasks और documents से जुड़ी बातों में मदद कर सकता हूँ। 🙂 बाक़ी सब भी बहुत जल्द ला रहे हैं!";
    case "en":
      return "Right now I can only help with your reminders, tasks and documents. 🙂 Everything else is coming very soon!";
    case "hinglish":
    default:
      return "Abhi main sirf aapke reminders, tasks aur documents se judi cheezon me madad kar sakta hoon. 🙂 Baaki sab bhi bahut jald aa raha hai!";
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

  try {
    // 1. CHAT — sirf app ke sawaal (reminders/tasks/documents). Bahar ka nahi.
    if (task === "chat") {
      const nameNote = payload.name
        ? ` User ka naam "${payload.name}" hai — kabhi-kabhi naam se bulao, natural.`
        : "";
      // App user ka apna data bhejti hai (reminders + documents ka chhota snapshot),
      // taaki "mere reminders kaun se hain?", "kya expire ho raha hai?" jaise
      // sawaal ka sahi jawab mile.
      const ctx = payload.context
        ? `\n\nUser ka abhi ka data (isi se jawab do, aur kuch mat maano):\n${JSON.stringify(payload.context)}`
        : "";
      const scope =
        ` TUM SIRF is app ke baare me madad karte ho: user ke reminders, tasks, documents, unki expiry/dates, aur app kaise use karein.` +
        ` Agar user in se HATKE kuch pooche (general knowledge, duniya, news, math, coding, gossip, kuch bhi bahar ka), to us sawaal ka jawab BILKUL mat do —` +
        ` politely mana karo aur bilkul yahi bhaav do: "${declineLine(payload.locale)}".` +
        ` App ke data ke sawaal ka seedha, chhota, sateek jawab do.`;

      const userMsg = payload.message ?? "";
      const history: GeminiContent[] = (payload.history ?? []).map((h: any) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: String(h.content ?? "") }],
      }));
      const reply = await gemini({
        model: MODEL,
        system: SAATHI_SYSTEM + langNote(payload.locale) + scope + nameNote + ctx,
        contents: [...history, { role: "user", parts: [{ text: userMsg }] }],
        maxTokens: 800,
      });

      // Server-side record (referral qualification "first chat" isi se verify hota hai).
      const uid = await getUserId(req);
      if (uid && userMsg.trim()) await recordChat(uid, userMsg, reply);

      return json({ reply: reply || declineLine(payload.locale) });
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
        maxTokens: 400,
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
{"title": "kaam kya hai (time/date phrase ke bina, saaf)", "remind_at": "ISO 8601 datetime ya null", "label": "chhota ${labelLang}", "needsDate": boolean, "needsTime": boolean}

Rules:
- Sochne ka context: "subah 6" = 06:00, "shaam 6" ya "6 baje shaam" = 18:00, "raat 9" = 21:00, "dopahar 2" = 14:00.
- "kal" = agla din, "parso" = uske agle din, "aaj" = today, "N minute/ghante baad" = abhi se aage.
- "3 tarikh" jaisi date: agar wo din is mahine me nikal chuka hai to agla mahina, warna isi mahina.
- Agar date bilkul clear nahi → needsDate=true. Agar time bilkul clear nahi (jaise sirf "kal") → needsTime=true aur uska time abhi mat maano.
- Agar sab clear hai to remind_at bharo aur needsDate/needsTime false.`;
      const text = await gemini({
        model: MODEL,
        system,
        contents: [{ role: "user", parts: [{ text: payload.text ?? "" }] }],
        json: true,
        maxTokens: 300,
      });
      return json(
        parseJson(text) ?? {
          title: payload.text ?? "",
          remind_at: null,
          label: null,
          needsDate: true,
          needsTime: true,
        },
      );
    }

    // 4. DAILY BRIEF
    if (task === "brief") {
      const nameNote = payload.name ? ` User ka naam "${payload.name}" hai — naam se greet karo.` : "";
      const reply = await gemini({
        model: MODEL,
        system: `${SAATHI_SYSTEM}${langNote(payload.locale)}${nameNote} User ke aaj ke data se ek chhota warm morning brief likho (2-3 line). Sirf brief text do.`,
        contents: [{ role: "user", parts: [{ text: JSON.stringify(payload.data ?? {}) }] }],
        maxTokens: 300,
      });
      return json({ brief: reply });
    }

    return json({ error: "unknown task" }, 400);
  } catch (e) {
    return json({ error: "AI error", detail: String(e) }, 502);
  }
});
