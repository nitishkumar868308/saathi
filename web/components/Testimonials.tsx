"use client";

import { Star, Quote } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

export default function Testimonials() {
  const { testimonials: t } = useT();

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          {t.heading}
        </h2>
        <p className="mt-3 text-base text-ink-soft sm:mt-4 sm:text-lg">
          {t.sub}
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-3">
        {t.items.map((item, i) => (
          <figure
            key={i}
            className="flex h-full flex-col rounded-4xl border border-line bg-surface p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-warm sm:p-7"
          >
            <Quote size={26} className="text-terracotta/30" />
            <div className="mt-3 flex gap-0.5" aria-hidden>
              {Array.from({ length: 5 }).map((_, s) => (
                <Star
                  key={s}
                  size={15}
                  className="fill-amber-warm text-amber-warm"
                />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 leading-relaxed text-ink">
              “{item.quote}”
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-line pt-4">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{
                  backgroundColor: ["#C25A37", "#7C8A6B", "#E0A458"][i % 3],
                }}
                aria-hidden
              >
                {item.name.charAt(0)}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-ink">{item.name}</p>
                <p className="text-xs text-ink-soft">{item.role}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
