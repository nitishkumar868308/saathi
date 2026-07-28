/**
 * Asli brand logo (AS + do log + handshake).
 * Rounding/shadow caller className se de.
 *
 * ⚠️ File `icon-256.png` hai, `icon-square.png` nahi. Original 266 KB ka hai aur
 * kahin bhi 48px se bada nahi dikhta — yaani har page load par ~250 KB bekaar
 * jaata tha. 256px wala version 20 KB ka hai aur retina par bhi saaf dikhta hai.
 * (Dobara banana ho to: scripts wale sharp snippet se resize kar lena.)
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
      src="/icon-256.png"
      alt="Apka Saathi"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`object-contain ${className}`}
    />
  );
}
