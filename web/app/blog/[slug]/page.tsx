import type { Metadata } from "next";
import { ldJson } from "@/lib/json-ld";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Calendar, Sparkles } from "lucide-react";

import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
import { getPosts, getPostBySlug, getRelated } from "@/lib/blog-server";
import { SITE_URL } from "@/lib/seo-server";

const OG_IMAGE = `${SITE_URL}/opengraph-image.png`;

type Params = { params: { slug: string } };

/**
 * Build ke waqt jo posts DB me hain unka HTML pehle hi ban jaata hai.
 * Baad me admin nayi post likhe to `dynamicParams` uska page maang par bana
 * deta hai — deploy ka intezaar nahi karna padta.
 */
export const dynamicParams = true;
export const revalidate = 600;

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

/**
 * Har post ka apna title, description aur canonical.
 * Yahi wo cheez hai jo do posts ko ek jaisa dikhne se rokti hai — Google
 * duplicate meta tags wale pages me se sirf ek hi rank karta hai.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return { title: "Post not found", robots: { index: false, follow: true } };

  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: "article",
      publishedTime: post.published,
      modifiedTime: post.updated,
      tags: post.tags,
      // Share preview — bina iske WhatsApp/X par khaali card jaata hai.
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [OG_IMAGE],
    },
  };
}

function fmt(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Ek blog post.
 *
 * ⚠️ Pehle poora page ek hi lambi patti tha — heading, phir paragraph, phir
 * paragraph, bina kisi saans ke (item 1). Padhne me thakau lagta tha aur ye
 * bhi pata nahi chalta tha ki aage kitna bacha hai.
 *
 * Ab teen cheezein badli hain:
 *   1. Upar ek saaf header — breadcrumb, tags, reading time, date.
 *   2. Har section ke beech halki line aur zyada jagah, taaki aankh ruk sake.
 *   3. Intro alag se ubhra hua (lead paragraph), CTA aur "aage padho" niche
 *      apne apne card me — content aur vigyapan ghul-mil na jaayein.
 */
export default async function BlogPostPage({ params }: Params) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;
  const related = await getRelated(post);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: url,
        datePublished: post.published,
        dateModified: post.updated,
        inLanguage: "en-IN",
        keywords: post.tags.join(", "),
        author: { "@type": "Organization", name: "Apka Saathi", url: SITE_URL },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      // Breadcrumbs — search result me "apkasaathi.com › Blog › Post" dikhta hai.
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }}
      />
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/15 sm:h-96 sm:w-96" />
      </div>

      <SubHeader />

      <main className="container-page py-12 sm:py-16">
        <article className="mx-auto max-w-2xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
          >
            <ArrowLeft size={16} /> All posts
          </Link>

          {/* Header */}
          <header className="mt-7 border-b border-line pb-8">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {post.tags.map((t) => (
                <span key={t} className="rounded-full bg-cream-deep/60 px-3 py-1">
                  {t}
                </span>
              ))}
            </div>

            {/* Ek page par ek hi h1 — SEO ka sabse basic niyam. */}
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl">
              {post.heading}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} />
                {post.readingMinutes} min read
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} />
                {fmt(post.published)}
              </span>
              {post.updated !== post.published && <span>Updated {fmt(post.updated)}</span>}
            </div>
          </header>

          {/* Lead — baaki text se bada, taaki shuruaat saaf mile. */}
          <p className="mt-8 text-lg leading-[1.75] text-ink sm:text-xl">{post.intro}</p>

          {/* Sections — beech me halki line, taaki aankh ruk sake. */}
          <div className="mt-10 space-y-10">
            {post.sections.map((s, i) => (
              <section key={s.h} className={i > 0 ? "border-t border-line pt-10" : undefined}>
                <h2 className="font-display text-2xl font-semibold leading-snug">{s.h}</h2>
                <div className="mt-4 space-y-4">
                  {s.p.map((para) => (
                    <p key={para} className="leading-[1.8] text-ink-soft">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Post ke aakhir me ek seedha next step. */}
          <aside className="mt-14 overflow-hidden rounded-[2rem] bg-ink p-7 text-cream sm:p-9">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
              <Sparkles size={13} className="text-amber-warm" />
              Apka Saathi
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold leading-snug">
              Let Saathi remember it for you
            </h2>
            <p className="mt-3 leading-relaxed text-cream/75">
              Add a document or a reminder once. Saathi handles the dates from there —
              free to start, in Hindi or English.
            </p>
            <Link
              href="/#download"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-white transition hover:gap-3"
            >
              Get the app <ArrowRight size={16} />
            </Link>
          </aside>

          {related.length > 0 && (
            <div className="mt-14">
              <h2 className="font-display text-xl font-semibold">Read next</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group rounded-2xl border border-line bg-surface p-5 transition hover:border-terracotta/40 hover:shadow-warm"
                  >
                    <h3 className="font-display font-semibold leading-snug transition group-hover:text-terracotta">
                      {r.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                      {r.description}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                      <Clock size={12} />
                      {r.readingMinutes} min
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>

      <Footer />
    </div>
  );
}
