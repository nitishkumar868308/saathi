"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Copy, Share2, PartyPopper, UserCheck } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useToast } from "@/components/Toast";
import DotsLoader from "@/components/DotsLoader";
import LoadingOverlay from "@/components/LoadingOverlay";

type Status = "idle" | "loading" | "success" | "error";

export default function WaitlistForm({
  id,
  dark = false,
}: {
  id?: string;
  dark?: boolean;
}) {
  const { waitlist: tw } = useT();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [copied, setCopied] = useState(false);
  const [already, setAlready] = useState(false);
  const [shareUrl, setShareUrl] = useState("https://saathi.app");

  useEffect(() => {
    // Personal referral link once we know the origin
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/?ref=early`);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast("error", tw.invalidEmail);
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
      const data = await res.json().catch(() => ({}));
      const isAlready = Boolean(data?.already);
      setAlready(isAlready);
      setStatus("success");
      setEmail("");
      toast(isAlready ? "info" : "success", isAlready ? tw.already : tw.thankTitle);
    } catch {
      setStatus("idle");
      toast("error", tw.error);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function shareLink() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Saathi — jo kuch nahi bhoolta",
          text: "Main Saathi ki early access list mein hoon. Tum bhi jud jao 👇",
          url: shareUrl,
        });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    copyLink();
  }

  // ---- Thank You screen (success) ----
  if (status === "success") {
    return (
      <div
        className={`rounded-3xl border p-5 sm:p-6 ${
          dark
            ? "border-white/15 bg-white/10 text-cream"
            : "border-sage/40 bg-sage/10 text-ink"
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${
              already ? "bg-amber-warm" : "bg-sage"
            }`}
          >
            {already ? (
              <UserCheck size={20} strokeWidth={2.2} />
            ) : (
              <PartyPopper size={20} strokeWidth={2.2} />
            )}
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">
              {already ? tw.already : tw.thankTitle}
            </p>
            <p
              className={`text-sm ${dark ? "text-cream/75" : "text-ink-soft"}`}
            >
              {already ? tw.alreadySub : tw.thankSub}
            </p>
          </div>
        </div>

        <div
          className={`mt-5 rounded-2xl border p-4 ${
            dark ? "border-white/15 bg-black/20" : "border-line bg-surface"
          }`}
        >
          <p className="text-sm font-semibold">{tw.referTitle}</p>
          <p className={`mt-1 text-xs ${dark ? "text-cream/70" : "text-ink-soft"}`}>
            {tw.referSub}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={copyLink}
              className={`inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                dark
                  ? "border-white/20 bg-white/10 text-cream hover:bg-white/20"
                  : "border-line bg-cream-deep/40 text-ink hover:bg-cream-deep/70"
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span className="truncate">
                {copied ? tw.copied : tw.copy}
              </span>
            </button>
            <button
              type="button"
              onClick={shareLink}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-terracotta px-5 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
            >
              <Share2 size={16} />
              {tw.share}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Form ----
  const inputBase = dark
    ? "border-white/20 bg-white/95 text-ink placeholder:text-ink-soft/60 focus:border-white focus:ring-white/25"
    : "border-line bg-surface text-ink placeholder:text-ink-soft/60 focus:border-terracotta focus:ring-terracotta/15";

  return (
    <>
      <AnimatePresence>
        {status === "loading" && <LoadingOverlay label={tw.sending} />}
      </AnimatePresence>
      <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={tw.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`h-16 w-full min-w-0 flex-1 rounded-2xl border px-5 text-base shadow-soft outline-none transition focus:ring-4 sm:h-14 ${inputBase}`}
          required
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="group inline-flex h-16 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-terracotta px-7 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 sm:h-14 sm:w-auto"
        >
          {status === "loading" ? (
            <DotsLoader variant="white" />
          ) : (
            <>
              {tw.button}
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </>
          )}
        </button>
      </div>
      <p
        className={`mt-3 pl-1 text-xs ${dark ? "text-cream/60" : "text-ink-soft"}`}
      >
        {tw.noSpam}
      </p>
      </form>
    </>
  );
}
