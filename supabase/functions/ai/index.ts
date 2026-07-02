// Saathi — ek hi AI function (chat + document scan + reminder parse + daily brief).
// Claude Haiku (sasta + vision). Secret chahiye: ANTHROPIC_API_KEY.
// App is function ko { task, ... } bhejti hai.

const KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5"; // sasta — chat, reminder, brief
const VISION_MODEL = "claude-sonnet-4-6"; // document reading — thoda better + accurate

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

async function claude(body: unknown): Promise<any> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
}

// JSON reply se pehla {...} nikaalta hai
function parseJson(text: string): any {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

const SAATHI_SYSTEM = `Tum "Saathi" ho — ek warm, caring AI dost (India ke liye). User jis bhasha mein baat kare (Hindi/English/Hinglish) usi mein chhota, pyaara jawab do. Zaroorat se zyada mat likho. Ek emoji kabhi-kabhi. Honest raho.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!KEY) return json({ error: "ANTHROPIC_API_KEY set nahi hai" }, 500);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const task = payload.task ?? "chat";

  try {
    // 1. CHAT
    if (task === "chat") {
      const nameNote = payload.name
        ? ` User ka naam "${payload.name}" hai — kabhi-kabhi naam se bulao, natural.`
        : "";
      const messages = [...(payload.history ?? []), { role: "user", content: payload.message ?? "" }];
      const reply = await claude({
        model: MODEL,
        max_tokens: 1024,
        system: SAATHI_SYSTEM + nameNote,
        messages,
      });
      return json({ reply });
    }

    // 2. DOCUMENT SCAN (vision) — base64 image se {type, name, expiry}
    if (task === "scan") {
      const b64 = payload.image;
      if (!b64) return json({ error: "image chahiye" }, 400);
      const system = `Tum ek document reader ho. Image se document samajh ke SIRF JSON do (aur kuch nahi):
{"type": one of ["car","license","passport","fastag","warranty","health","other"], "name": "chhota naam jaise 'Car Insurance'", "expiry": "YYYY-MM-DD ya null"}
type: insurance/RC/vehicle = car; driving licence = license; health/life insurance = health; warranty/guarantee = warranty. Expiry/valid till date dhoondo. Na mile to null.`;
      const text = await claude({
        model: VISION_MODEL,
        max_tokens: 400,
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
              { type: "text", text: "Is document ka JSON do." },
            ],
          },
        ],
      });
      return json(parseJson(text) ?? { type: "other", name: "", expiry: null });
    }

    // 3. REMINDER PARSE — text se {title, remind_at, label}
    if (task === "reminder") {
      const now = payload.now ?? new Date().toISOString();
      const system = `Abhi ka time (ISO): ${now}. User ke reminder text se SIRF JSON do:
{"title": "kaam (time-phrase ke bina)", "remind_at": "ISO 8601 datetime", "label": "chhota Hinglish time jaise '1 minute baad' ya 'Kal subah 8 baje'"}
"1 minute baad", "2 ghante baad", "kal subah", "aaj raat 9 baje" jaise samajho. Agar time clear na ho to remind_at null.`;
      const text = await claude({
        model: MODEL,
        max_tokens: 300,
        system,
        messages: [{ role: "user", content: payload.text ?? "" }],
      });
      return json(parseJson(text) ?? { title: payload.text ?? "", remind_at: null, label: null });
    }

    // 4. DAILY BRIEF
    if (task === "brief") {
      const nameNote = payload.name ? ` User ka naam "${payload.name}" hai — naam se greet karo.` : "";
      const system = `${SAATHI_SYSTEM}${nameNote} User ke aaj ke data se ek chhota warm morning brief likho (2-3 line, Hinglish). Sirf brief text do.`;
      const reply = await claude({
        model: MODEL,
        max_tokens: 300,
        system,
        messages: [{ role: "user", content: JSON.stringify(payload.data ?? {}) }],
      });
      return json({ brief: reply });
    }

    return json({ error: "unknown task" }, 400);
  } catch (e) {
    return json({ error: "AI error", detail: String(e) }, 502);
  }
});
