"use client";

import { Lock, Languages, Sparkles, Cloud, ShieldCheck, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

const icons = [Lock, Languages, Sparkles, Cloud];

export default function TrustSection() {
  const { trust: t } = useT();

  return (
    <div className="overflow-hidden rounded-[2rem] border border-line bg-surface shadow-soft sm:rounded-[2.5rem]">
      <div className="grid gap-8 p-7 sm:p-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12 lg:p-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-sage/15 px-4 py-1.5 text-sm font-semibold text-sage">
            <ShieldCheck size={15} />
            {t.badge}
          </span>
          <h2 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t.heading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
            {t.body}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-line bg-cream-deep/30 px-4 py-3 text-sm font-semibold text-ink">
            <Trash2 size={16} className="text-terracotta" />
            {t.delete}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {t.items.map((b, i) => {
            const Icon = icons[i] ?? Lock;
            return (
              <div
                key={b.title}
                className="group flex items-start gap-3.5 rounded-2xl border border-line bg-cream-deep/25 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-terracotta/30 hover:bg-surface hover:shadow-soft sm:p-5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta transition group-hover:scale-110">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <div>
                  <p className="font-display text-base font-semibold">
                    {b.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {b.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
