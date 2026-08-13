/**
 * Loader system (web) — app wale jaisa hi feel.
 *
 * Ek hi loader har jagah: app, web aur admin. App wala
 * `app-mobile/src/components/loader.tsx` me hai — dono ko saath me badalna.
 */

/**
 * BrandLoader — logo apni jagah par (center me) halke se saans leta hai, aur
 * uske PEECHE se brand ka naam DONO taraf nikalta hai:
 *
 *      "Apka"  ←  [LOGO]  →  "Saathi"
 *
 * ...thoda ruk ke dono wapas logo ke peeche chhup jaate hain.
 *
 * ⚠️ Pehle poora "Apka Saathi" ek hi tukda tha jo sirf DAAYI taraf nikalta tha.
 * Wo ek-tarfa lagta tha — logo beech me hota tha par naam hamesha daaye jhukta
 * tha. Dono taraf se nikalne par logo sach me beech ka lang bana rehta hai.
 * Wapas ek tukde par mat le jaana (app wala loader bhi ab yahi karta hai).
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
 *   2. Har taraf ek khidki (`overflow: hidden`) hai jo logo ke us kinare par
 *      khatam hoti hai: `.sa-win-l` ka DAAYAN kinara logo ke baaye kinare par,
 *      `.sa-win-r` ka BAAYAN kinara logo ke daaye kinare par.
 *
 * `translateX(±100%)` element ki APNI chaudai jitna khiskata hai — yaani us
 * haalat me tukda apni khidki se poora bahar (logo ke peeche) hota hai. Bilkul
 * gayab. Wahan se wo apni disha me sarakta hai — "logo ke peeche se nikalta
 * hua".
 *
 * Dono khidki absolute hain, isliye layout me jagah nahi leti: LOGO HAMESHA
 * CENTER ME RAHTA HAI, naam bahar aane par bhi khiskta nahi.
 *
 * Responsive: `size` sirf upper bound hai. Asli size `clamp()` se aata hai —
 * chhoti screen par loader apne aap chhota ho jaata hai, kabhi viewport se
 * bahar nahi nikalta. Naam/gap sab `em` me hain, to size ke saath khud scale
 * karte hain — koi alag breakpoint nahi chahiye.
 *
 * Rang: naam DO rango me hai — "Apka" dabaa hua (`text-ink-soft`) aur "Saathi"
 * brand ke rang me (`text-terracotta`). Isse nazar us shabd par jaati hai jo
 * brand ka asli naam hai, aur ek hi mote rang me likhe do shabd jaisa flat nahi
 * lagta. Dono token globals.css ke CSS variables se aate hain, isliye dono theme
 * me apne aap sahi rang milta hai.
 *
 * ⚠️ Web par parda `bg-cream/70` hai (LoadingOverlay) — yaani wo THEME ke saath
 * ulta hota hai, hamesha gehra nahi rehta. Isliye yahan theme-wale token hi sahi
 * hain. App me maamla ulta hai: wahan loader ka parda dono theme me gehra rehta
 * hai, to wahan `onInkSoft`/`onInkAccent` lagte hain. Dono files ka look ek hi
 * hai, par token ek jaise NAHI hain — copy karte waqt ye dhyaan rakhna.
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
          <>
            <span className="sa-win sa-win-l" aria-hidden>
              <span className="sa-name sa-name-l text-ink-soft">Apka</span>
            </span>
            <span className="sa-win sa-win-r" aria-hidden>
              <span className="sa-name sa-name-r text-terracotta">Saathi</span>
            </span>
          </>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sa-logo" src="/icon-256.png" alt={label || "Loading"} width={256} height={256} />
      </span>
      {label ? <span className="text-center text-sm font-semibold text-ink-soft">{label}</span> : null}
      <style>{`
        @keyframes sa-breathe { 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.05); } }
        /* Daaya tukda ("Saathi"): chhupa (logo ke peeche) -> bahar -> ruko -> wapas peeche.
           .67em yahan naam ke apne font-size (.24 box) par hai = ~.16 box —
           app wale GAP_RATIO ke barabar. */
        @keyframes sa-reveal-r {
          0%, 6%    { transform: translateX(-100%); }
          30%, 68%  { transform: translateX(.67em); }
          90%, 100% { transform: translateX(-100%); }
        }
        /* Baaya tukda ("Apka") — bilkul wahi safar, ulti disha me. */
        @keyframes sa-reveal-l {
          0%, 6%    { transform: translateX(100%); }
          30%, 68%  { transform: translateX(-.67em); }
          90%, 100% { transform: translateX(100%); }
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
        /* Dono khidki: 3x chaudi, taaki tukda poora bahar aa sake. Logo ke
           kinare par hi khatam hoti hain — wahi "peeche se nikalna" banata hai. */
        .sa-win {
          position: absolute; top: 0; z-index: 1;
          height: 100%; width: 300%;
          overflow: hidden;
          pointer-events: none;
        }
        /* Daayan kinara = logo ka baayan kinara. */
        .sa-win-l { right: 100%; }
        /* Baayan kinara = logo ka daayan kinara. */
        .sa-win-r { left: 100%; }
        .sa-name {
          position: absolute; top: 0; bottom: 0;
          display: flex; align-items: center;
          white-space: nowrap;
          font-size: .24em; font-weight: 800; letter-spacing: .012em;
          line-height: 1.1;
          will-change: transform;
        }
        .sa-name-l { right: 0; animation: sa-reveal-l 2.8s cubic-bezier(.4,0,.2,1) infinite; }
        .sa-name-r { left: 0;  animation: sa-reveal-r 2.8s cubic-bezier(.4,0,.2,1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sa-logo { animation: none; }
          /* Naam chhupa hi rehne do — warna wo logo ke bagal me chipka hua
             dikhta hai, jo animation ke bina bekaar lagta hai. */
          .sa-name-l { animation: none; transform: translateX(100%); }
          .sa-name-r { animation: none; transform: translateX(-100%); }
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
