import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Renewal MASTER — guide ka dhaancha khud.
 *
 *   GET    → teeno master (fields, tags, languages)
 *   PUT    → ek row banao/badlo   ({ kind: "field" | "tag" | "language", row })
 *   DELETE → ek row hatao         (?kind=field&key=fees)
 *
 * ⚠️ Pehle guide ka dhaancha CODE me tay tha: har guide me sirf title/steps/note
 * ho sakte the. Naya khaana jodne ke liye app + admin + API teeno badalne padte
 * the, phir app release — yaani content team apne aap kuch naya jod hi nahi
 * sakti thi. Ab dhaancha bhi data hai.
 *
 * ⚠️ `key` hi `content` JSON ki chaabi hai. Isliye key badalna DB me trigger se
 * roka gaya hai (`renewal-master.sql`) — badalte hi us khaane ka saara likha hua
 * content anaath ho jaata: JSON me purani chaabi padi rehti aur app nayi
 * dhoondhti rehti. Yahan bhi wahi rok dohrayi gayi hai, taaki admin ko DB ki
 * kachchi error ke bajaye seedhi baat mile.
 */

const TABLES = {
  field: "renewal_fields",
  tag: "renewal_tags",
  language: "renewal_languages",
} as const;

type Kind = keyof typeof TABLES;

/** `title`/`steps` ke bina app ka renewal card khaali dikhta hai. */
const LOCKED_FIELDS = new Set(["title", "steps"]);

const FIELD_KINDS = ["text", "longtext", "list", "link", "note"];

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function denied(): Promise<NextResponse | null> {
  const g = await guard("renewals");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  return null;
}

function isKind(v: unknown): v is Kind {
  return typeof v === "string" && v in TABLES;
}

/**
 * Key ko saaf karo — sirf a-z, 0-9 aur underscore.
 *
 * Ye JSON ki chaabi banti hai aur URL me bhi jaati hai. Space ya `.` jaisa kuch
 * ghusne par PostgREST ke filter aur JSON path dono tootte hain, aur wo error
 * bahut baad me — content save karte waqt — dikhta hai, jahan uski wajah
 * dhoondhna sabse mushkil hota hai.
 */
