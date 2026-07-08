/**
 * Saathi mascot mark — ek pyaara dost (shiny eyes, smile, blush).
 * `fill="currentColor"` + evenodd: aankhein/muskaan/gaal holes hain jo peeche ka
 * background dikhate hain. Isliye terracotta chip pe cream mark + terracotta holes.
 *
 * Color CSS `color` se set karo (e.g. className="text-white").
 */
export const SAATHI_MARK_PATH =
  "M50 12 C70 12 82 26 82 47 L82 62 C82 79 68 87 50 87 C32 87 18 79 18 62 L18 47 C18 26 30 12 50 12 Z M32 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M54 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M39.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M61.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M26.5 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M66.7 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M39 60 Q50 70 61 60 Q50 64.5 39 60 Z";

export default function SaathiMark({
  size = 24,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d={SAATHI_MARK_PATH}
      />
    </svg>
  );
}
