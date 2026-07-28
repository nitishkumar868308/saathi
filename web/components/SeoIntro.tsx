"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Home ka content block — "Saathi kis-kis cheez ka reminder deta hai".
 *
 * Ye SEO ke liye hai, par SEO-jaisa nahi padhta. Wajah: Google ko page par asli
 * text chahiye jisme wo shabd hon jo log search karte hain ("document expiry
 * reminder", "medicine reminder", "bill reminder"). Baaki landing page zyadatar
 * chhote punch-lines aur images se bana hai, jinme Google ke liye kuch khaas
 * nahi hota.
 *
 * ⚠️ Yahan keyword thoosna mana hai. Har paragraph poore vaakyon me hai aur user
 * ke liye sach me kaam ka hai — Google aaj bhara hua text pehchaan leta hai aur
 * usse rank girti hai, badhti nahi.
 *
 * Har heading `h3` hai kyunki section ka apna `h2` upar hai — heading ka kram
 * tootna nahi chahiye.
 */
export default function SeoIntro() {
  const { seo } = useT();

  return (
    <section
      className="container-page py-14 sm:py-20"
      aria-labelledby="seo-heading"
    >
      <div className="mx-auto max-w-3xl">
        <h2
          id="seo-heading"
          className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {seo.heading}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ink-soft sm:text-lg">
          {seo.intro}
        </p>

        <div className="mt-9 grid gap-5 sm:grid-cols-2">
          {seo.blocks.map((b) => (
            <div key={b.h}>
              <h3 className="font-display text-lg font-semibold text-ink">{b.h}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{b.p}</p>
            </div>
          ))}
        </div>

        {/* Blog ka internal link — Google ko blog dhoondhne me madad karta hai
            aur padhne wale ko aage kuch dene layak. */}
        <Link
          href="/blog"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta transition hover:gap-2.5"
        >
          {seo.blogLink} <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
