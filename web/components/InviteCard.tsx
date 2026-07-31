"use client";

import { Gift, Smartphone } from "lucide-react";

import SaathiLogo from "@/components/SaathiLogo";
import CopyButton from "@/components/CopyButton";
import { PLAY_STORE_URL } from "@/lib/links";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/offers";

/**
 * Referral invite ka card — chuni hui bhasha me.
 *
 * ⚠️ Ye poora page pehle server component tha aur uska har shabd hardcoded
 * Hinglish. Ye aksar kisi naye insaan ki Saathi se PEHLI mulaqat hoti hai
 * (dost ne link bheja hai), aur wahin language switcher kaam nahi karta tha.
 *
 * `days` server se aata hai (offers config) — wo har bhasha me wahi number hai.
 */
export default function InviteCard({ code, days }: { code: string; days: number }) {
  const { invite: i } = useT();

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-md rounded-4xl border border-line bg-surface p-7 text-center shadow-warm sm:p-9">
        <SaathiLogo size={68} className="mx-auto block rounded-2xl shadow-warm" />

        <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-3xl bg-terracotta/10 text-terracotta">
          <Gift size={26} />
        </div>

        <h1 className="mt-5 font-display text-2xl font-semibold">{i.heading}</h1>
        <p className="mt-2.5 text-ink-soft">
          {i.sub}{" "}
          <strong className="text-ink">{tpl(i.subStrong, { d: days })}</strong>
        </p>

        <div className="mt-6 rounded-2xl border-2 border-dashed border-terracotta bg-terracotta/[0.07] py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            {i.codeLabel}
          </p>
          <p className="mt-1.5 font-display text-3xl font-bold tracking-[0.3em] text-terracotta">
            {code}
          </p>
          {/* App abhi install nahi hui to code yaad rakhna padta tha — ab ek tap
              me clipboard me, signup ke waqt paste kar do. */}
          <CopyButton
            value={code}
            label={i.copy}
            copiedLabel={i.copied}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-terracotta/35 bg-surface px-3.5 py-2 text-xs font-bold text-terracotta transition hover:bg-terracotta/10 active:scale-[0.98]"
          />
        </div>

        <a
          href={PLAY_STORE_URL}
          className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
        >
          <Smartphone size={20} />
          {i.download}
        </a>

        {/* Condition saaf-saaf — kya karna hai reward ke liye */}
        <div className="mt-6 rounded-2xl border border-line bg-cream-deep/25 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {tpl(i.howTitle, { d: days })}
          </p>
          <ol className="mt-2.5 space-y-2 text-sm text-ink">
            {i.steps.map((step, n) => (
              <li key={step} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta text-[11px] font-bold text-white">
                  {n + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-soft">{tpl(i.footer, { d: days })}</p>
        </div>
      </div>
    </div>
  );
}
