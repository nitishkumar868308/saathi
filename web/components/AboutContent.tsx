"use client";

import Link from "next/link";
import { ShieldCheck, Sparkles, HeartHandshake, ArrowRight } from "lucide-react";
import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
import BackHomeLink from "@/components/BackHomeLink";
import { useT } from "@/lib/i18n/LanguageProvider";

const valueIcons = [ShieldCheck, Sparkles, HeartHandshake];

export default function AboutContent() {
  const t = useT();
  const a = t.about;

  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/20 sm:h-96 sm:w-96" />
        <div className="blob right-[-8rem] top-52 h-80 w-80 bg-terracotta/10" />
      </div>

      <SubHeader />

      <main className="container-page py-14 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <BackHomeLink className="mb-6" />
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
              {a.badge}
            </span>
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            {a.heading}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink sm:text-2xl">
            {a.lead}
          </p>

          <div className="mt-8 space-y-5">
            {a.body.map((p, i) => (
              <p key={i} className="text-base leading-relaxed text-ink-soft sm:text-lg">
                {p}
              </p>
            ))}
          </div>

          {/* Values */}
          <h2 className="mt-14 font-display text-2xl font-semibold sm:text-3xl">
            {a.valuesHeading}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-5">
            {a.values.map((v, i) => {
              const Icon = valueIcons[i] ?? ShieldCheck;
              return (
                <div
                  key={v.title}
                  className="rounded-3xl border border-line bg-surface p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-warm"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta">
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">
                    {v.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {v.body}
                  </p>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-14 flex flex-col items-start gap-4 rounded-3xl border border-line bg-cream-deep/30 p-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-xl font-semibold">
              {t.finalCta.heading}
            </p>
            <Link
              href="/#download"
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-terracotta px-6 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark active:scale-95"
            >
              {t.download.button}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
