/**
 * Smooth branded loader — do rings (alag speed/direction) + dhadakta core.
 * App wale loader jaisa hi feel. Web pe har spinner ki jagah yahi use karo.
 */
export default function Loader({
  size = 44,
  label,
}: {
  size?: number;
  label?: string;
}) {
  const border = Math.max(3, size * 0.08);
  const inner = size * 0.64;
  const core = size * 0.26;

  return (
    <div className="flex flex-col items-center justify-center gap-3.5">
      <span
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
        role="status"
        aria-label={label || "Loading"}
      >
        {/* Outer ring — fast */}
        <span
          className="absolute animate-spin rounded-full"
          style={{
            width: size,
            height: size,
            borderWidth: border,
            borderStyle: "solid",
            borderColor: "rgba(194,90,55,0.14)",
            borderTopColor: "#C25A37",
            animationDuration: "0.9s",
          }}
        />
        {/* Inner ring — slow, reverse */}
        <span
          className="absolute animate-spin rounded-full"
          style={{
            width: inner,
            height: inner,
            borderWidth: Math.max(2.5, size * 0.06),
            borderStyle: "solid",
            borderColor: "rgba(224,164,88,0.16)",
            borderTopColor: "#E0A458",
            animationDuration: "2.2s",
            animationDirection: "reverse",
          }}
        />
        {/* Pulsing core */}
        <span
          className="absolute animate-pulse rounded-full"
          style={{ width: core, height: core, background: "#C25A37" }}
        />
      </span>
      {label ? <span className="text-sm font-semibold text-ink-soft">{label}</span> : null}
    </div>
  );
}
