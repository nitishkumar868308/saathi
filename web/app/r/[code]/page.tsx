import type { Metadata } from "next";
import { Gift, Smartphone } from "lucide-react";
import SaathiLogo from "@/components/SaathiLogo";
import CopyButton from "@/components/CopyButton";
import { PLAY_STORE_URL } from "@/lib/links";
import { getOffers } from "@/lib/offers";

export const metadata: Metadata = {
  title: "Aapko invite mila 🎁",
  robots: { index: false, follow: false },
};

/**
 * Referral share-link: apkasaathi.com/r/CODE
 * App install hone ke baad ye link app kholta hai aur code apne aap bhar jaata hai.
 * Yahan bas invite dikhate hain + Play Store bhejte hain.
 */
export default async function ReferralInvite({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase().slice(0, 10);
  const offers = await getOffers();
  const days = offers.referralDays;

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-md rounded-4xl border border-line bg-surface p-7 text-center shadow-warm sm:p-9">
        <SaathiLogo size={68} className="mx-auto block rounded-2xl shadow-warm" />

        <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-3xl bg-terracotta/10 text-terracotta">
          <Gift size={26} />
        </div>

        <h1 className="mt-5 font-display text-2xl font-semibold">
          Aapko Apka Saathi ka invite mila 🎉
        </h1>
        <p className="mt-2.5 text-ink-soft">
          Is code se join karo — aapko aur aapke dost, <strong className="text-ink">dono ko{" "}
          {days} din ka Saathi Plus plan free</strong> milega.
        </p>

        <div className="mt-6 rounded-2xl border-2 border-dashed border-terracotta bg-terracotta/[0.07] py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Referral code
          </p>
          <p className="mt-1.5 font-display text-3xl font-bold tracking-[0.3em] text-terracotta">
            {code}
          </p>
          {/* App abhi install nahi hui to code yaad rakhna padta tha — ab ek tap
              me clipboard me, signup ke waqt paste kar do. */}
          <CopyButton
            value={code}
            label="Code copy karo"
            copiedLabel="Copy ho gaya"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-terracotta/35 bg-surface px-3.5 py-2 text-xs font-bold text-terracotta transition hover:bg-terracotta/10 active:scale-[0.98]"
          />
        </div>

        <a
          href={PLAY_STORE_URL}
          className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
        >
          <Smartphone size={20} />
          App download karo
        </a>

        {/* Condition saaf-saaf — kya karna hai reward ke liye */}
        <div className="mt-6 rounded-2xl border border-line bg-cream-deep/25 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {days} din kaise milenge
          </p>
          <ol className="mt-2.5 space-y-2 text-sm text-ink">
            {[
              "App download karo — code apne aap bhar jaayega",
              "Account banao",
              "Apna pehla document add karo",
              "Saathi se ek baar baat karo",
            ].map((step, i) => (
              <li key={step} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-soft">
            Chaaron ho gaye — dono ko {days} din ka Saathi Plus plan. 🎉
          </p>
        </div>
      </div>
    </div>
  );
}
