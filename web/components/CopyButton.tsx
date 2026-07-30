"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * "Copy" — jahan bhi koi code/link dikhta hai wahan ek hi button.
 *
 * Do soorat me chalta hai: naye browser `navigator.clipboard` dete hain, par wo
 * sirf HTTPS (ya localhost) par milta hai. Purane browser aur http par wo
 * `undefined` hota hai aur button chup-chaap kuch na karta — isliye neeche
 * textarea + `execCommand` wala purana tareeka fallback me rakha hai.
 *
 * Copy hone par icon 2 second ke liye tick ban jaata hai — user ko pata chal
 * jaata hai ki sach me ho gaya (bina kisi toast ke).
 */
export default function CopyButton({
  value,
  label,
  copiedLabel = "Copy ho gaya",
  className = "",
}: {
  value: string;
  /** Button par likha text. Na do to sirf icon (aria-label se accessible). */
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  // Tick ko 2s baad wapas copy-icon bana do.
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        legacyCopy(value);
      }
      setCopied(true);
    } catch {
      // Permission block ho gayi — purane tareeke se ek baar aur.
      try {
        legacyCopy(value);
        setCopied(true);
      } catch {
        /* kuch nahi ho saka — button waisa hi rahega */
      }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? copiedLabel : (label ?? "Copy")}
      className={
        className ||
        "inline-flex items-center gap-2 rounded-xl border border-terracotta/35 bg-surface px-3.5 py-2 text-sm font-semibold text-terracotta transition hover:bg-terracotta/10 active:scale-[0.98]"
      }
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {label ? <span>{copied ? copiedLabel : label}</span> : null}
    </button>
  );
}

/** clipboard API na ho (http / purana browser) — hidden textarea se copy. */
function legacyCopy(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  // Screen se bahar rakho, warna page ek jhatke me scroll ho jaata hai.
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.setAttribute("readonly", "");
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}
