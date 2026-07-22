/**
 * Loader system (web) — app wale jaisa hi feel.
 *
 * Soch: ghoomta spinner "dheema" lagta hai. Isliye teen dots ki tez lehar,
 * aur content ke liye Skeleton (page ka shape turant dikh jaata hai).
 */

export default function Loader({
  size = 44,
  label,
  color = "#C25A37",
}: {
  size?: number;
  label?: string;
  color?: string;
}) {
  const dot = Math.round(size * 0.2);
  const gap = Math.round(size * 0.14);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <span
        className="inline-flex items-end"
        style={{ gap }}
        role="status"
        aria-label={label || "Loading"}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="saathi-dot inline-block rounded-full"
            style={{
              width: dot,
              height: dot,
              background: color,
              animationDelay: `${i * 110}ms`,
            }}
          />
        ))}
      </span>
      {label ? <span className="text-sm font-semibold text-ink-soft">{label}</span> : null}
      <style>{`
        @keyframes saathi-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: .45; }
          30%           { transform: translateY(-${Math.round(size * 0.26)}px); opacity: 1; }
        }
        .saathi-dot { animation: saathi-bounce .9s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .saathi-dot { animation: none; opacity: .7; }
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
