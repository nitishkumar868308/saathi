import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/15 sm:h-96 sm:w-96" />
      </div>

      <SubHeader />

      <main className="container-page py-14 sm:py-20">
        <article className="mx-auto max-w-2xl">
          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-terracotta"
          >
            <ArrowLeft size={16} /> All posts
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-cream-deep/50 px-3 py-1">
                {t}
              </span>
            ))}
            <span>{post.readingMinutes} min read</span>
          </div>

          {/* Ek page par ek hi h1 — SEO ka sabse basic niyam. */}
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {post.heading}
          </h1>

          <p className="mt-3 text-sm text-ink-soft">
            Published {fmt(post.published)}
            {post.updated !== post.published && <> · Updated {fmt(post.updated)}</>}
          </p>

          <p className="mt-8 text-lg leading-relaxed text-ink">{post.intro}</p>

          <div className="mt-8 space-y-8">
            {post.sections.map((s) => (
              <section key={s.h}>
                <h2 className="font-display text-2xl font-semibold">{s.h}</h2>
                {s.p.map((para) => (
                  <p key={para} className="mt-3 leading-relaxed text-ink-soft">
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </div>

          {/* Post ke aakhir me ek seedha next step. */}
          <div className="mt-12 rounded-4xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold">
              Let Saathi remember it for you
            </h2>
            <p className="mt-2 leading-relaxed text-ink-soft">
              Add a document or a reminder once. Saathi handles the dates from
              there — free to start, in Hindi or English.
            </p>
            <Link
              href="/#download"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:gap-2.5"
            >
              Get the app <ArrowRight size={16} />
            </Link>
          </div>

          {related.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-xl font-semibold">Read next</h2>
              <ul className="mt-4 space-y-3">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/blog/${r.slug}`}
                      className="font-semibold text-ink hover:text-terracotta"
                    >
                      {r.title}
                    </Link>
                    <p className="text-sm leading-relaxed text-ink-soft">
                      {r.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </main>

      <Footer />
    </div>
  );
}
