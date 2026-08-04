import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import { translateConfigured, translateMessage } from "@/lib/translate";
import type { Loc } from "@/lib/reminder-channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * "Ye document renew kaise karein" — admin panel se.
 *
 *   GET  → saare guides
 *   PUT  → ek guide save (upsert), aur maanga ho to baaki bhashaon me anuvaad
 *   DELETE → ek guide hatao
 *
 * ⚠️ Ye content code me hardcode nahi ho sakta: sarkari URL aur process badalte
 * rehte hain, aur unhe badalne ke liye app release karna padta to wo kabhi
 * update hi na hote. Isliye poora content yahan se editable hai.
 *
 * ⚠️ Aur ye sirf India ke liye nahi hai. App har desh me chalti hai, isliye har
 * doc_type ki ek `country = '*'` row hoti hai — wo desh-nirpeksh jawab jo har
 * user ko milta hai jab tak uske desh ka apna content na bane. Us safety-net
 * row ko delete karna mana hai (neeche DELETE me rok lagi hai): usse us document
 * type par kuch bhi na dikhne wali soorat ban jaati.
 */

const LOCALES: Loc[] = ["hinglish", "hi", "en"];

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function guard() {
  if (!isAuthed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  return null;
}

type RenewalText = { title: string; steps: string[]; note?: string | null };

export async function GET() {
  const bad = guard();
  if (bad) return bad;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/document_renewal_guides?select=*&order=doc_type.asc,country.asc`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return NextResponse.json({
      guides: await res.json(),
      translateOn: translateConfigured(),
    });
  } catch (err) {
    console.error("[admin/renewals GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}

/**
 * Steps ko ek hi text me jodo (anuvaad ke liye) aur wapas todo.
 *
 * `translateMessage` ek {subject, message} jodi par chalta hai — usi ek raaste
 * ko dobara istemaal karna, anuvaad ka doosra system banane se kahin behtar hai.
 * Steps ko line-break se jodte hain kyunki wo prompt line-break bilkul waise hi
 * rakhne ko kehta hai.
 */
const STEP_SEP = "\n";

function packText(t: RenewalText): { subject: string; message: string } {
  const note = t.note?.trim();
  return {
    subject: t.title,
    // Note ko steps se alag rakhne ke liye ek khaali line — wapas todte waqt
    // isi se pehchana jaata hai.
    message: note ? `${t.steps.join(STEP_SEP)}\n\n${note}` : t.steps.join(STEP_SEP),
  };
}

function unpackText(m: { subject: string; message: string }): RenewalText {
  const [stepsPart, ...noteParts] = m.message.split(/\n\s*\n/);
  const steps = stepsPart
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const note = noteParts.join("\n\n").trim();
  return { title: m.subject.trim(), steps, note: note || null };
}

export async function PUT(request: Request) {
  const bad = guard();
  if (bad) return bad;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const doc_type = String(body.doc_type ?? "").trim();
  const country = String(body.country ?? "*").trim().toUpperCase();
  if (!doc_type) return NextResponse.json({ error: "doc_type chahiye" }, { status: 400 });
  // '*' upper-case se nahi bigadta, par baaki sab ISO2 hi hone chahiye.
  if (country !== "*" && !/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: "country ISO2 ya '*' hona chahiye" }, { status: 400 });
  }

  const str = (v: unknown) => {
    const t = typeof v === "string" ? v.trim() : "";
    return t ? t : null;
  };

  // Admin jis bhasha me likh raha hai.
  const srcLoc = (LOCALES.includes(body.source_locale as Loc) ? body.source_locale : "hinglish") as Loc;
  const src = body.text as Partial<RenewalText> | undefined;
  const title = str(src?.title);
  const steps = Array.isArray(src?.steps)
    ? (src.steps as unknown[]).map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (!title || steps.length === 0) {
    return NextResponse.json({ error: "title aur kam se kam ek step chahiye" }, { status: 400 });
  }

  const srcText: RenewalText = { title, steps, note: str(src?.note) };

  // Jo pehle se saved hai use rakhte hain — anuvaad sirf uske upar chadhta hai.
  const content: Record<string, RenewalText> = {
    ...((body.existing_content as Record<string, RenewalText> | undefined) ?? {}),
    [srcLoc]: srcText,
  };

  /**
   * Baaki bhashayein.
   *
   * Alag row per locale rakhne ka matlab hota admin ko har cheez TEEN baar
   * likhni — aur practice me teesri bhasha hamesha adhoori reh jaati. Ek click
   * me anuvaad ho jaana hi wo raasta hai jispar teeno bhasha sach me bharti
   * rehti hain.
   *
   * Fail ho to save phir bhi hota hai: adhoora anuvaad, save na hone se behtar
   * hai (app waise bhi hinglish par gir jaati hai).
   */
  if (body.translate && translateConfigured()) {
    const targets = LOCALES.filter((l) => l !== srcLoc);
    try {
      const out = await translateMessage(packText(srcText), targets, { sourceLanguage: srcLoc });
      for (const l of targets) content[l] = unpackText(out[l]);
    } catch (err) {
      console.error("[admin/renewals translate]", err);
    }
  }

  const row = {
    doc_type,
    country,
    url: str(body.url),
    authority: str(body.authority),
    content,
    // Admin ne khud haath lagaya = ab ye jaancha hua maana jaayega.
    reviewed: body.reviewed === false ? false : true,
    updated_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/document_renewal_guides?on_conflict=doc_type,country`,
      {
        method: "POST",
        headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify([row]),
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const saved = (await res.json()) as unknown[];
    return NextResponse.json({ guide: saved[0] ?? row });
  } catch (err) {
    console.error("[admin/renewals PUT]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const bad = guard();
  if (bad) return bad;

  const { searchParams } = new URL(request.url);
  const doc_type = (searchParams.get("doc_type") ?? "").trim();
  const country = (searchParams.get("country") ?? "").trim().toUpperCase();
  if (!doc_type || !country) {
    return NextResponse.json({ error: "doc_type aur country chahiye" }, { status: 400 });
  }

  // ⚠️ '*' wali row har desh ka safety net hai. Use hatane par un saare deshon
  // par — jinka apna content nahi bana — is document type ke liye kuch bhi nahi
  // dikhega. Badalna theek hai, hataana nahi.
  if (country === "*") {
    return NextResponse.json(
      { error: "'*' wali row har desh ka fallback hai — ise hata nahi sakte, sirf badal sakte ho." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/document_renewal_guides?doc_type=eq.${encodeURIComponent(doc_type)}&country=eq.${encodeURIComponent(country)}`,
      { method: "DELETE", headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/renewals DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}
