import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";

import { getPosts } from "@/lib/blog-server";

/**
 * Home page ka blog hissa — chhota sa, teen posts (item 1).
 *
 * Kyun chahiye: blog abhi sirf sitemap aur seedha URL se milta tha. Jo log home
 * page par aate the unhe pata hi nahi chalta tha ki yahan padhne ko kuch hai —
 * aur SEO ke liye home se blog tak ka internal link bhi zaroori hai.
 *
 * Jaan-boojh ke chhota rakha hai: home ka kaam app download karana hai, blog
 * padhwana nahi. Isliye teen card aur ek "sab dekho" link — bas.
 *
 * Server component hai (koi "use client" nahi) taaki posts build/revalidate ke
 * waqt hi HTML me chali jaayein — Google ko turant dikhein aur page khulne par
 * koi request na lage.
 */
export default async function BlogTeaser() {
  const posts = (await getPosts()).slice(0, 3);
  if (posts.length === 0) return null;

  return (
    <section className="container-page py-14 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <BookOpen size={13} className="text-terracotta" />
            Blog
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Padhne layak, kaam ki baatein
          </h2>
          <p className="mt-2 max-w-lg leading-relaxed text-ink-soft">
            Documents, renewals, dawai aur bills — jo cheezein chupchaap expire ho
            jaati hain, unke chhote practical guides.
          </p>
        </div>

        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-terracotta transition hover:gap-2.5 hover:border-terracotta/40"
        >
          Sab dekho <ArrowRight size={16} />
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
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

            <h3 className="mt-3 font-display text-lg font-semibold leading-snug transition group-hover:text-terracotta">
              {p.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
              {p.description}
            </p>

            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
              <Clock size={13} />
              {p.readingMinutes} min read
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
