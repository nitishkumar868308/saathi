import type { MetadataRoute } from "next";

import { getPosts } from "@/lib/blog-server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.apkasaathi.com";

/**
 * sitemap.xml — Google Search Console me `https://www.apkasaathi.com/sitemap.xml`
 * submit karna hai. Next isse build par khud generate karta hai.
 *
 * Sirf wahi pages jo index hone chahiye. `/referral` yahan jaan-boojh ke nahi hai
 * — uspe `robots: noindex` laga hai (har user ka apna link hota hai, uska search
 * result me koi matlab nahi). Sitemap me noindex page daalne se Search Console me
 * warning aati hai.
 *
 * `lastModified` sach bolna chahiye. Blog posts apni `updated` date deti hain;
 * baaki static pages ke liye build ka time theek hai.
 */
// Blog DB se aata hai, isliye sitemap bhi har 10 minute me apne aap taaza.
export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const posts = await getPosts();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/blog`,
      // Blog index tab badalta hai jab nayi post aati hai.
      lastModified: new Date(posts[0]?.updated ?? now),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/support`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const blogPages: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.updated),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...blogPages];
}
