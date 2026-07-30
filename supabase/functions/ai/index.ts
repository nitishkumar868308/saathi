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
// ⚠️ Fixed model naam (gemini-2.5-flash / -flash-lite) naye users ke liye band ho
//    gaye the → 404 "no longer available to new users" → AI fail hoke static
//    fallback pe chala jaata tha. Ab "-latest" alias use karte hain, jo hamesha
//    current model pe point karta hai — aage bhi nahi tootega.
const MODEL = "gemini-flash-lite-latest"; // chat, reminder, brief — sasta/fast
const VISION_MODEL = "gemini-flash-latest"; // document reading — accurate

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
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (opts.track) {
      // Fail bhi ginte hain — retry ka apna kharcha hota hai, aur "AI kaam nahi
      // kar raha" wali shikayat ka sabse pehla sabooot yahi hota hai.
      void logUsage(opts.track.kind, 0, false, opts.track.userId, {
        model: opts.model,
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
        model: opts.model,
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
      const scope =
        ` TUM SIRF is app "Apka Saathi" ke baare me madad karte ho: (a) user ke reminders, tasks, documents aur unki expiry/dates, (b) app kaise use karein,` +
        ` (c) app khud kya hai — features aur Saathi Plus plan.` +
        ` Agar user in se HATKE kuch pooche (general knowledge, duniya, news, math, coding, gossip, kuch bhi bahar ka), to jawab BILKUL mat do —` +
        ` politely mana karo aur yahi bhaav do: "${declineLine(payload.locale)}".`;

      // AGENTIC: chat se hi reminder ban jaaye — zaroori detail pucho, phir action do.
      const agentic =
        `\n\nAGENTIC REMINDER: Agar user kuch yaad dilane / reminder / alarm set karne ko kahe:` +
        ` 3 cheezein chahiye — (1) kaam kya (title), (2) kaunsa din, (3) kaun sa time.` +
        ` Jo missing ho wo pyaar se pucho (reply me, ek-do sawaal). Jab tak title AUR poora date+time na mile, action null rakho.` +
        ` Sab clear hote hi action bharo: {"type":"create_reminder","title":"<saaf kaam, bina time-phrase>","remind_at":"<naive local ISO jaise 2026-07-27T20:00:00, bina Z ya offset>","repeat_every_days":<number ya null>,"repeat_until":"<YYYY-MM-DD ya null>"}.` +
        ` Abhi ka local time: ${now}. Isi se remind_at nikaalo — "kal"=agla din, "subah 8"=08:00, "shaam 6"/"6 baje shaam"=18:00, "raat 9"=21:00, "dopahar 2"=14:00, "N minute/ghante baad"=abhi se aage.` +
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
        `\n\nOUTPUT: SIRF strict JSON do, aur kuch nahi: {"reply":"<chat message, user ki bhasha me>","action": null | {create_reminder|navigate}}. reply HAMESHA bharo, chhota rakho.`;

      const userMsg = payload.message ?? "";
      // Trimming: sirf aakhri 10 turns bhejo (token + cost kam, prompt cache friendly).
      const history: GeminiContent[] = (payload.history ?? [])
        .slice(-10)
        .map((h: any) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: String(h.content ?? "") }],
        }));

      const raw = await gemini({
        model: MODEL,
        system: SAATHI_SYSTEM + langNote(payload.locale) + scope + agentic + nameNote + ctx,
        contents: [...history, { role: "user", parts: [{ text: userMsg }] }],
        json: true,
        maxTokens: 700,
        track: { kind: "chat", userId: uid },
      });

      const parsed = parseJson(raw) ?? {};
      // ⚠️ Model ka JSON toota ho to pehle yahan DECLINE line jaati thi — user ko
      // lagta tha Saathi ne mana kar diya, jabki ye sirf ek parse fail tha.
      // Ab saaf kehta hai "dobara bolo" (item 15).
      const reply =
        typeof parsed.reply === "string" && parsed.reply.trim()
          ? parsed.reply.trim()
          : retryLine(payload.locale);

      // Action sanitize — sirf allowed shapes.
      let action: unknown = null;
      const a = parsed.action;
      if (a && typeof a === "object") {
        if (a.type === "create_reminder" && typeof a.title === "string" && typeof a.remind_at === "string") {
          action = {
            type: "create_reminder",
            title: a.title.trim(),
            remind_at: a.remind_at,
            ...repeatFields(a),
          };
        } else if (a.type === "navigate" && a.to === "add_document") {
          action = { type: "navigate", to: "add_document" };
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
        maxTokens: 400,
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
        maxTokens: 300,
        track: { kind: "reminder", userId: uid },
      });
      const r = parseJson(text);
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
        maxTokens: 400,
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

    // 5. DAILY BRIEF
    if (task === "brief") {
      const nameNote = payload.name ? ` User ka naam "${payload.name}" hai — naam se greet karo.` : "";
      const reply = await gemini({
        model: MODEL,
        system: `${SAATHI_SYSTEM}${langNote(payload.locale)}${nameNote} User ke aaj ke data se ek chhota warm morning brief likho (2-3 line). Sirf brief text do.`,
        contents: [{ role: "user", parts: [{ text: JSON.stringify(payload.data ?? {}) }] }],
        maxTokens: 300,
        track: { kind: "brief", userId: uid },
      });
      return json({ brief: reply });
    }

    return json({ error: "unknown task" }, 400);
  } catch (e) {
    return json({ error: "AI error", detail: String(e) }, 502);
  }
});
