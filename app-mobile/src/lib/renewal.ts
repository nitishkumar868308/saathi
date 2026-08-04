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
 * ⚠️ Do parat, aur yahi is file ki sabse zaroori baat hai:
 *
 *     user ke desh ka content  →  na ho to  →  '*' wala (har desh ke liye)
 *
 * App 190+ deshon me chalti hai. Har desh ka curated content kabhi nahi banega,
 * par jawab har user ko milna chahiye. '*' wale guide desh-nirpeksh likhe gaye
 * hain — wo kisi sarkari portal ka naam nahi lete, balki wo tareeka batate hain
 * jo har jagah chalta hai. Isse do cheezein pakki hoti hain: koi user khaali
 * haath nahi jaata, aur kisi ko DOOSRE desh ka galat link kabhi nahi dikhta.
 */

export type RenewalText = {
  title: string;
  steps: string[];
  note?: string | null;
};

export type RenewalGuide = {
  doc_type: string;
  country: string;
  /** Official link. null = is cheez ka koi ek portal hota hi nahi. */
  url: string | null;
  authority: string | null;
  /** Kisi insaan ne jaancha hai ya AI ne banaya hai. */
  reviewed: boolean;
  text: RenewalText;
};

type Row = {
  doc_type: string;
  country: string;
  url: string | null;
  authority: string | null;
  reviewed: boolean;
  content: Partial<Record<Locale, RenewalText>>;
};

const CACHE_KEY = "saathi-renewal-guides";

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
 * Saare guides ek hi baar me.
 *
 * Poori table chhoti hai (doc types × wo desh jinka content bana hai), isliye
 * ek hi request me sab le aana per-document query se kahin sasta hai — aur
 * offline cache bhi tabhi poora kaam karta hai.
 */
async function fetchAll(): Promise<Row[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("document_renewal_guides")
      .select("doc_type,country,url,authority,reviewed,content");
    if (error) throw error;
    return (data ?? []) as Row[];
  } catch {
    return null;
  }
}

async function readCache(): Promise<Row[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Row[]) : null;
  } catch {
    return null;
  }
}

/**
 * Guides laao — pehle server se, na mile to cache se.
 *
 * Memory me bhi rakhte hain: ek hi screen par kai document khulte hain, aur har
 * baar AsyncStorage padhna bekaar hai.
 */
let memo: Row[] | null = null;

export async function loadRenewalGuides(): Promise<Row[]> {
  if (memo) return memo;

  const fresh = await fetchAll();
  if (fresh && fresh.length > 0) {
    memo = fresh;
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
    return fresh;
  }

  const cached = await readCache();
  memo = cached ?? [];
  return memo;
}

/** Language/logout par memo saaf — warna purani bhasha ka content chipka rehta. */
export function clearRenewalMemo(): void {
  memo = null;
}

/* ------------------------------ chunna ------------------------------ */

/**
 * Is locale ka matn nikaalo.
 *
 * Girne ka kram: maangi hui bhasha → hinglish (app ka default, aur seed content
 * isi me likha jaata hai) → jo bhi maujood ho. Khaali lautane se behtar hai
 * thodi doosri bhasha me sahi jaankari dena — user kam se kam kaam to kar
 * paayega.
 */
function pickText(
  content: Partial<Record<Locale, RenewalText>>,
  locale: Locale,
): RenewalText | null {
  const order: Locale[] = [locale, DEFAULT_LOCALE];
  for (const l of order) {
    const t = content?.[l];
    if (t?.title && Array.isArray(t.steps)) return t;
  }
  for (const v of Object.values(content ?? {})) {
    if (v?.title && Array.isArray(v.steps)) return v;
  }
  return null;
}

/**
 * Is document ke liye renewal guide.
 *
 * Country match sabse pehle; na mile to '*'. Type na mile to 'other' —
 * yaani jawab hamesha kuch na kuch milta hai.
 */
export async function renewalFor(
  docType: string,
  locale: Locale,
  country: string | null = userCountry(),
): Promise<RenewalGuide | null> {
  const rows = await loadRenewalGuides();
  if (rows.length === 0) return null;

  const find = (type: string, c: string) =>
    rows.find((r) => r.doc_type === type && r.country === c);

  const row =
    (country ? find(docType, country) : undefined) ??
    find(docType, "*") ??
    (country ? find("other", country) : undefined) ??
    find("other", "*");

  if (!row) return null;
  const text = pickText(row.content, locale);
  if (!text) return null;

  return {
    doc_type: row.doc_type,
    country: row.country,
    url: row.url,
    authority: row.authority,
    reviewed: row.reviewed,
    text,
  };
}
