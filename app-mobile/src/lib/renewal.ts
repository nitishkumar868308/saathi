import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";
import { countryFromTimezone } from "./tz-country";
import { DEFAULT_LOCALE, type Locale } from "./i18n/dictionaries";

/**
 * "Ye document renew kaise karein" — har desh ke liye.
 *
 * User ko sirf ye batana kaafi nahi ki document expire ho raha hai. Uske baad ka
 * sawaal hamesha ek hi hota hai: "ab karun kya?". Ye file usi ka jawab laati
 * hai.
 *
 * Content server par hai (`document_renewal_guides`), code me nahi — sarkari
 * link aur process badalte rehte hain, aur unhe badalne ke liye app release
 * karna padta to wo kabhi update hi na hote.
 *
 * ⚠️ Ab DHAANCHA bhi server par hai (`renewal_fields`), aur yahi is file ka
 * sabse bada badlaav hai. Pehle ek guide me sirf teen cheezein ho sakti thi —
 * `title`, `steps[]`, `note` — kyunki wo teen naam YAHIN code me likhe the.
 * Naya khaana (jaise "Fees", "Kagaz kya lagenge") jodne ke liye app release
 * chahiye tha, yaani wo kabhi jud hi nahi paata tha.
 *
 * Ab guide me wo khaane hote hain jo admin ne banaye, usi tarteeb me jo usne
 * tay ki. App unhe bina jaane render kar deti hai.
 *
 * ⚠️ Do parat, aur yahi is file ki doosri sabse zaroori baat hai:
 *
 *     user ke desh ka content  →  na ho to  →  '*' wala (har desh ke liye)
 *
 * App 190+ deshon me chalti hai. Har desh ka curated content kabhi nahi banega,
 * par jawab har user ko milna chahiye. '*' wale guide desh-nirpeksh likhe jaate
 * hain — wo kisi sarkari portal ka naam nahi lete, balki wo tareeka batate hain
 * jo har jagah chalta hai. Isse do cheezein pakki hoti hain: koi user khaali
 * haath nahi jaata, aur kisi ko DOOSRE desh ka galat link kabhi nahi dikhta.
 */

/** App khaane ko kaise dikhaye. Admin master me tay karta hai. */
export type FieldKind = "text" | "longtext" | "list" | "link" | "note";

export type RenewalField = {
  key: string;
  label: string;
  kind: FieldKind;
  sort: number;
  icon: string | null;
};

/** Ek khaana, dikhane ke liye taiyaar — dhaancha + us guide ki value. */
export type RenewalPart =
  | { key: string; kind: "list"; label: string; icon: string | null; items: string[] }
  | {
      key: string;
      kind: "text" | "longtext" | "link" | "note";
      label: string;
      icon: string | null;
      value: string;
    };

export type RenewalGuide = {
  doc_type: string;
  country: string;
  /** Kisi insaan ne jaancha hai ya AI ne banaya hai. */
  reviewed: boolean;
  /** Master ki tarteeb me, sirf wahi khaane jinme sach me kuch likha hai. */
  parts: RenewalPart[];
  /**
   * Card ka sabse upar wala heading — `title` khaana, jo hai to.
   *
   * Alag se isliye ki card ka header hamesha ek hi jagah rehta hai, chahe admin
   * ne khaanon ki tarteeb kuch bhi rakhi ho.
   */
  title: string;
  /** Pehla `link` khaana — card ke upar wala button. */
  url: string | null;
  /** Pehla `authority` naam wala khaana, jo hai to. */
  authority: string | null;
};

/** Ek bhasha ke khaane: { fieldKey: value }. */
type Body = Record<string, string | string[]>;

type Row = {
  doc_type: string;
  country: string;
  reviewed: boolean;
  content: Record<string, Body>;
  tags?: string[] | null;
};

const CACHE_KEY = "saathi-renewal-guides";
const FIELDS_CACHE_KEY = "saathi-renewal-fields";

