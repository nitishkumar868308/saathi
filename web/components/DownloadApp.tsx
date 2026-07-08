import { Smartphone, Gift } from "lucide-react";
import { PLAY_STORE_URL } from "@/lib/links";

/**
 * Landing ka main CTA — waitlist ki jagah.
 * App live hai, isliye seedha Play Store bhejo.
 */
export default function DownloadApp({ dark = false }: { dark?: boolean }) {
  return (
    <div>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-7 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark active:scale-[0.98] sm:w-auto"
      >
        <Smartphone size={20} />
        Play Store se download karo
      </a>

      <p
        className={`mt-3.5 flex items-center gap-2 text-sm font-medium ${
          dark ? "text-cream/75" : "text-ink-soft"
        }`}
      >
        <Gift size={15} className="shrink-0 text-terracotta" />
        Pehle 1000 users ko Saathi Plus <strong className="font-semibold">3 mahine free</strong>
      </p>
    </div>
  );
}
