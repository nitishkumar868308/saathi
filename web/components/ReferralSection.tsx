"use client";

import { useState } from "react";
import { Gift, ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useOffers } from "@/lib/useOffers";
import { tpl } from "@/lib/offers";
import ReferralModal from "@/components/ReferralModal";

/**
 * Landing ka referral section. Click → modal popup (offer + conditions +
 * download). Referral band ho to poora section gayab.
 */
export default function ReferralSection() {
  const { referral: t } = useT();
  const offers = useOffers();
  const [modalOpen, setModalOpen] = useState(false);

  // Auto-open landing modal ab page ke top-level pe hai (LandingReferralPopup).
  // Yahan ka modal sirf is section ke CTA button click pe khulta hai.
  if (!offers.referralsEnabled) return null;

  const vars = { d: offers.referralDays };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-line bg-surface shadow-soft sm:rounded-[2.5rem]">
      <div className="grid items-center gap-8 p-7 sm:p-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:p-14">
        {/* Left — pitch */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-4 py-1.5 text-sm font-semibold text-terracotta">
            <Gift size={15} />
            {t.badge}
          </span>
          <h2 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
            {t.heading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
            {tpl(t.sub, vars)}
          </p>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="group mt-7 inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-7 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark active:scale-[0.98]"
          >
            {t.cta}
            <ArrowRight
              size={18}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>

          <p className="mt-3.5 text-sm text-ink-soft">{tpl(t.capNote, vars)}</p>
        </div>

        {/* Right — kaise kaam karta hai */}
        <ol className="space-y-3.5">
          {t.steps.map((step, i) => (
            <li
              key={step}
              className="flex items-start gap-4 rounded-2xl border border-line bg-cream-deep/25 p-4 sm:p-5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-terracotta text-sm font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-1 text-[15px] leading-snug text-ink sm:text-base">
                {step}
              </span>
            </li>
          ))}
          <li className="flex items-start gap-4 rounded-2xl border border-sage/40 bg-sage/10 p-4 sm:p-5">
            {/* Sage par safed nishaan dono theme me kamzor hai — `text-on-accent`
                gehra rehta hai. */}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sage text-on-accent">
              <Gift size={16} />
            </span>
            <span className="pt-1 text-[15px] font-semibold leading-snug text-ink sm:text-base">
              {tpl(t.cardTitle, vars)} 🎉
            </span>
          </li>
        </ol>
      </div>

      <ReferralModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
