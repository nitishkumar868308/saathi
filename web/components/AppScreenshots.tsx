"use client";

import Image from "next/image";

import { SCREENSHOTS, hasScreenshots } from "@/lib/screenshots";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * "Inside the app" — Play Store jaisa screenshot strip.
 *
 * Screenshots na hon to kuch render nahi hota (dekho `lib/screenshots.ts`),
 * isliye launch se pehle bhi ye component page me safely pada reh sakta hai.
 *
 * `next/image` jaan-boojh ke: har screenshot apne aap WebP/AVIF me convert hota
 * hai aur sirf utna hi bada bheja jaata hai jitni jagah device par hai. Phone par
 * ye teen-chauthai bytes bacha deta hai — aur landing page ki speed sabse zyada
 * inhi bade images se girti hai.
 */
export default function AppScreenshots() {
  const { screenshots: s } = useT();
  if (!hasScreenshots) return null;

  return (
    <section
      id="screenshots"
      className="container-page scroll-mt-24 py-16 sm:py-24"
      aria-labelledby="screenshots-heading"
    >
      <h2
        id="screenshots-heading"
        className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        {s.heading}
      </h2>
      <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">{s.sub}</p>

      {/*
        Mobile par horizontal scroll, desktop par grid. Scroll-snap se har
        screenshot apni jagah par theek rukta hai.
      */}
      <div className="mt-10 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {SCREENSHOTS.map((s, i) => (
          <figure
            key={s.file}
            className="w-[68vw] shrink-0 snap-center sm:w-auto"
          >
            <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
              <Image
                src={`/screenshots/${s.file}`}
                alt={`Apka Saathi app — ${s.caption}`}
                width={s.width}
                height={s.height}
                sizes="(max-width: 640px) 68vw, (max-width: 1024px) 45vw, 23vw"
                // Pehli image hi sabse pehle dikhti hai; baaki lazy load hoti hain.
                priority={i === 0}
                loading={i === 0 ? undefined : "lazy"}
                className="h-auto w-full"
              />
            </div>
            <figcaption className="mt-3 text-sm leading-relaxed text-ink-soft">
              {s.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
