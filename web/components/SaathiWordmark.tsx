/**
 * Horizontal brand logo (icon + "Apka Saathi") — transparent, header/footer ke liye.
 * public/logo-horizontal.png (asli artwork se bana). Height className se do, width auto.
 */
export default function SaathiWordmark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-horizontal.png" alt="Apka Saathi" className={`w-auto ${className}`} />
  );
}