/**
 * Wo do khaane jinke bina app ka card khaali dikhta hai.
 *
 * ⚠️ Ye HARDCODED list nahi hai — master me ye jo bhi hain wahi chalte hain. Ye
 * sirf wo do naam hain jinhe card ka header khaas jagah deta hai (heading aur
 * neeche authority ki line). Baaki sab khaane aam tarah se, apni tarteeb me
 * neeche aate hain. Admin in dono ko band kar sakta hai — tab header khaali
 * reh jaata hai par baaki guide poori dikhti hai.
 */
const TITLE_KEY = "title";
const AUTHORITY_KEY = "authority";

/* ------------------------------ desh ------------------------------ */

/**
 * User ka desh — phone ke timezone se.
 *
 * Timezone isliye (IP ya profile nahi): wo offline bhi milta hai, usme koi
 * network call nahi lagti, aur VPN usse nahi badalta. Na mile to `null` —
 * aise me '*' wala guide chalta hai, jo hamesha maujood hai.
 */
export function userCountry(): string | null {
  return countryFromTimezone();
}

/* ------------------------------ laana ------------------------------ */

/**
 * Saare guides aur dhaancha, ek hi baar me.
 *
 * Dono tables chhoti hain, isliye ek saath sab le aana per-document query se
 * kahin sasta hai — aur offline cache bhi tabhi poora kaam karta hai.
 *
 * ⚠️ Dono EK SAATH aane chahiye. Sirf guides aur purana dhaancha (ya ulta)
 * milne par wo soorat banti hai jisme admin ka jodaa naya khaana content me to
 * hai par master me nahi — aur app use chup-chaap gira deti hai. Yaani admin ka
 * likha hua kabhi dikhta hi nahi, aur uski wajah dhoondhna sabse mushkil hota
 * hai.
 */
async function fetchAll(): Promise<{ rows: Row[]; fields: RenewalField[] } | null> {
  if (!supabase) return null;
  try {
    const [guides, fields] = await Promise.all([
      supabase
        .from("document_renewal_guides")
        .select("doc_type,country,reviewed,content,tags"),
      supabase
        .from("renewal_fields")
        .select("key,label,kind,sort,icon")
        .eq("enabled", true)
        .order("sort", { ascending: true }),
    ]);
    if (guides.error) throw guides.error;
    if (fields.error) throw fields.error;
    return {
      rows: (guides.data ?? []) as Row[],
      fields: (fields.data ?? []) as RenewalField[],
    };
  } catch {
    return null;
  }
}

async function readCache<T>(key: string): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/**
 * Guides + dhaancha laao — pehle server se, na mile to cache se.
 *
 * Memory me bhi rakhte hain: ek hi screen par kai document khulte hain, aur har
 * baar AsyncStorage padhna bekaar hai.
 */
let memo: { rows: Row[]; fields: RenewalField[] } | null = null;

export async function loadRenewalGuides(): Promise<{ rows: Row[]; fields: RenewalField[] }> {
  if (memo) return memo;

  const fresh = await fetchAll();
  if (fresh && fresh.rows.length > 0 && fresh.fields.length > 0) {
    memo = fresh;
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh.rows)).catch(() => {});
    AsyncStorage.setItem(FIELDS_CACHE_KEY, JSON.stringify(fresh.fields)).catch(() => {});
    return fresh;
  }

  const [rows, fields] = await Promise.all([
    readCache<Row>(CACHE_KEY),
    readCache<RenewalField>(FIELDS_CACHE_KEY),
  ]);
  memo = { rows: rows ?? [], fields: fields ?? [] };
  return memo;
}

/** Language/logout par memo saaf — warna purani bhasha ka content chipka rehta. */
export function clearRenewalMemo(): void {
  memo = null;
}

/* ------------------------------ chunna ------------------------------ */

/**
 * Is locale ke khaane nikaalo.
 *
 * Girne ka kram: maangi hui bhasha → app ka default → jo bhi maujood ho. Khaali
 * lautane se behtar hai thodi doosri bhasha me sahi jaankari dena — user kam se
 * kam kaam to kar paayega.
 *
 * ⚠️ "Bhara hua" ka matlab hai usme kuch LIKHA bhi ho. Sirf key ka hona kaafi
 * nahi: admin ne bhasha kholi aur khaali chhod di, to us bhasha ka khaali khaana
 * poore fallback ko rok deta — aur user ko khaali card dikhta, jabki doosri
 * bhasha me poora jawab pada hota.
 */
