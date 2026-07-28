import { BLOG_POSTS, type BlogPost } from "@/lib/blog";

/**
 * Blog — DB se (admin panel se likhi/badli jaati hai).
 *
 * `lib/blog.ts` ab sirf **seed** hai: pehli baar site chalane ke liye, aur DB na
 * chale to fallback. Asli source `blog_posts` table hai, taaki nayi post likhne
 * ke liye deploy na karna pade.
 *
 * Cache: har page load par DB call bekaar hai — blog ghante me ek baar hi
 * badalta hai. Isliye 10 minute ka revalidate, aur admin save karte hi
 * `revalidateTag("blog")` se turant taaza.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Row = {
  slug: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  sections: { h: string; p: string[] }[] | null;
  tags: string[] | null;
  reading_minutes: number | null;
  published_at: string;
  updated_at: string;
};

function toPost(r: Row): BlogPost {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    heading: r.heading,
    intro: r.intro,
    sections: r.sections ?? [],
    tags: r.tags ?? [],
    readingMinutes: r.reading_minutes ?? 4,
    published: r.published_at,
    // DB timestamp -> YYYY-MM-DD (page par sirf date dikhti hai).
    updated: (r.updated_at ?? r.published_at).slice(0, 10),
  };
}

async function fetchRows(): Promise<BlogPost[] | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_posts?is_published=eq.true&select=*&order=published_at.desc`,
      {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
        next: { revalidate: 600, tags: ["blog"] },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    // Table khaali hai (abhi tak koi post nahi likhi) — seed dikhao, khaali blog
    // se behtar hai.
    if (!rows.length) return null;
    return rows.map(toPost);
  } catch {
    return null;
  }
}

/** Sab published posts, nayi se purani. DB na mile to seed. */
export async function getPosts(): Promise<BlogPost[]> {
  const rows = await fetchRows();
  if (rows) return rows;
  return [...BLOG_POSTS].sort((a, b) => b.published.localeCompare(a.published));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const posts = await getPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

/** Ek tag milta ho aisi kuch aur posts. */
export async function getRelated(post: BlogPost, limit = 3): Promise<BlogPost[]> {
  const posts = await getPosts();
  return posts
    .filter((p) => p.slug !== post.slug && p.tags.some((t) => post.tags.includes(t)))
    .slice(0, limit);
}
