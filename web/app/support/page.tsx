import type { Metadata } from "next";
import { ldJson } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo-server";
import Link from "next/link";
import { Mail, MessageCircle, BellRing, ShieldCheck, ArrowRight } from "lucide-react";

import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
import BackHomeLink from "@/components/BackHomeLink";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://apkasaathi.com";
const SUPPORT_EMAIL = "info@apkasaathi.com";

export function generateMetadata(): Promise<Metadata> {
  // Meta DB (`seo_pages`) se — admin panel se badla ja sakta hai.
  return pageMetadata("/support", {
    title: "Support & Help",
    description:
      "Get help with Apka Saathi — reminders arriving late, notifications not showing, account and billing questions. Answers and a way to reach us.",
  });
}

/**
 * Support page.
 *
 * Sabse upar wahi ek sawaal hai jo sabse zyada poocha jaata hai — "reminder time
 * pe kyun nahi aaya". Uska jawab neeche chhupa dena support email badha deta hai,
 * isliye wo pehle hai.
 */
const HELP = [
  {
    icon: BellRing,
    q: "My reminder arrived late, or not at all",
    a: [
      "Android needs three permissions before it will deliver a reminder at the exact minute: notifications, exact alarms, and permission to run in the background. If any one is missing, the system batches your reminder with other alarms and it can land five to ten minutes late.",
      "In the app, open You → Make reminders reliable. It shows each permission with its current status and an Allow button. Turn on everything that is not green.",
      "On Xiaomi, Realme, Oppo and Vivo phones there is one extra switch called Auto-start. The same screen links to it.",
    ],
  },
  {
    icon: MessageCircle,
    q: "Saathi did not understand what I typed",
    a: [
      "You can write in Hindi, English or a mix. If a date or time is not picked up, tap the date and time fields on the reminder screen and set them yourself — nothing is lost.",
      "Voice input works the same way. Tap the mic and say the whole thing, including the time.",
    ],
  },
  {
    icon: ShieldCheck,
    q: "Where are my documents stored?",
    a: [
      "In your own account, in encrypted storage. They are not sold, not used for advertising, and not kept on any third-party AI provider's servers.",
      "You can delete any document from the app at any time, and deleting your account removes everything.",
    ],
  },
];

export default function SupportPage() {
  // Support ke sawaal-jawab bhi FAQPage markup ke saath — search me seedhe jawab
  // dikhte hain, aur log support email likhne se pehle hi hal pa jaate hain.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HELP.map((h) => ({
      "@type": "Question",
      name: h.q,
      acceptedAnswer: { "@type": "Answer", text: h.a.join(" ") },
    })),
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }}
      />
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/15 sm:h-96 sm:w-96" />
      </div>

      <SubHeader />

      <main className="container-page py-14 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <BackHomeLink className="mb-6" />

          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Support
          </h1>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Most problems have a quick fix. Start here — and if none of this
            helps, write to us and a person will reply.
          </p>

          <div className="mt-10 space-y-6">
            {HELP.map((h) => (
              <section
                key={h.q}
                className="rounded-4xl border border-line bg-surface p-6 sm:p-8"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta">
                    <h.icon size={18} />
                  </span>
                  <h2 className="font-display text-xl font-semibold">{h.q}</h2>
                </div>
                {h.a.map((para) => (
                  <p key={para} className="mt-3 leading-relaxed text-ink-soft">
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-4xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold">Still stuck?</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">
              Tell us what happened and we will get back to you. Mentioning your
              phone model helps a lot with reminder problems.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Contact form <ArrowRight size={15} />
              </Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-5 py-3 text-sm font-semibold text-ink transition hover:border-terracotta/40"
              >
                <Mail size={15} /> {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
