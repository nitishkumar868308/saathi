"use client";

import { Smartphone, Gift } from "lucide-react";
import { PLAY_STORE_URL } from "@/lib/links";
import { useOffers } from "@/lib/useOffers";
import { tpl } from "@/lib/offers";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Landing ka main CTA.
 * Offer ka text `app_config` se aata hai — admin numbers badle to yahan bhi badlega.
 */
export default function DownloadApp({ dark = false }: { dark?: boolean }) {
  const offers = useOffers();
  const t = useT();

  return (
    <div>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-7 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark active:scale-[0.98] sm:w-auto"
      >
        <Smartphone size={20} />
        {t.download.button}
      </a>

      {offers.referralsEnabled && (
        <p
          className={`mt-3.5 flex items-start gap-2 text-sm font-medium ${
            dark ? "text-cream/75" : "text-ink-soft"
          }`}
        >
          <Gift size={15} className="mt-0.5 shrink-0 text-terracotta" />
          <span>{tpl(t.download.offerLine, { d: offers.referralDays })}</span>
        </p>
      )}
    </div>
  );
}
