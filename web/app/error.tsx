"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home, Mail } from "lucide-react";

/**
 * Runtime error ka page (Next ka error boundary).
 *
 * ⚠️ Yahan `SubHeader`/`Footer` jaan-boojh ke nahi hain. Error unhi me se kisi
 * component ka ho sakta hai — us soorat me unhe dobara render karna page ko phir
 * se tod deta hai. Isliye ye screen bilkul akeli aur simple hai.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server par digest ke saath already log ho chuka hai; yahan browser console
    // me bhi rakh dete hain taaki support ko debug karne me aasani ho.
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Something broke on our side
        </h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          This one is on us, not on you. Try again — and if it keeps happening,
          tell us and we will fix it.
        </p>

        {error.digest && (
          <p className="mt-4 text-xs text-ink-soft">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <RotateCcw size={16} /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:border-terracotta/40"
          >
            <Home size={16} /> Home
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:border-terracotta/40"
          >
            <Mail size={16} /> Contact
          </Link>
        </div>
      </div>
    </main>
  );
}
