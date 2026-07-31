import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.apkasaathi.com";

/**
 * robots.txt — `/robots.txt` par Next isse khud serve karta hai.
 *
 * Soch seedhi hai: **sab kuch crawl hone do, sirf wo mat jo kisi kaam ka nahi.**
 * Kai log yahan galti se `/blog` ya assets block kar dete hain aur phir sochte
 * hain ki pages index kyun nahi ho rahe.
 *
 * Block sirf ye:
 *   /admin      — private dashboard
 *   /api        — JSON endpoints, inka koi search result nahi banta
 *   /r/         — referral short links (har user ka alag, duplicate ka pahaad)
 *
 * `/referral` khud crawl ho sakta hai (usme apna `noindex` meta hai) — robots.txt
 * se block karne par Google wo `noindex` padh hi nahi paata, aur page phir bhi
 * URL-only entry ke roop me index ho jaata hai.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/r/"],
      },
      // AI crawlers ko bhi allow — brand ka zikr in jawaabon me aana faayda hi hai.
      { userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot"], allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
