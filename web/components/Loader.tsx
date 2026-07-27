/**
 * Loader system (web) — app wale jaisa hi feel.
 *
 * Soch: ghoomta spinner "dheema" lagta hai. Isliye teen dots ki tez lehar,
 * aur content ke liye Skeleton (page ka shape turant dikh jaata hai).
 */

/**
 * BrandLoader — Saathi ka apna logo saans leta hai, peeche naram teal ripple
 * ring phailti hai, aur beech-beech ek dil upar tairta hai. App wale loader
 * jaisa bilkul same (ek hi loader har jagah — app, web, admin).
 * Chhota (button) size par sirf saans-leta logo; bade par ring + dil bhi.
 */
export default function Loader({
  size = 48,
  label,
}: {
  size?: number;
  label?: string;
  /** compatibility — ab use nahi hota (logo apne rang laata hai). */
  color?: string;
}) {
  const halo = size >= 40;
  const radius = Math.round(size * 0.3);
  const heart = Math.round(size * 0.28);
  const up = Math.round(size * 0.55);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <span
        role="status"
        aria-label={label || "Loading"}
        style={{ position: "relative", width: size, height: size, display: "inline-block" }}
      >
        {halo && (
          <>
            <span className="sa-ring" style={{ width: size, height: size, borderRadius: radius }} />
            <span className="sa-ring sa-ring2" style={{ width: size, height: size, borderRadius: radius }} />
          </>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="sa-logo"
          src="/logo.png"
          alt={label || "Loading"}
          width={size}
          height={size}
          style={{ width: size, height: size, borderRadius: radius, position: "relative", display: "block" }}
        />
        {halo && (
          <span className="sa-heart" style={{ width: heart, height: heart, marginLeft: -heart / 2, color: "#C25A37" }}>
            <svg viewBox="0 0 24 24" width={heart} height={heart} fill="currentColor" aria-hidden>
              <path d="M12 21s-7.5-4.9-10-9.4C.4 8.2 2 5 5.2 5c2 0 3.3 1.2 3.8 2.2C9.5 6.2 10.8 5 12.8 5 16 5 17.6 8.2 16 11.6 13.5 16.1 12 21 12 21z" />
            </svg>
          </span>
        )}
      </span>
      {label ? <span className="text-sm font-semibold text-ink-soft">{label}</span> : null}
      <style>{`
        @keyframes sa-breathe { 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.06); } }
        @keyframes sa-ripple  { 0%{ transform: scale(.95); opacity:.22; } 100%{ transform: scale(1.85); opacity:0; } }
        @keyframes sa-float {
          0%,32%  { opacity:0; transform: translateX(-50%) translateY(0) scale(.4); }
          46%,60% { opacity:1; transform: translateX(-50%) translateY(-${up}px) scale(1); }
          82%,100%{ opacity:0; transform: translateX(-50%) translateY(-${up + 8}px) scale(.6); }
        }
        .sa-logo  { animation: sa-breathe 1.8s ease-in-out infinite; }
        .sa-ring  { position:absolute; inset:0; background:#125156; z-index:0; animation: sa-ripple 1.8s ease-out infinite; }
        .sa-ring2 { animation-delay: .9s; }
        .sa-heart { position:absolute; left:50%; top:50%; z-index:2; animation: sa-float 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sa-logo, .sa-ring, .sa-heart { animation: none; }
          .sa-ring { opacity: 0; }
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