function cleanKey(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function str(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
}

function int(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

async function readAll(kind: Kind) {
  const order = kind === "language" ? "sort.asc,code.asc" : "sort.asc,key.asc";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES[kind]}?select=*&order=${order}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>[];
}

export async function GET() {
  const bad = await denied();
  if (bad) return bad;
  try {
    const [fields, tags, languages] = await Promise.all([
      readAll("field"),
      readAll("tag"),
      readAll("language"),
    ]);
    return NextResponse.json({ fields, tags, languages });
  } catch (err) {
    console.error("[admin/renewals/master GET]", err);
    // Migration na chali ho — wahi sabse aam wajah hai, aur uska ilaaj saaf hai.
    // Use aam "load failed" me chhupa dena wo ek din bekaar kar deta hai jo
    // wajah dhoondhne me jaata hai.
    const msg = err instanceof Error ? err.message : "read failed";
    const missing = /does not exist|relation .* does not exist|PGRST205|42P01/i.test(msg);
    return NextResponse.json(
      {
        error: missing ? "migration_missing" : "read failed",
        detail: missing ? "supabase/renewal-master.sql chalao" : msg.slice(0, 300),
      },
      { status: missing ? 503 : 500 },
    );
  }
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

  const kind = body.kind;
  if (!isKind(kind)) {
    return NextResponse.json({ error: "kind: field | tag | language" }, { status: 400 });
  }

  const src = (body.row ?? {}) as Record<string, unknown>;
  let row: Record<string, unknown>;
  let conflict: string;

  if (kind === "language") {
    /*
     * ⚠️ Language code app ke locale se match karna chahiye jahan match ho
     * sakta ho (hinglish/hi/en) — warna app us bhasha ka content kabhi uthayegi
     * hi nahi, aur admin ko lagega ki likha hua kahin kho gaya.
     */
    const code = String(src.code ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!code) return NextResponse.json({ error: "language code chahiye" }, { status: 400 });
    const label = str(src.label);
    if (!label) return NextResponse.json({ error: "label chahiye" }, { status: 400 });
    row = {
      code,
      label,
      native: str(src.native),
      sort: int(src.sort, 100),
      enabled: src.enabled === false ? false : true,
    };
    conflict = "code";
  } else if (kind === "tag") {
    const key = cleanKey(src.key);
    if (!key) return NextResponse.json({ error: "tag ki key chahiye (a-z, 0-9, _)" }, { status: 400 });
    const label = str(src.label);
    if (!label) return NextResponse.json({ error: "label chahiye" }, { status: 400 });
    const color = str(src.color);
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ error: "color #rrggbb hona chahiye" }, { status: 400 });
    }
    row = { key, label, color, sort: int(src.sort, 100), enabled: src.enabled === false ? false : true };
    conflict = "key";
  } else {
    const key = cleanKey(src.key);
    if (!key) return NextResponse.json({ error: "field ki key chahiye (a-z, 0-9, _)" }, { status: 400 });
    const label = str(src.label);
    if (!label) return NextResponse.json({ error: "label chahiye" }, { status: 400 });
    const fkind = String(src.kind_of ?? src.fieldKind ?? "text");
    if (!FIELD_KINDS.includes(fkind)) {
      return NextResponse.json({ error: `kind: ${FIELD_KINDS.join(" | ")}` }, { status: 400 });
    }
    /*
     * title/steps ki `kind` badalna bhi content tod deta hai: `list` se `text`
     * karte hi purana array ek string ke khaane me pahunch jaata hai, aur app
     * usse render nahi kar paati. DB ka trigger sirf key/delete rokta hai —
     * ye rok yahan hai kyunki ye app ke rendering se judi hai, DB se nahi.
     */
    if (LOCKED_FIELDS.has(key)) {
      const want = key === "steps" ? "list" : "text";
      if (fkind !== want) {
        return NextResponse.json(
          {
            error: `"${key}" ki kism "${want}" hi reh sakti hai — app ka renewal card isi shape par tika hai.`,
          },
          { status: 400 },
        );
      }
    }
    row = {
      key,
      label,
      kind: fkind,
      sort: int(src.sort, 100),
      required: src.required === true,
      icon: str(src.icon),
      hint: str(src.hint),
      enabled: src.enabled === false ? false : true,
    };
    conflict = "key";
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES[kind]}?on_conflict=${conflict}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify([row]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const saved = (await res.json()) as unknown[];
    return NextResponse.json({ row: saved[0] ?? row });
  } catch (err) {
    console.error("[admin/renewals/master PUT]", err);
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
  const kind = searchParams.get("kind");
  const key = (searchParams.get("key") ?? "").trim();
  if (!isKind(kind)) {
    return NextResponse.json({ error: "kind: field | tag | language" }, { status: 400 });
  }
  if (!key) return NextResponse.json({ error: "key chahiye" }, { status: 400 });

  // App ka renewal card title/steps par tika hai — inke bina wo khaali dikhta
  // hai. Dikhana band karna ho to `enabled = false` ka raasta khula hai.
  if (kind === "field" && LOCKED_FIELDS.has(key)) {
    return NextResponse.json(
      {
        error: `"${key}" hataya nahi ja sakta — app ka renewal card isi par tika hai. Dikhana band karna ho to use band (disabled) kar do.`,
      },
      { status: 400 },
    );
  }

  const col = kind === "language" ? "code" : "key";
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLES[kind]}?${col}=eq.${encodeURIComponent(key)}`,
      { method: "DELETE", headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    /*
     * ⚠️ Guides me se ye khaana/tag SAAF NAHI kiya jaata, aur ye jaan-boojh ke
     * hai. Field master se row hatane par uska likha hua content JSON me pada
     * rehta hai — app use anadekha kar deti hai, par galti se hataya gaya field
     * dobara banate hi saara purana content wapas dikhne lagta hai. Content ko
     * yahan se mitana us wapasi ka raasta hamesha ke liye band kar deta.
     */
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/renewals/master DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}
