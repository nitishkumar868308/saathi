import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";

import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
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

function fmt(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Blog index.
 *
 * ⚠️ Pehle ye ek patli si list thi — har post ek jaisa dabba, sab ek doosre ke
 * neeche, koi tarteeb nahi (item 1). Padhne wale ko samajh hi nahi aata tha
 * kahan se shuru kare.
 *
 * Ab: sabse nayi post ek badi "featured" card hai (usi ko sabse zyada log
 * padhte hain), aur baaki neeche do-teen ke grid me. Har card par tag, reading
 * time aur date — teen cheezein jo faisla karne me kaam aati hain.
 *
 * Poora page build-time par static HTML ban jaata hai — Google ko turant
 * padhne layak content milta hai aur khulne me koi request nahi lagti.
 */
export default async function BlogIndex() {
  const posts = await getPosts();
  const [featured, ...rest] = posts;

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
        <div className="blob right-[-8rem] top-64 h-80 w-80 bg-terracotta/10" />
      </div>

      <SubHeader />

      <main className="container-page py-14 sm:py-20">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <BookOpen size={13} className="text-terracotta" />
            Blog
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            The things that quietly expire
          </h1>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Short, practical guides on documents, renewals, medicines and bills —
            and how to stop them from catching you out.
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="mt-16 text-center text-ink-soft">Nothing here yet.</p>
        ) : (
          <>
            {/* Featured — sabse nayi post. Ek nazar me pata chale kahan se shuru karein. */}
            <Link
              href={`/blog/${featured.slug}`}
              className="group mt-12 block overflow-hidden rounded-[2rem] border border-line bg-surface transition hover:border-terracotta/40 hover:shadow-warm sm:mt-14"
            >
              <div className="grid gap-6 p-7 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    <span className="rounded-full bg-terracotta px-3 py-1 text-white">
                      Latest
                    </span>
                    {featured.tags.slice(0, 2).map((t) => (
                      <span key={t} className="rounded-full bg-cream-deep/60 px-3 py-1">
                        {t}
                      </span>
                    ))}
                  </div>

                  <h2 className="mt-4 font-display text-2xl font-semibold leading-snug transition group-hover:text-terracotta sm:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="mt-3 leading-relaxed text-ink-soft">
                    {featured.description}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-ink-soft">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={13} />
                      {featured.readingMinutes} min read
                    </span>
                    <span>{fmt(featured.published)}</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 justify-self-start rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-warm transition group-hover:gap-3 lg:justify-self-end">
                  Read it <ArrowRight size={16} />
                </span>
              </div>
            </Link>

            {/* Baaki posts */}
            {rest.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group flex flex-col rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-terracotta/40 hover:shadow-warm"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                      {p.tags.slice(0, 2).map((t) => (
                        <span key={t} className="rounded-full bg-cream-deep/60 px-2.5 py-1">
                          {t}
                        </span>
                      ))}
                    </div>

                    <h2 className="mt-3 font-display text-lg font-semibold leading-snug transition group-hover:text-terracotta">
                      {p.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-soft">
                      {p.description}
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs font-semibold text-ink-soft">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} />
                        {p.readingMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1 text-terracotta transition group-hover:gap-2">
                        Read <ArrowRight size={13} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
