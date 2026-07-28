import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
import BackHomeLink from "@/components/BackHomeLink";
import { getPosts } from "@/lib/blog-server";
import { pageMetadata, SITE_URL } from "@/lib/seo-server";

export function generateMetadata(): Promise<Metadata> {
  // Meta DB se — admin panel se badla ja sakta hai.
  return pageMetadata("/blog", {
    title: "Blog — Reminders, Documents & Deadlines",
    description:
      "Practical guides on tracking document expiry dates, passport and Aadhaar renewals, medicine reminders and bill due dates.",
  });
}

// Blog DB se aata hai, isliye page har 10 minute me apne aap taaza ho jaata
// hai. Admin nayi post publish kare to `revalidateTag("blog")` turant refresh
// kar deta hai — deploy ki zaroorat nahi.
export const revalidate = 600;

/**
 * Blog index. Har post `lib/blog.ts` se aati hai, isliye ye page build-time par
 * poora static HTML ban jaata hai — Google ko turant padhne layak content milta
 * hai aur khulne me koi request nahi lagti.
 */
export default async function BlogIndex() {
  const posts = await getPosts();

  // Blog ko ek CollectionPage batao taaki Google saari posts ka rishta samajh le.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Apka Saathi Blog",
    url: `${SITE_URL}/blog`,
    description:
      "Practical guides on document expiry, renewals, medicine reminders and bills.",
    hasPart: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.published,
      dateModified: p.updated,
    })),
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
        <div className="mx-auto max-w-3xl">
          <BackHomeLink className="mb-6" />

          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Blog
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
            Short, practical guides on the things that quietly expire — documents,
            renewals, medicines and bills.
          </p>

          <div className="mt-10 space-y-4">
            {posts.map((p) => (
              <article
                key={p.slug}
                className="rounded-4xl border border-line bg-surface p-6 transition hover:border-terracotta/40 sm:p-8"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-full bg-cream-deep/50 px-3 py-1">
                      {t}
                    </span>
                  ))}
                  <span>{p.readingMinutes} min read</span>
                </div>

                <h2 className="mt-3 font-display text-2xl font-semibold leading-snug">
                  <Link href={`/blog/${p.slug}`} className="hover:text-terracotta">
                    {p.title}
                  </Link>
                </h2>
                <p className="mt-2 leading-relaxed text-ink-soft">{p.description}</p>

                <Link
                  href={`/blog/${p.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:gap-2.5"
                >
                  Read it <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
