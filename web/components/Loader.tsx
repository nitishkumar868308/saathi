/**
 * Loader system (web) — app wale jaisa hi feel.
 *
 * Ek hi loader har jagah: app, web aur admin. App wala
 * `app-mobile/src/components/loader.tsx` me hai — dono ko saath me badalna.
 */

/**
 * BrandLoader — logo apni jagah par (center me) halke se saans leta hai, aur
 * uske PEECHE se "Apka Saathi" sarak ke bahar aata hai, thoda ruk ke wapas
 * logo ke peeche chhup jaata hai.
 *
 * ⚠️ Logo ke liye `/icon-256.png` — `/logo-128.png` NAHI. logo-128 ke andar
 * "Apka Saathi" pehle se baked hai, to us par ye animation do baar naam dikha
 * deti (ek chipka hua, ek sarakta hua). icon-256 saaf mark hai.
 *
 * ⚠️ Logo ke peeche wali teal ripple-ring (circle) jaan-boojh ke hata di gayi
 * hai, wapas mat laana — wo dhyaan logo se hata leti thi aur har page ke bg
 * par apna alag rang dikhati thi.
 *
 * ── Naam "peeche se" kaise nikalta hai ──────────────────────────────────
 *
 * Do cheezein milke:
 *
 *   1. Logo ki image OPAQUE hai (teal square) aur `z-index` me upar hai — jo
 *      text uske x-range me hai wo apne aap dhak jaata hai.
 *   2. Logo ke baaye wala hissa `.sa-window` kaat deti hai (`overflow: hidden`,
 *      jiska baayan kinara theek logo ke baaye kinare par hai).
 *
 * `translateX(-100%)` element ki APNI chaudai jitna khiskata hai — yaani us
 * haalat me naam ka daayan kinara theek logo ke daaye kinare par baithta hai,
 * to naam poora ya logo ke neeche hai ya khidki ke bahar. Bilkul gayab. Wahan
 * se wo daaye sarakta hai — "logo ke peeche se nikalta hua".
 *
 * `.sa-window` absolute hai, isliye layout me jagah nahi leti: LOGO HAMESHA
 * CENTER ME RAHTA HAI, naam bahar aane par bhi khiskta nahi.
 *
 * Responsive: `size` sirf upper bound hai. Asli size `clamp()` se aata hai —
 * chhoti screen par loader apne aap chhota ho jaata hai, kabhi viewport se
 * bahar nahi nikalta. Naam/gap sab `em` me hain, to size ke saath khud scale
 * karte hain — koi alag breakpoint nahi chahiye.
 *
 * Rang: naam `text-ink` par hai, jo dono theme me apne aap ulta ho jaata hai
 * (globals.css ke CSS variables) — light page par gehra, dark par ujla.
 */
export default function Loader({
  size = 48,
  label,
  brand,
}: {
  size?: number;
  label?: string;
  /** Logo ke peeche se brand ka naam bhi nikale. Bade (full-screen) loader par. */
  brand?: boolean;
  /** compatibility — ab use nahi hota (logo apne rang laata hai). */
  color?: string;
}) {
  // Chhoti screens par size ko viewport ke hisaab se sikodo. Floor = 60% of
  // requested (ya 24px, jo bada ho) taaki button loader gayab na ho jaye.
  const min = Math.max(24, Math.round(size * 0.6));
  const box = `clamp(${min}px, ${(size / 3.9).toFixed(2)}vmin, ${size}px)`;
  const showName = brand ?? size >= 56;

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <span
        role="status"
        aria-label={label || "Loading"}
        className="sa-box"
        style={{ ["--sa-box" as string]: box }}
      >
        {showName && (
          <span className="sa-window" aria-hidden>
            <span className="sa-name text-ink">Apka Saathi</span>
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sa-logo" src="/icon-256.png" alt={label || "Loading"} width={256} height={256} />
      </span>
      {label ? <span className="text-center text-sm font-semibold text-ink-soft">{label}</span> : null}
      <style>{`
        @keyframes sa-breathe { 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.05); } }
        @keyframes sa-reveal {
          /* chhupa (logo ke peeche) -> bahar -> ruko -> wapas peeche */
          /* .67em yahan naam ke apne font-size (.24 box) par hai = ~.16 box —
             app wale GAP_RATIO ke barabar. */
          0%, 6%    { transform: translateX(-100%); }
          30%, 68%  { transform: translateX(.67em); }
          90%, 100% { transform: translateX(-100%); }
        }
        .sa-box {
          position: relative;
          display: inline-block;
          width: var(--sa-box);
          height: var(--sa-box);
          font-size: var(--sa-box);   /* har child em me — size ke saath scale */
          line-height: 0;
        }
        .sa-logo {
          position: relative; z-index: 2;   /* naam iske PEECHE se nikalta hai */
          width: 100%; height: 100%;
          border-radius: .3em;
          display: block;
          animation: sa-breathe 1.8s ease-in-out infinite;
          will-change: transform;
        }
        /* Khidki ka baayan kinara = logo ka baayan kinara. Daayi taraf udaar
           chaudai, taaki naam poora bahar aa sake. */
        .sa-window {
          position: absolute; left: 0; top: 0; z-index: 1;
          height: 100%; width: 400%;
          overflow: hidden;
          display: flex; align-items: center;
          pointer-events: none;
        }
        .sa-name {
          position: absolute; left: 25%;   /* = 100% of .sa-box (window 4x hai) */
          white-space: nowrap;
          font-size: .24em; font-weight: 800; letter-spacing: .012em;
          line-height: 1.1;
          animation: sa-reveal 2.8s cubic-bezier(.4,0,.2,1) infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .sa-logo { animation: none; }
          /* Naam chhupa hi rehne do — warna wo logo ke bagal me chipka hua
             dikhta hai, jo animation ke bina bekaar lagta hai. */
          .sa-name { animation: none; transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

/** Halka dhadakta placeholder — content ka dhaancha. */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-lg bg-line/70 ${className}`}
      style={style}
    />
  );
}

/** Table/list rows ka dhaancha. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
