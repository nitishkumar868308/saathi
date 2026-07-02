// Supabase Edge Function: "chat"
// User ka message leta hai → Claude Haiku (Saathi) se reply → wapas bhejta hai.
// Secret chahiye: ANTHROPIC_API_KEY (Supabase Edge Function secrets mein set karo)

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Saathi ki personality
const SYSTEM_PROMPT = `Tum "Saathi" ho — ek warm, caring AI dost jo India ke logon ki rozmarra life sambhalne mein madad karta hai (documents, reminders, dates, aur bas baat-cheet).

Style:
- User jis bhasha mein baat kare (Hindi, English, ya Hinglish) usi mein jawab do — natural, dost jaisa.
- Chhota aur pyaara jawab do. Zaroorat se zyada mat likho.
- Ek samajhdaar dost ki tarah — supportive, thoda casual, kabhi-kabhi ek emoji.
- Agar user kuch yaad rakhne ko kahe (reminder/document/date), toh confirm karo ki tumne samajh liya (abhi actually save nahi hota — woh feature jald aayega, par user ko helpful lago).
- Kabhi jhooth mat bolo ki tumne kuch kar diya jo tum nahi kar sakte. Honest raho.`;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY set nahi hai" }, 500);
  }

  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return json({ error: "message chahiye" }, 400);
    }

    // Purani baat-cheet (optional) + naya message
    const priorMessages = Array.isArray(history) ? history : [];
    const messages = [...priorMessages, { role: "user", content: message }];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5", // sasta + fast
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "AI error", detail }, 502);
    }

    const data = await res.json();
    const reply = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();

    return json({ reply });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
