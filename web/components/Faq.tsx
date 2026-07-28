"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

export default function Faq() {
  const { faq } = useT();
  const [open, setOpen] = useState<number | null>(0);

  /**
   * FAQPage structured data — Google search result me sawaal-jawab seedhe dikha
   * sakta hai (rich result).
   *
   * Markup wahi sawaal-jawab uthata hai jo screen par dikh rahe hain. Ye Google
   * ki shart hai: agar markup me kuch aur ho aur page par kuch aur, to rich
   * result to door, manual action bhi lag sakta hai. Isliye yahan bhi wahi
   * `faq.items` hai jo neeche render ho rahi hai — bhasha badle to dono saath
   * badalte hain.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl divide-y divide-line overflow-hidden rounded-4xl border border-line bg-surface">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {faq.items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-cream-deep/30 sm:px-8"
            >
              <span className="font-display text-lg font-semibold text-ink">
                {f.q}
              </span>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-terracotta transition-transform duration-300 ${
                  isOpen ? "rotate-45 bg-terracotta/10" : ""
                }`}
              >
                <Plus size={18} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 leading-relaxed text-ink-soft sm:px-8">
                    {f.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
