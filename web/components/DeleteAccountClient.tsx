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

/**
 * Account deletion page — Play Store ki data-deletion policy ke liye zaroori
 * public URL. Do raste dikhta hai: app ke andar khud delete karna, ya yahan se
 * request bhejna. Saath me saaf likha hai kya hatega, kya rukega, kitne din me.
 *
 * ⚠️ Legal pages (privacy/terms) ki tarah ye bhi jaan-boojh ke Hinglish me
 * hardcoded hai — Play review isi page ko padhta hai, isliye text ek jagah aur
 * ek jaisa rehna chahiye.
 */

/** App ke andar ka rasta — sirf data hatana, account bana rehta hai. */
const IN_APP_STEPS = [
  "App khol ke sabse neeche 'You' tab par jao",
  "Neeche 'More' section tak scroll karo",
  "'Sab data delete' dabao aur confirm karo",
];

const DELETED = [
  "Aapka account aur login (email/Google)",
  "Profile — naam, photo, phone, address",
  "Saare documents aur unki uploaded files",
  "Saare reminders aur unka history",
  "Saathi ke saath ki gayi chat",
  "Referral data aur notification tokens",
];

const KEPT = [
  "Payment / invoice records — tax aur accounting kanoon ke tehat rakhne padte hain. Inme aapke documents ya reminders ka content nahi hota, sirf payment ka record.",
  "Anonymous usage counts jinme aapko pehchana nahi ja sakta.",
];

export default function DeleteAccountClient() {
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
      toast("error", "Naam aur sahi email dono chahiye.");
      return;
    }
    if (!confirmed) {
      toast("error", "Pehle neeche wala box tick karo.");
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
      toast("success", "Request mil gayi — confirmation email bhej diya hai.");
    } catch {
      toast("error", "Request nahi gayi. Thodi der baad try karo.");
    } finally {
      setLoading(false);
    }
  }

  const fieldCls =
    "w-full min-w-0 rounded-2xl border border-line bg-surface px-4 py-3.5 text-base text-ink shadow-soft outline-none transition placeholder:text-ink-soft/60 focus:border-terracotta focus:ring-4 focus:ring-terracotta/15";

  return (
    <div className="relative overflow-hidden bg-cream">
      <AnimatePresence>
        {loading && <LoadingOverlay label="Request bhej rahe hain…" />}
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
            Account &amp; data
          </span>

          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Apna account delete karein
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
            Ye page <b>Apka Saathi</b> (Android app) ke liye hai. Aap apna account
            aur uska saara data hamesha ke liye hata sakte ho — do raste hain,
            dono neeche likhe hain.
          </p>

          {/* Do raste */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta/12 text-terracotta">
                <Smartphone size={18} />
              </span>
              <h2 className="mt-3 font-display text-lg font-semibold">
                1. App ke andar se
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Sirf apna data (documents + reminders) hatana ho, account rehne
                dena ho:
              </p>
              <ol className="mt-3 space-y-2 text-sm text-ink-soft">
                {IN_APP_STEPS.map((s, i) => (
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
                2. Yahin se, poora account
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Account khud bhi hatana ho to neeche wala form bharo. Hum aapke
                email par confirmation bhejenge aur{" "}
                <b>7 din ke andar</b> sab kuch delete kar denge.
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Clock size={14} className="text-terracotta" />
                Zyada se zyada 7 din
              </p>
            </div>
          </div>

          {/* Kya hatega / kya rukega */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <section className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
              <h2 className="font-display text-lg font-semibold">
                Kya delete hoga
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                {DELETED.map((d) => (
                  <li key={d} className="flex gap-2.5">
                    <X size={15} className="mt-0.5 shrink-0 text-terracotta" />
                    {d}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
              <h2 className="font-display text-lg font-semibold">
                Kya rakha jayega
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                {KEPT.map((k) => (
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
              Delete request bhejo
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Wahi email daalo jisse aapka Saathi account bana hai — usi par hum
              confirmation bhejenge.
            </p>

            {done ? (
              <div className="mt-6 rounded-3xl border border-sage/40 bg-sage/10 p-6">
                <p className="font-display text-lg font-semibold text-ink">
                  Request mil gayi 🙏
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Confirmation email <b>{email}</b> par bhej diya hai. Aapka
                  account aur data 7 din ke andar hata diya jayega. Iraada badal
                  jaye to usi email ka jawab de dena.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="d-name" className="mb-1.5 block text-sm font-semibold">
                    Aapka naam
                  </label>
                  <input
                    id="d-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Jaise: Nitish Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={fieldCls}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="d-email" className="mb-1.5 block text-sm font-semibold">
                    Account ka email
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
                    placeholder="aap@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={fieldCls}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="d-reason" className="mb-1.5 block text-sm font-semibold">
                    Wajah <span className="font-medium text-ink-soft">(optional)</span>
                  </label>
                  <textarea
                    id="d-reason"
                    name="reason"
                    rows={4}
                    placeholder="Batana chaho to bata do — isse Saathi behtar banta hai."
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
                  <span>
                    Main samajhta/samajhti hoon ki mera account, documents aur
                    reminders hamesha ke liye hat jaayenge — ye wapas nahi aayega.
                  </span>
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
                      Delete request bhejo
                      <Send size={17} className="transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              Form na chale to seedha likho:{" "}
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
