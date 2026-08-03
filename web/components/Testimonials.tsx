"use client";

import { Star, Quote } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { PublicReview, ReviewStats } from "@/lib/reviews-server";

/**
 * "Log kya keh rahe hain" — ab ASLI reviews se (item 1).
 *
 * App me review lete waqt user se saaf poocha jaata hai: "I allow Apka Saathi to
 * display this review on its website". Ab tak us haan ka koi matlab nahi tha —
 * yahan teen HAATH SE LIKHE testimonial pade the aur unke upar likha tha "Asli
 * Saathi users ki asli baat". Ab jo asli haan aayi hai wahi dikhti hai.
 *
 * `reviews` khaali ho (nayi site, ya DB/SQL abhi taiyar nahi) to wahi purane
 * dictionary wale testimonials dikhte hain — section kabhi khaali nahi rehta.
 * Aur asli reviews aate hi wo apne aap hat jaate hain, bina kisi deploy ke.
 *
 * ⚠️ Star har card me PAANCH nahi hote — jo rating user ne di hai wahi. Pehle
 * yahan hardcoded 5 star the; asli reviews par wo saaf jhooth ho jaata.
 */

const AVATAR_COLORS = ["#C25A37", "#7C8A6B", "#E0A458"];

function initial(name: string | null): string {
  const n = (name ?? "").trim();
  return n ? n.charAt(0).toUpperCase() : "S";
}

/** "Aug 2026" — poori tareekh se review ki umar kam padhne laayak lagti hai. */
function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function Stars({ n }: { n: number }) {
  return (
    <div className="mt-3 flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, s) => (
        <Star
          key={s}
          size={15}
          aria-hidden
          className={
            s < n ? "fill-amber-warm text-amber-warm" : "fill-none text-line"
          }
        />
      ))}
    </div>
  );
}

function Card({
  quote,
  rating,
  name,
  role,
  index,
}: {
  quote: string;
  rating: number;
  name: string;
  role: string;
  index: number;
}) {
  return (
    <figure className="flex h-full flex-col rounded-4xl border border-line bg-surface p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-warm sm:p-7">
      <Quote size={26} className="text-terracotta/30" aria-hidden />
      <Stars n={rating} />
      <blockquote className="mt-4 flex-1 leading-relaxed text-ink">
        “{quote}”
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
          aria-hidden
        >
          {initial(name)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          {!!role && <p className="truncate text-xs text-ink-soft">{role}</p>}
        </div>
      </figcaption>
    </figure>
  );
}

export default function Testimonials({
  reviews = [],
  stats,
}: {
  reviews?: PublicReview[];
  stats?: ReviewStats;
}) {
  const { testimonials: t } = useT();
  const real = reviews.length > 0;

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          {t.heading}
        </h2>
        <p className="mt-3 text-base text-ink-soft sm:mt-4 sm:text-lg">{t.sub}</p>

        {/* Asli aankda — sirf tab jab sach me reviews hain. */}
        {real && stats?.avg != null && stats.count > 0 && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-soft">
            <Star size={15} className="fill-amber-warm text-amber-warm" aria-hidden />
            {stats.avg.toFixed(1)} / 5
            <span className="font-medium text-ink-soft">
              · {stats.count} {stats.count === 1 ? "review" : "reviews"}
            </span>
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-3">
        {real
          ? reviews.map((r, i) => (
              <Card
                key={r.id}
                index={i}
                quote={r.text}
                rating={r.rating}
                name={r.name ?? "Saathi user"}
                role={[r.city, monthYear(r.createdAt)].filter(Boolean).join(" · ")}
              />
            ))
          : t.items.map((item, i) => (
              <Card
                key={i}
                index={i}
                quote={item.quote}
                rating={5}
                name={item.name}
                role={item.role}
              />
            ))}
      </div>
    </div>
  );
}
