/**
 * Asli brand logo (AS + do log + handshake) — public/logo.png se.
 * Terracotta chip + SaathiMark glyph ki jagah ye poora colored logo dikhata hai.
 * Rounding/shadow caller className se de.
 */
export default function SaathiLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon-square.png"
      alt="Apka Saathi"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}
