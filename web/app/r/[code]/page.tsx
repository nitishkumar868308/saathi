import type { Metadata } from "next";
import { Gift, Smartphone } from "lucide-react";
import SaathiMark from "@/components/SaathiMark";
import { PLAY_STORE_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Aapko invite mila 🎁",
  robots: { index: false, follow: false },
};

/**
 * Referral share-link: apkasaathi.com/r/CODE
 * App install hone ke baad ye link app kholta hai aur code apne aap bhar jaata hai.
 * Yahan bas invite dikhate hain + Play Store bhejte hain.
 */
export default function ReferralInvite({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase().slice(0, 10);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-md rounded-4xl border border-line bg-surface p-7 text-center shadow-warm sm:p-9">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-terracotta text-white shadow-warm">
          <SaathiMark size={28} className="text-white" />
        </div>

        <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-3xl bg-terracotta/10 text-terracotta">
          <Gift size={26} />
        </div>

        <h1 className="mt-5 font-display text-2xl font-semibold">
          Aapko Apka Saathi ka invite mila 🎉
        </h1>
        <p className="mt-2.5 text-ink-soft">
          Is code se join karo — aapko aur aapke dost, <strong className="text-ink">dono ko
          15 din Saathi Plus free</strong> milega.
        </p>

        <div className="mt-6 rounded-2xl border-2 border-dashed border-terracotta bg-terracotta/[0.07] py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Referral code
          </p>
          <p className="mt-1.5 font-display text-3xl font-bold tracking-[0.3em] text-terracotta">
            {code}
          </p>
        </div>

        <a
          href={PLAY_STORE_URL}
          className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
        >
          <Smartphone size={20} />
          App download karo
        </a>

        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          App khulte hi code apne aap bhar jaayega. Signup ke baad pehla document daalo
          aur Saathi se ek baar baat karo — bas, dono ko 15 din Plus mil jaayega.
        </p>
      </div>
    </div>
  );
}
