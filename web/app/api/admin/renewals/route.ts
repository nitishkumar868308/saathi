import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { translateConfigured, translateFields, type FieldMap } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * "Ye document renew kaise karein" — admin panel se.
 *
 *   GET  → saare guides + master (fields/tags/languages)
 *   PUT  → ek guide save (upsert), aur maanga ho to baaki bhashaon me anuvaad
 *   DELETE → ek guide hatao
 *
 * ⚠️ Ye content code me hardcode nahi ho sakta: sarkari URL aur process badalte
 * rehte hain, aur unhe badalne ke liye app release karna padta to wo kabhi
 * update hi na hote. Isliye poora content yahan se editable hai.
 *
 * ⚠️ Aur ab DHAANCHA bhi yahan se hai. Pehle har guide me sirf title/steps/note
 * ho sakte the — wo teen naam code me likhe the. Ab guide me wo khaane hote hain
 * jo `renewal_fields` me admin ne banaye (`/api/admin/renewals/master`), aur
 * `content` ka shape hai:
 *
 *     { "<bhasha>": { "<field key>": <value> } }
 *
 * Purana shape iska hissa hai — title/steps/note ab bas teen aam field rows
 * hain. Isliye purana content bina chhue chalta rehta hai.
 *
 * ⚠️ Aur ye sirf India ke liye nahi hai. App har desh me chalti hai, isliye har
 * doc_type ki ek `country = '*'` row honi chahiye — wo desh-nirpeksh jawab jo
 * har user ko milta hai jab tak uske desh ka apna content na bane. Us safety-net
 * row ko delete karna mana hai (neeche DELETE me rok lagi hai): usse us document
 * type par kuch bhi na dikhne wali soorat ban jaati.
 */

type FieldRow = {
  key: string;
  label: string;
  kind: "text" | "longtext" | "list" | "link" | "note";
  sort: number;
  required: boolean;
  icon: string | null;
  hint: string | null;
  enabled: boolean;
};

