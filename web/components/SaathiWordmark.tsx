/**
 * Horizontal brand logo (icon + "Apka Saathi") — transparent, header/footer ke liye.
 * Height className se do, width auto.
 *
 * 640px wala version use hota hai (12 KB), original 1400px wala nahi (32 KB) —
 * header me ye kabhi 200px se chauda nahi hota.
 */
export default function SaathiWordmark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-horizontal-640.png"
      alt="Apka Saathi"
      width={640}
      height={160}
      decoding="async"
      className={`w-auto ${className}`}
    />
  );
}
