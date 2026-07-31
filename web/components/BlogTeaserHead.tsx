"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Blog teaser ka sirf text wala hissa.
 *
 * ⚠️ `BlogTeaser` khud server component hai (posts DB se aati hain), isliye wo
 * `useT()` nahi bula sakta — aur usi wajah se uska heading/sub hardcoded
 * Hinglish reh gaya tha. Bhasha badalne par landing ka baaki sab badalta tha,
 * bas ye ek block nahi. Text yahan alag kar diya taaki dono chal sakein.
 */
export default function BlogTeaserHead() {
  const { blogTeaser: b } = useT();

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          <BookOpen size={13} className="text-terracotta" />
          {b.kicker}
        </span>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {b.heading}
        </h2>
        <p className="mt-2 max-w-lg leading-relaxed text-ink-soft">{b.sub}</p>
      </div>

      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-terracotta transition hover:gap-2.5 hover:border-terracotta/40"
      >
        {b.seeAll} <ArrowRight size={16} />
      </Link>
    </div>
  );
}
