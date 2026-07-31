"use client";

import { FileClock } from "lucide-react";

import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Chalti hui document-patti.
 *
 * ⚠️ Ye list pehle yahin hardcoded English thi. Hindi chunne par poore landing
 * page me sirf yahi patti English rehti thi — bilkul beech me, sabse zyada
 * dikhne wali jagah par.
 */
export default function Marquee() {
  const { marquee: docs } = useT();

  return (
    <div className="relative flex overflow-hidden border-y border-line bg-surface/60 py-5">
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-cream to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-cream to-transparent sm:w-24" />

      <div className="flex shrink-0 animate-marquee items-center gap-3 pr-3">
        {docs.concat(docs).map((d, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-cream px-4 py-2 text-sm font-medium text-ink-soft"
          >
            <FileClock size={15} className="text-terracotta" />
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
