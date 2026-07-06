"use client";

import {
  CreditCard,
  Fingerprint,
  Vote,
  BadgeCheck,
  GraduationCap,
  Landmark,
  Car,
  ShieldCheck,
  Plane,
  Receipt,
} from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

const icons = [
  CreditCard,
  Fingerprint,
  Vote,
  BadgeCheck,
  GraduationCap,
  Landmark,
  Car,
  ShieldCheck,
  Plane,
  Receipt,
];

export default function SupportedDocs() {
  const { docs: t } = useT();

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

      <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {t.items.map((label, i) => {
          const Icon = icons[i] ?? BadgeCheck;
          return (
            <div
              key={label}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-center shadow-soft transition duration-300 hover:-translate-y-1 hover:border-terracotta/30 hover:shadow-warm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta transition duration-300 group-hover:scale-110 group-hover:bg-terracotta group-hover:text-white">
                <Icon size={22} strokeWidth={2} />
              </span>
              <span className="text-sm font-semibold leading-tight">
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-cream-deep/40 px-5 py-2.5 text-center text-sm font-semibold text-ink">
          <BadgeCheck size={16} className="shrink-0 text-sage" />
          {t.more}
        </span>
      </div>
    </div>
  );
}