function pickBody(content: Record<string, Body>, locale: Locale): Body | null {
  const order = [locale as string, DEFAULT_LOCALE as string];
  for (const l of order) {
    const b = content?.[l];
    if (hasSomething(b)) return b;
  }
  for (const b of Object.values(content ?? {})) {
    if (hasSomething(b)) return b;
  }
  return null;
}

function hasSomething(b: Body | undefined): boolean {
  if (!b || typeof b !== "object") return false;
  return Object.values(b).some((v) =>
    Array.isArray(v) ? v.some((s) => String(s).trim()) : String(v ?? "").trim(),
  );
}

/**
 * Dhaancha + content → dikhane layak khaane.
 *
 * ⚠️ Tarteeb MASTER se aati hai, content se nahi. JSON me keys ka kram bharne
 * ke hisaab se hota hai (jo admin ne pehle likha wo pehle) — usse chalane par
 * wahi guide alag-alag phone par alag kram me dikhti.
 *
 * ⚠️ Aur wahi khaane aate hain jo master me hain. Master se hataya gaya khaana
 * content me pada rehta hai (jaan-boojh ke — dobara banate hi wapas aa jaata
 * hai), par dikhta nahi.
 */
function buildParts(body: Body, fields: RenewalField[]): RenewalPart[] {
  const parts: RenewalPart[] = [];

  for (const f of fields) {
    const v = body[f.key];

    if (f.kind === "list") {
      const items = Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];
      if (items.length > 0) {
        parts.push({ key: f.key, kind: "list", label: f.label, icon: f.icon, items });
      }
      continue;
    }

    // List ke alawa sab me array aa jaye (admin ne field ki kism badli ho) to
    // use jod ke dikha dete hain — khaali chhodne se behtar hai.
    const value = Array.isArray(v)
      ? v.map((s) => String(s).trim()).filter(Boolean).join("\n")
      : String(v ?? "").trim();
    if (value) {
      parts.push({ key: f.key, kind: f.kind, label: f.label, icon: f.icon, value });
    }
  }

  return parts;
}

/**
 * Is document ke liye renewal guide.
 *
 * Country match sabse pehle; na mile to '*'. Type na mile to 'other' —
 * yaani jawab hamesha kuch na kuch milta hai (agar admin ne 'other' banaya ho).
 */
export async function renewalFor(
  docType: string,
  locale: Locale,
  country: string | null = userCountry(),
): Promise<RenewalGuide | null> {
  const { rows, fields } = await loadRenewalGuides();
  if (rows.length === 0 || fields.length === 0) return null;

  const find = (type: string, c: string) =>
    rows.find((r) => r.doc_type === type && r.country === c);

  const row =
    (country ? find(docType, country) : undefined) ??
    find(docType, "*") ??
    (country ? find("other", country) : undefined) ??
    find("other", "*");

  if (!row) return null;
  const body = pickBody(row.content, locale);
  if (!body) return null;

  const parts = buildParts(body, fields);
  if (parts.length === 0) return null;

  /*
   * Header ke teen tukde card ke liye alag nikaalte hain, aur unhe `parts` se
   * HATA dete hain — warna wahi cheez do baar dikhti: ek baar header me, ek
   * baar neeche list me.
   */
  const titlePart = parts.find((p) => p.key === TITLE_KEY && p.kind !== "list");
  const authPart = parts.find((p) => p.key === AUTHORITY_KEY && p.kind !== "list");
  const linkPart = parts.find((p) => p.kind === "link");

  const used = new Set([titlePart?.key, authPart?.key, linkPart?.key].filter(Boolean));

  return {
    doc_type: row.doc_type,
    country: row.country,
    reviewed: row.reviewed,
    title: titlePart && titlePart.kind !== "list" ? titlePart.value : "",
    authority: authPart && authPart.kind !== "list" ? authPart.value : null,
    url: linkPart && linkPart.kind !== "list" ? linkPart.value : null,
    parts: parts.filter((p) => !used.has(p.key)),
  };
}
