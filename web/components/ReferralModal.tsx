"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Gift, X, Smartphone, ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useOffers } from "@/lib/useOffers";
import { tpl } from "@/lib/offers";
import { PLAY_STORE_URL } from "@/lib/links";

/**
 * Referral ka modal popup (landing pe "Refer & Earn" click pe khulta hai).
 *
 * Zyada tar log jo ye dekhte hain unke paas app nahi hota — isliye primary CTA
 * "app download karo" hai (referral app ke andar se manage hota hai). Jinke paas
 * app/account hai wo "web pe manage karo" se /referral jaa sakte hain.
 */
export default function ReferralModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { referral: t } = useT();
  const offers = useOffers();
  const vars = { d: offers.referralDays };

  // Escape se band + body scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 shadow-warm sm:rounded-3xl sm:p-8"
      >
        <div className="flex items-start justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-3.5 py-1.5 text-sm font-bold text-terracotta">
            <Gift size={15} />
            {t.badge}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink-soft transition hover:bg-cream-deep/40"
          >
            <X size={16} />
          </button>
        </div>

        <h2 className="mt-4 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {tpl(t.cardTitle, vars)}
        </h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{tpl(t.sub, vars)}</p>

        {/* Conditions / how it works */}
        <ol className="mt-6 space-y-2.5">
          {t.steps.map((step, i) => (
            <li
              key={step}
              className="flex items-start gap-3.5 rounded-2xl border border-line bg-cream-deep/25 p-3.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-terracotta text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm leading-snug text-ink">{step}</span>
            </li>
          ))}
        </ol>

        <p className="mt-4 flex items-start gap-2 text-sm font-medium text-ink-soft">
          <Gift size={15} className="mt-0.5 shrink-0 text-terracotta" />
          {tpl(t.capNote, vars)}
        </p>

        {/* CTAs — primary download (non-app users), secondary manage on web */}
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark active:scale-[0.99]"
        >
          <Smartphone size={19} />
          {t.downloadApp}
        </a>
        <Link
          href="/referral"
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-6 text-sm font-semibold text-ink transition hover:bg-cream-deep/40"
        >
          {t.manageOnWeb}
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