type LangRow = { code: string; label: string; native: string | null; sort: number; enabled: boolean };

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Har handler ka pehla pehra — 401/403/503 ka response, ya null (sab theek). */
async function denied(): Promise<NextResponse | null> {
  const g = await guard("renewals");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  return null;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function GET() {
  const bad = await denied();
  if (bad) return bad;
  try {
    /*
     * Master bhi yahin se jaata hai, alag call se nahi.
     *
     * Editor master ke BINA kuch bhi nahi dikha sakta — use pata hi nahi hota
     * ki guide me kaun se khaane hain. Do alag call ka matlab hota ek chhota sa
     * pal jisme guides aa chuke hain par dhaancha nahi, aur us pal me screen
     * "guide khaali hai" jaisi dikhti hai.
     */
    const [guides, fields, tags, languages] = await Promise.all([
      fetchJson<unknown[]>("document_renewal_guides?select=*&order=doc_type.asc,country.asc"),
      fetchJson<FieldRow[]>("renewal_fields?select=*&order=sort.asc,key.asc"),
      fetchJson<unknown[]>("renewal_tags?select=*&order=sort.asc,key.asc"),
      fetchJson<LangRow[]>("renewal_languages?select=*&order=sort.asc,code.asc"),
    ]);
    return NextResponse.json({
      guides,
      fields,
      tags,
      languages,
      translateOn: translateConfigured(),
    });
  } catch (err) {
    console.error("[admin/renewals GET]", err);
    const msg = err instanceof Error ? err.message : "read failed";
    // Migration na chali ho — wahi sabse aam wajah hai, aur uska ilaaj saaf hai.
    const missing = /does not exist|relation .* does not exist|PGRST205|42P01/i.test(msg);
    return NextResponse.json(
      {
        error: missing ? "migration_missing" : msg,
        detail: missing ? "supabase/renewal-master.sql chalao" : undefined,
      },
      { status: missing ? 503 : 500 },
    );
  }
}

/**
 * Ek bhasha ke khaane saaf karo — master ke hisaab se.
 *
 * Master me jo khaana hai hi nahi, wo yahin gir jaata hai. Ye zaroori hai:
 * anjaan chaabi content JSON me hamesha ke liye pad jaati hai, app use kabhi
 * nahi dikhati, aur admin ko lagta rehta hai ki usne likha to tha.
 */
function cleanBody(raw: unknown, fields: FieldRow[]): { body: FieldMap; missing: string[] } {
  const src = (raw ?? {}) as Record<string, unknown>;
  const body: FieldMap = {};
  const missing: string[] = [];

  for (const f of fields) {
    if (!f.enabled) continue;
    const v = src[f.key];

    if (f.kind === "list") {
      const list = Array.isArray(v)
        ? v.map((s) => String(s).trim()).filter(Boolean)
        : [];
      if (list.length > 0) body[f.key] = list;
      else if (f.required) missing.push(f.label);
      continue;
    }

    const s = typeof v === "string" ? v.trim() : "";
    if (s) body[f.key] = s;
    else if (f.required) missing.push(f.label);
  }

  return { body, missing };
}

export async function PUT(request: Request) {
  const bad = await denied();
  if (bad) return bad;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const doc_type = String(body.doc_type ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const country = String(body.country ?? "*").trim().toUpperCase();
  if (!doc_type) return NextResponse.json({ error: "doc_type chahiye" }, { status: 400 });
  // '*' upper-case se nahi bigadta, par baaki sab ISO2 hi hone chahiye.
  if (country !== "*" && !/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: "country ISO2 ya '*' hona chahiye" }, { status: 400 });
  }

  let fields: FieldRow[];
  let languages: LangRow[];
  try {
    [fields, languages] = await Promise.all([
      fetchJson<FieldRow[]>("renewal_fields?select=*&order=sort.asc,key.asc"),
      fetchJson<LangRow[]>("renewal_languages?select=*&enabled=is.true&order=sort.asc,code.asc"),
    ]);
  } catch (err) {
    console.error("[admin/renewals PUT master]", err);
    return NextResponse.json({ error: "master padha nahi ja saka" }, { status: 500 });
  }

  /*
   * Admin jis bhasha me likh raha hai.
   *
   * ⚠️ Ye ab kisi tay list se nahi, LANGUAGE MASTER se aati hai. Us list me na
   * ho to save rokte hain — warna content aisi chaabi par chala jaata jise app
   * kabhi dhoondhti hi nahi.
   */
  const srcLoc = String(body.source_locale ?? "").trim().toLowerCase();
  if (!languages.some((l) => l.code === srcLoc)) {
    return NextResponse.json(
      { error: `bhasha "${srcLoc}" language master me nahi hai` },
      { status: 400 },
    );
  }

  const { body: srcBody, missing } = cleanBody(body.text, fields);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `ye khaane zaroori hain: ${missing.join(", ")}` },
      { status: 400 },
    );
  }
  if (Object.keys(srcBody).length === 0) {
    return NextResponse.json({ error: "kam se kam ek khaana bharo" }, { status: 400 });
  }

  // Jo pehle se saved hai use rakhte hain — anuvaad sirf uske upar chadhta hai.
  const existing = (body.existing_content as Record<string, FieldMap> | undefined) ?? {};
  const content: Record<string, FieldMap> = { ...existing, [srcLoc]: srcBody };

  /**
   * Baaki bhashayein.
   *
   * Alag row per locale rakhne ka matlab hota admin ko har cheez har bhasha me
   * likhni — aur practice me aakhri bhasha hamesha adhoori reh jaati. Ek click
   * me anuvaad ho jaana hi wo raasta hai jispar saari bhasha sach me bharti
   * rehti hain.
   *
   * Fail ho to save phir bhi hota hai: adhoora anuvaad, save na hone se behtar
   * hai (app waise bhi default bhasha par gir jaati hai).
   */
  if (body.translate && translateConfigured()) {
    const targets = languages
      .filter((l) => l.code !== srcLoc)
      .map((l) => ({ code: l.code, label: l.native ? `${l.label} (${l.native})` : l.label }));
    if (targets.length > 0) {
      try {
        // URL wale khaane anuvaad se bahar — toota hua sarkari link, link na
        // hone se bura hai.
        const skipKeys = fields.filter((f) => f.kind === "link").map((f) => f.key);
        const out = await translateFields(srcBody, targets, {
          sourceLabel: languages.find((l) => l.code === srcLoc)?.label ?? srcLoc,
          skipKeys,
        });
        for (const t of targets) content[t.code] = out[t.code];
      } catch (err) {
        console.error("[admin/renewals translate]", err);
      }
    }
  }

  // Tag master me jo hai hi nahi, wo yahin gir jaata hai — warna guide par ek
  // aisa chip lag jaata jiska koi label aur rang kahin nahi hota.
  let tags: string[] = [];
  if (Array.isArray(body.tags)) {
    try {
      const known = new Set(
        (await fetchJson<{ key: string }[]>("renewal_tags?select=key")).map((t) => t.key),
      );
      tags = Array.from(
        new Set((body.tags as unknown[]).map((t) => String(t).trim()).filter((t) => known.has(t))),
      );
    } catch {
      // Tag master padha na ja saka — tags chhod do, guide phir bhi save ho.
      // Tag ek label hai, guide ki jaan nahi.
      tags = [];
    }
  }

  const row = {
    doc_type,
    country,
    content,
    tags,
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
  const bad = await denied();
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
