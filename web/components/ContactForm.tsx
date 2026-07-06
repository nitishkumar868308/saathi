"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Mail, Send, MessageCircleHeart } from "lucide-react";
import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
import BackHomeLink from "@/components/BackHomeLink";
import DotsLoader from "@/components/DotsLoader";
import LoadingOverlay from "@/components/LoadingOverlay";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n/LanguageProvider";

type Status = "idle" | "loading";

export default function ContactForm() {
  const t = useT();
  const c = t.contact;
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!name.trim() || !emailOk || message.trim().length < 2) {
      toast("error", c.invalid);
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error("failed");
      toast("success", c.successToast);
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      toast("error", c.errorToast);
    } finally {
      setStatus("idle");
    }
  }

  const fieldCls =
    "w-full min-w-0 rounded-2xl border border-line bg-surface px-4 py-3.5 text-base text-ink shadow-soft outline-none transition placeholder:text-ink-soft/60 focus:border-terracotta focus:ring-4 focus:ring-terracotta/15";

  return (
    <div className="relative overflow-hidden">
      <AnimatePresence>
        {status === "loading" && <LoadingOverlay label={c.sending} />}
      </AnimatePresence>

      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/20 sm:h-96 sm:w-96" />
        <div className="blob right-[-8rem] top-52 h-80 w-80 bg-terracotta/10" />
      </div>

      <SubHeader />

      <main className="container-page py-14 sm:py-20">
        <div className="mx-auto max-w-xl">
          <BackHomeLink className="mb-6" />
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <MessageCircleHeart size={14} className="text-terracotta" />
              {c.badge}
            </span>
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            {c.heading}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
            {c.sub}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            <div>
              <label htmlFor="c-name" className="mb-1.5 block text-sm font-semibold">
                {c.name}
              </label>
              <input
                id="c-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder={c.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldCls}
                required
              />
            </div>

            <div>
              <label htmlFor="c-email" className="mb-1.5 block text-sm font-semibold">
                {c.email}
              </label>
              <input
                id="c-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={c.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldCls}
                required
              />
            </div>

            <div>
              <label htmlFor="c-message" className="mb-1.5 block text-sm font-semibold">
                {c.message}
              </label>
              <textarea
                id="c-message"
                name="message"
                rows={5}
                placeholder={c.messagePlaceholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={`${fieldCls} resize-y`}
                required
              />
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-7 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
            >
              {status === "loading" ? (
                <DotsLoader variant="white" />
              ) : (
                <>
                  {c.submit}
                  <Send size={17} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {c.orEmail}{" "}
            <a
              href="mailto:hello@saathi.app"
              className="inline-flex items-center gap-1.5 font-semibold text-terracotta hover:underline"
            >
              <Mail size={14} />
              hello@saathi.app
            </a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
