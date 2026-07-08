"use client";

import { useState } from "react";
import { Check, Sparkles, Gift } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PLAY_STORE_URL } from "@/lib/links";
import { useOffers } from "@/lib/useOffers";
import { tpl } from "@/lib/offers";

// GST abhi comment out — humare paas GST registration nahi, isliye user se nahi lenge.
// function gstTotal(price: string): string {
//   const n = Number(price.replace(/[^0-9.]/g, ""));
//   if (!n) return price;
//   const total = Math.round(n * 1.18);
//   return `₹${total.toLocaleString("en-IN")}`;
// }

export default function Pricing() {
  const { pricing: t, download: dl } = useT();
  const [yearly, setYearly] = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  // Admin se numbers badalte hi ye copy khud badal jaati hai.
  const offers = useOffers();
  const vars = {
    n: offers.firstNUsers.toLocaleString("en-IN"),
    m: offers.firstNFreeMonths,
    d: offers.referralDays,
    cap: offers.referralCapMonths,
  };

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

      {/* Offer banner + referral condition — offer band ho to dikhta bhi nahi */}
      {(offers.firstNEnabled || offers.referralsEnabled) && (
        <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-terracotta/25 bg-terracotta/10 px-4 py-3.5 sm:px-5">
          {offers.firstNEnabled && (
            <p className="flex items-start justify-center gap-2.5 text-center text-sm font-semibold text-ink">
              <Gift size={18} className="mt-px shrink-0 text-terracotta" />
              {tpl(t.reward, vars)}
            </p>
          )}
          {offers.referralsEnabled && (
            <p
              className={`text-center text-xs leading-relaxed text-ink-soft sm:text-[13px] ${
                offers.firstNEnabled ? "mt-2.5 border-t border-terracotta/20 pt-2.5" : ""
              }`}
            >
              {tpl(t.referralHow, vars)}
            </p>
          )}
        </div>
      )}

      {/* Billing toggle */}
      <div className="mt-7 flex items-center justify-center gap-3">
        <span
          className={`text-sm font-semibold ${
            !yearly ? "text-ink" : "text-ink-soft"
          }`}
        >
          {t.billMonthly}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          onClick={() => setYearly((y) => !y)}
          className={`relative h-7 w-12 rounded-full border border-line transition ${
            yearly ? "bg-terracotta" : "bg-cream-deep"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${
              yearly ? "left-6" : "left-0.5"
            }`}
          />
        </button>
        <span
          className={`text-sm font-semibold ${
            yearly ? "text-ink" : "text-ink-soft"
          }`}
        >
          {t.billYearly}
        </span>
        <span className="rounded-full bg-sage/15 px-2.5 py-1 text-xs font-bold text-sage">
          {t.saveBadge}
        </span>
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl gap-5 sm:grid-cols-2">
        {t.plans.map((plan) => {
          const highlight = plan.highlight;
          const price = yearly && plan.priceYearly ? plan.priceYearly : plan.price;
          const period =
            yearly && plan.periodYearly ? plan.periodYearly : plan.period;
          // GST abhi off:
          // const showGst = plan.gst && price !== "₹0";

          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-4xl border p-7 shadow-soft sm:p-8 ${
                highlight
                  ? "border-terracotta bg-ink text-cream shadow-warm"
                  : "border-line bg-surface"
              }`}
            >
              {highlight && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-terracotta px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-warm">
                  <Sparkles size={12} />
                  Popular
                </span>
              )}
              <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="font-display text-4xl font-semibold">
                  {price}
                </span>
                <span
                  className={`pb-1 text-sm ${
                    highlight ? "text-cream/60" : "text-ink-soft"
                  }`}
                >
                  {period}
                </span>
              </div>
              {/* GST abhi off — registration nahi, base price hi dikhega:
              {showGst && (
                <p
                  className={`mt-1 text-xs font-medium ${
                    highlight ? "text-cream/60" : "text-ink-soft"
                  }`}
                >
                  {t.gstNote} · Total {gstTotal(price)}
                  {period}
                </p>
              )} */}
              <p
                className={`mt-2 text-sm ${
                  highlight ? "text-cream/70" : "text-ink-soft"
                }`}
              >
                {plan.tagline}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        highlight
                          ? "bg-terracotta text-white"
                          : "bg-sage/15 text-sage"
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className={highlight ? "text-cream/90" : "text-ink"}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setShowDownload(true)}
                className={`mt-7 inline-flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold transition active:scale-[0.98] ${
                  highlight
                    ? "bg-terracotta text-white shadow-warm hover:bg-terracotta-dark"
                    : "border border-ink bg-transparent text-ink hover:bg-ink hover:text-cream"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-6 max-w-xl text-center text-sm text-ink-soft">
        {tpl(t.note, vars)}
      </p>

      {showDownload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-5 backdrop-blur-sm"
          onClick={() => setShowDownload(false)}
        >
          <div
            className="w-full max-w-sm rounded-4xl border border-line bg-surface p-7 text-center shadow-warm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-terracotta/10 text-terracotta">
              <Sparkles size={30} />
            </div>
            <h3 className="mt-5 font-display text-2xl font-semibold">
              {dl.modalTitle}
            </h3>
            <p className="mt-2.5 text-ink-soft">{dl.modalBody}</p>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-6 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
            >
              {dl.modalCta}
            </a>
            <button
              type="button"
              onClick={() => setShowDownload(false)}
              className="mt-3 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              {dl.modalDismiss}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
