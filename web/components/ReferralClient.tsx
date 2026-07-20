"use client";

import { Gift, Info, Smartphone } from "lucide-react";
import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
import { useOffers } from "@/lib/useOffers";
import { tpl } from "@/lib/offers";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PLAY_STORE_URL } from "@/lib/links";

/**
 * Referral page — poori tarah login-free.
 *
 * Web pe koi login nahi. Referral app ke andar se hi manage hota hai (code,
 * sharing, stats sab app me). Yahan sirf offer + kaise kaam karta hai + app
 * download — taaki naya user turant app le aur referral start kare.
 */
export default function ReferralClient() {
  const { referral: t } = useT();
  const offers = useOffers();
  const days = offers.referralDays;
  const vars = { d: days };

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <SubHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-amber-warm/20 blur-3xl" />
            <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-terracotta/12 blur-3xl" />
          </div>
          <div className="container-page relative py-12 text-center sm:py-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/8 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-terracotta">
              <Gift size={13} />
              {t.badge}
            </span>
            <h1 className="mx-auto mt-5 max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t.heading}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink-soft sm:text-lg">
              {tpl(t.sub, vars)}
            </p>
          </div>
        </section>

        {/* Content — steps + download only */}
        <div className="container-page py-10 sm:py-14">
          <div className="mx-auto max-w-lg">
            <div className="rounded-4xl border border-line bg-surface p-6 shadow-warm sm:p-8">
              <h2 className="font-display text-xl font-semibold">
                {tpl(t.cardTitle, vars)} 🎉
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {tpl(t.cardSub, vars)}
              </p>

              {/* Kaise kaam karta hai */}
              <ol className="mt-6 space-y-4">
                {t.steps.map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-terracotta/10 font-display text-base font-bold text-terracotta">
                      {i + 1}
                    </span>
                    <p className="pt-1.5 text-sm leading-relaxed text-ink-soft">{s}</p>
                  </li>
                ))}
              </ol>

              <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-line bg-cream-deep/25 p-4 text-xs leading-relaxed text-ink-soft">
                <Info size={15} className="mt-px shrink-0 text-terracotta" />
                {tpl(t.capNote, vars)}
              </p>

              {/* Sirf app download */}
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark active:scale-[0.99]"
              >
                <Smartphone size={19} />
                {t.downloadApp}
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
