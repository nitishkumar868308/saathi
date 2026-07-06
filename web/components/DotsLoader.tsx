/**
 * Pyaara loader — teen bouncing dots, brand ke rangon mein.
 * Buttons ke andar (white variant) aur standalone dono ke liye.
 */
export default function DotsLoader({
  className = "",
  variant = "brand",
}: {
  className?: string;
  variant?: "brand" | "white";
}) {
  const colors =
    variant === "white"
      ? ["#ffffff", "#ffffff", "#ffffff"]
      : ["#C25A37", "#E0A458", "#7C8A6B"];
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role="status"
      aria-label="Loading"
    >
      {colors.map((c, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full animate-loader-bounce"
          style={{ backgroundColor: c, animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}
