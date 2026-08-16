import type { Metadata } from "next";

/**
 * Per-page SEO — DB se, code se nahi.
 *
 * Title/description tune karne ke liye deploy karna pade to koi tune karta hi
 * nahi. Isliye har page ka meta `seo_pages` table me rehta hai aur admin panel
 * se badalta hai. Yahan sirf padha jaata hai.
 *
 * Do zaroori baatein:
 *
 *  1. **Fallback hamesha rehta hai.** DB down ho, env set na ho, ya row hi na
 *     ho — page tab bhi apne default meta ke saath live jaata hai. SEO ka page
 *     kabhi khaali `<title>` ke saath nahi nikalna chahiye.
 *
 *  2. **Cache ke saath.** Har request par DB call karna faaltu hai; meta ghante
 *     me ek baar hi badalta hai. Next ka fetch cache 10 minute rakhta hai, aur
 *     admin save karte hi `revalidateTag("seo")` se turant taaza ho jaata hai.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://apkasaathi.com";
export const SITE_NAME = "Apka Saathi";

/** DB row na mile to yahi chalta hai. */
export type SeoDefaults = {
  title: string;
  description: string;
  keywords?: string[];
  noindex?: boolean;
};

export type SeoRow = {
  path: string;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  og_title: string | null;
  og_description: string | null;
  noindex: boolean;
};

async function fetchSeo(path: string): Promise<SeoRow | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/seo_pages?path=eq.${encodeURIComponent(path)}&select=*`,
      {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
        next: { revalidate: 600, tags: ["seo"] },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as SeoRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Ek page ka poora `Metadata` — DB se, warna diye gaye defaults se.
 *
 * `path` wahi hona chahiye jo browser me dikhta hai ("/about"), kyunki canonical
 * isi se banta hai aur admin bhi isi se row dhoondhta hai.
 */
export async function pageMetadata(
  path: string,
  defaults: SeoDefaults,
  extra: Metadata = {},
  /**
   * Sirf root layout deta hai — child pages ka title kis saanche me bane
   * ("%s · Apka Saathi").
   *
   * ⚠️ Ye alag param isliye hai, `extra` me nahi: `extra` sabse aakhir me spread
   * hota hai, to agar layout wahan `title` bhejta to wo DB se aaye title ko dabaa
   * deta aur home ka title admin se kabhi badalta hi nahi.
   */
  titleTemplate?: string,
): Promise<Metadata> {
  const row = await fetchSeo(path);

  const title = row?.title?.trim() || defaults.title;
  const description = row?.description?.trim() || defaults.description;
  const keywords =
    row?.keywords && row.keywords.length ? row.keywords : defaults.keywords;
  const noindex = row?.noindex ?? defaults.noindex ?? false;

  const ogTitle = row?.og_title?.trim() || title;
  const ogDescription = row?.og_description?.trim() || description;

  /**
   * Preview image har page par ek hi.
   *
   * ⚠️ Ye explicitly dena zaroori hai. Next ka file-based `opengraph-image.png`
   * tabhi apne aap lagta hai jab page apna `openGraph` object na de. Hum har page
   * ko apna og:title/og:description dete hain, isliye image chup-chaap gir jaati
   * thi — WhatsApp/X par sirf home ka preview aata tha, baaki pages ka khaali.
   */
  const image = {
    url: `${SITE_URL}/opengraph-image.png`,
    width: 1200,
    height: 630,
    alt: `${SITE_NAME} — never forgets what matters`,
  };

  return {
    title: titleTemplate ? { default: title, template: titleTemplate } : title,
    description,
    ...(keywords ? { keywords } : {}),
    // Canonical har page ka apna — bina iske ?ref= aur trailing-slash wali
    // copies alag pages lagti hain aur ek doosre se rank cheenti hain.
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: `${SITE_URL}${path === "/" ? "" : path}`,
      siteName: SITE_NAME,
      locale: "en_IN",
      alternateLocale: ["hi_IN"],
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [image.url],
    },
    robots: noindex
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    ...extra,
  };
}
