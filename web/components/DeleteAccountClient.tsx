"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Trash2,
  Send,
  Mail,
  Smartphone,
  Globe,
  Check,
  X,
  Clock,
} from "lucide-react";
import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
import BackHomeLink from "@/components/BackHomeLink";
import DotsLoader from "@/components/DotsLoader";
import LoadingOverlay from "@/components/LoadingOverlay";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/offers";

/**
 * Account deletion page — Play Store ki data-deletion policy ke liye zaroori
 * public URL. Do raste dikhta hai: app ke andar khud delete karna, ya yahan se
 * request bhejna. Saath me saaf likha hai kya hatega, kya rukega, kitne din me.
 *
 * Poora text teeno bhasha me hai (`dictionaries.ts` > `deleteAccount`). Legal
 * pages ki tarah hardcode karna yahan galat hota: jo user apna account hata
 * raha hai wo kam se kam apni bhasha me padh sake, ye zaroori hai.
 */
export default function DeleteAccountClient() {
  const { deleteAccount: t } = useT();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!name.trim() || !emailOk) {
      toast("error", t.invalid);
      return;
    }
    if (!confirmed) {
      toast("error", t.needConfirm);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          reason: reason.trim(),
        }),
      });
      if (!res.ok) throw new Error("failed");
      setDone(true);
      toast("success", t.successToast);
    } catch {
      toast("error", t.errorToast);
    } finally {
      setLoading(false);
    }
  }

  const fieldCls =
    "w-full min-w-0 rounded-2xl border border-line bg-surface px-4 py-3.5 text-base text-ink shadow-soft outline-none transition placeholder:text-ink-soft/60 focus:border-terracotta focus:ring-4 focus:ring-terracotta/15";

  return (
    <div className="relative overflow-hidden bg-cream">
      <AnimatePresence>
        {loading && <LoadingOverlay label={t.sending} />}
      </AnimatePresence>

      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/15 sm:h-96 sm:w-96" />
      </div>

      <SubHeader />

      <main className="container-page py-14 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <BackHomeLink className="mb-6" />

          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <Trash2 size={14} className="text-terracotta" />
            {t.badge}
          </span>

          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            {t.heading}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
            {t.sub}
          </p>

          {/* Do raste */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta/12 text-terracotta">
                <Smartphone size={18} />
              </span>
              <h2 className="mt-3 font-display text-lg font-semibold">
                {t.inAppTitle}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {t.inAppSub}
              </p>
              <ol className="mt-3 space-y-2 text-sm text-ink-soft">
                {t.inAppSteps.map((s, i) => (
                  <li key={s} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-deep text-[11px] font-bold text-ink">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta/12 text-terracotta">
                <Globe size={18} />
              </span>
              <h2 className="mt-3 font-display text-lg font-semibold">
                {t.webTitle}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {t.webSub}
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Clock size={14} className="text-terracotta" />
                {t.webTime}
              </p>
            </div>
          </div>

          {/* Kya hatega / kya rukega */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <section className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
              <h2 className="font-display text-lg font-semibold">
                {t.deletedTitle}
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                {t.deleted.map((d) => (
                  <li key={d} className="flex gap-2.5">
                    <X size={15} className="mt-0.5 shrink-0 text-terracotta" />
                    {d}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
              <h2 className="font-display text-lg font-semibold">
                {t.keptTitle}
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                {t.kept.map((k) => (
                  <li key={k} className="flex gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-sage" />
                    {k}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Form */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              {t.formTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {t.formSub}
            </p>

            {done ? (
              <div className="mt-6 rounded-3xl border border-sage/40 bg-sage/10 p-6">
                <p className="font-display text-lg font-semibold text-ink">
                  {t.doneTitle}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {tpl(t.doneBody, { email })}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="d-name" className="mb-1.5 block text-sm font-semibold">
                    {t.name}
                  </label>
                  <input
                    id="d-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder={t.namePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={fieldCls}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="d-email" className="mb-1.5 block text-sm font-semibold">
                    {t.email}
                  </label>
                  <input
                    id="d-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={fieldCls}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="d-reason" className="mb-1.5 block text-sm font-semibold">
                    {t.reason}{" "}
                    <span className="font-medium text-ink-soft">{t.reasonOptional}</span>
                  </label>
                  <textarea
                    id="d-reason"
                    name="reason"
                    rows={4}
                    placeholder={t.reasonPlaceholder}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`${fieldCls} resize-y`}
                  />
                </div>

                <label className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-soft shadow-soft">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-terracotta"
                  />
                  <span>{t.confirm}</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-7 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {loading ? (
                    <DotsLoader variant="white" />
                  ) : (
                    <>
                      {t.submit}
                      <Send size={17} className="transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              {t.orEmail}{" "}
              <a
                href="mailto:info@apkasaathi.com?subject=Account%20delete%20request"
                className="inline-flex items-center gap-1.5 font-semibold text-terracotta hover:underline"
              >
                <Mail size={14} />
                info@apkasaathi.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
