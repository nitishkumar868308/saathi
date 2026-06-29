"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export default function WaitlistForm({ id }: { id?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Sahi email daalo 🙂");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("success");
      setMessage("Aap list mein ho! Launch pe sabse pehle batayenge. 🎉");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Kuch gadbad ho gayi. Thodi der baad try karo.");
    }
  }

  if (status === "success") {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-sage/40 bg-sage/10 px-5 py-4 text-ink"
        role="status"
        aria-live="polite"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage text-white">
          <Check size={18} strokeWidth={2.5} />
        </span>
        <p className="text-sm font-medium sm:text-base">{message}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full"
      noValidate
      aria-describedby={message ? `${id}-msg` : undefined}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="aapka@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          className="h-14 flex-1 rounded-2xl border border-line bg-surface px-5 text-base text-ink placeholder:text-ink-soft/60 outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
          required
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="group inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-terracotta px-7 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Ruko...
            </>
          ) : (
            <>
              Early access lo
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </>
          )}
        </button>
      </div>
      {message && status === "error" && (
        <p
          id={`${id}-msg`}
          role="alert"
          className="mt-2 pl-1 text-sm text-terracotta-dark"
        >
          {message}
        </p>
      )}
      <p className="mt-3 pl-1 text-xs text-ink-soft">
        Koi spam nahi. Sirf launch ki khabar. Kabhi bhi unsubscribe.
      </p>
    </form>
  );
}
