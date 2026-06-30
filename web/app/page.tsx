import {
  FileClock,
  Sunrise,
  Mic,
  Sparkles,
  ShieldCheck,
  Bell,
  ScanLine,
  Heart,
  MapPin,
  Lock,
  MessageCircleHeart,
  Sun,
  Clock,
} from "lucide-react";
import WaitlistForm from "@/components/WaitlistForm";
import PhoneDemo from "@/components/PhoneDemo";
import Marquee from "@/components/Marquee";
import Faq from "@/components/Faq";
import Reveal from "@/components/Reveal";

const features = [
  {
    icon: FileClock,
    title: "Document Expiry Guardian",
    body: "Passport, license, car insurance, FASTag, warranty — ek photo daalo. Saathi expiry yaad rakhta hai aur 1 mahina, 1 hafta pehle, aur expire hone pe khud yaad dilata hai.",
    accent: "bg-terracotta/10 text-terracotta",
  },
  {
    icon: Sunrise,
    title: "Morning Daily Brief",
    body: "Har subah ek chhota, pyaara message — aaj ke kaam, is hafte kya expire ho raha hai, aur aaj ka gym/reminder. Poora din ek nazar mein.",
    accent: "bg-amber-warm/15 text-amber-warm",
  },
  {
    icon: Mic,
    title: "Bol ya likh ke baat",
    body: "Dost jaise baat karo — type karo ya mic dabake bolo. “Kal 8 baje uthana”, “mummy ko call karna yaad dilana” — bas keh do, ho gaya.",
    accent: "bg-sage/15 text-sage",
  },
  {
    icon: MessageCircleHeart,
    title: "Aapko yaad rakhta hai",
    body: "Jo aap ek baar batate ho woh yaad rehta hai — har baar dohrana nahi padta. Sach mein ek saathi jo aapko jaanta hai.",
    accent: "bg-terracotta/10 text-terracotta",
  },
  {
    icon: Lock,
    title: "Pura private, aapke control mein",
    body: "Documents aapke apne encrypted storage mein. Kisi AI ke memory server pe kuch nahi. Aap chaho toh ek tap mein sab delete.",
    accent: "bg-sage/15 text-sage",
  },
];

const steps = [
  {
    icon: ScanLine,
    title: "Batao ya dikhao",
    body: "Document ki photo daalo, ya bas Saathi se bol do ki kya yaad rakhna hai.",
  },
  {
    icon: Sparkles,
    title: "Saathi samajh leta hai",
    body: "AI document padhke expiry aur zaroori dates apne aap nikal leta hai.",
  },
  {
    icon: Bell,
    title: "Woh khud yaad dilata hai",
    body: "Sahi time pe notification — bina aapke pooche. Aap tension-free.",
  },
];

const day = [
  {
    time: "Subah 8:00",
    icon: Sun,
    color: "bg-amber-warm/15 text-amber-warm",
    text: "“Good morning! Aaj 2 kaam hain. Car insurance is hafte (12 ko) expire ho raha hai — renew kara doon?”",
  },
  {
    time: "Dopahar 2:30",
    icon: FileClock,
    color: "bg-terracotta/10 text-terracotta",
    text: "“FASTag recharge khatam hone wala hai. Abhi karwa lo, warna kal toll pe dikkat ho sakti hai.”",
  },
  {
    time: "Raat 10:00",
    icon: Mic,
    color: "bg-sage/15 text-sage",
    text: "Aapne bola: “Kal subah 7 baje gym yaad dilana” — Saathi: “Set! 💪 Subah milte hain.”",
  },
];

const trust = [
  { icon: ShieldCheck, label: "100% private" },
  { icon: MapPin, label: "Made in India" },
  { icon: MessageCircleHeart, label: "Hindi + English" },
  { icon: Bell, label: "Android first" },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* Soft background blobs */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/25 sm:h-96 sm:w-96" />
        <div className="blob right-[-8rem] top-44 h-80 w-80 bg-terracotta/15 sm:h-[28rem] sm:w-[28rem]" />
        <div className="blob bottom-[20%] left-1/4 h-72 w-72 bg-sage/15" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/0 bg-cream/80 backdrop-blur-md">
        <div className="container-page flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-terracotta text-white shadow-warm sm:h-10 sm:w-10">
              <Heart size={18} strokeWidth={2.4} className="fill-white" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              Saathi
            </span>
          </div>
          <a
            href="#waitlist"
            className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-ink/90 sm:px-5"
          >
            Early access
          </a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container-page grid items-center gap-10 pb-12 pt-8 sm:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-24">
          <div>
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
                Aapka AI saathi · India ke liye
              </span>
            </div>

            <div className="animate-fade-up [animation-delay:80ms]">
              <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:mt-6 sm:text-6xl lg:text-[4.25rem]">
                Aapka saathi,
                <br />
                jo kuch nahi{" "}
                <span className="relative inline-block text-terracotta">
                  bhoolta.
                  <svg
                    aria-hidden
                    viewBox="0 0 200 12"
                    className="absolute -bottom-1 left-0 h-3 w-full text-amber-warm"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 8 C 50 2, 150 2, 198 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
            </div>

            <div className="animate-fade-up [animation-delay:160ms]">
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:mt-6 sm:text-xl">
                Documents ki expiry, roz ke kaam, zaroori dates — Saathi sab yaad
                rakhta hai aur ek dost ki tarah{" "}
                <span className="font-semibold text-ink">bina pooche</span>{" "}
                khayal rakhta hai. Bas baat karo, ya bol do.
              </p>
            </div>

            <div className="animate-fade-up [animation-delay:240ms]">
              <div className="mt-7 max-w-xl sm:mt-8" id="waitlist">
                <WaitlistForm id="hero" />
              </div>
            </div>

            <div className="animate-fade-up [animation-delay:320ms]">
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm text-ink-soft">
                {trust.map((t) => (
                  <span key={t.label} className="inline-flex items-center gap-2">
                    <t.icon size={15} className="text-sage" />
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Hero visual: animated phone */}
          <div className="order-first animate-fade-up [animation-delay:200ms] lg:order-none">
            <PhoneDemo />
          </div>
        </section>

        {/* Marquee */}
        <Marquee />

        {/* Insight strip */}
        <section className="container-page py-14 sm:py-20">
          <Reveal>
            <p className="mx-auto max-w-3xl text-center font-display text-2xl font-medium leading-snug text-ink sm:text-4xl">
              ChatGPT aapke poochne ka wait karta hai.{" "}
              <span className="text-terracotta">Saathi khud aage aata hai.</span>
            </p>
          </Reveal>
        </section>

        {/* Features */}
        <section className="container-page pb-16 sm:pb-24">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                Ek dost jo sach mein khayal rakhe
              </h2>
              <p className="mt-3 text-base text-ink-soft sm:mt-4 sm:text-lg">
                Yaad rakhne ki tension khatam. Saathi sambhal leta hai.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
                <div className="group h-full rounded-4xl border border-line bg-surface p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-warm sm:p-7">
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${f.accent}`}
                  >
                    <f.icon size={24} strokeWidth={2} />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold">
                    {f.title}
                  </h3>
                  <p className="mt-2.5 leading-relaxed text-ink-soft">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}

            <Reveal delay={0.3}>
              <div className="flex h-full flex-col justify-center rounded-4xl bg-ink p-7 text-cream shadow-soft">
                <h3 className="font-display text-2xl font-semibold leading-snug">
                  Aur dheere-dheere,
                  <br />
                  poori life ka saathi.
                </h3>
                <p className="mt-3 leading-relaxed text-cream/70">
                  Gym, goals, aur bahut kuch — sab isi mein add hota jayega.
                </p>
                <a
                  href="#waitlist"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark"
                >
                  Mujhe chahiye
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-cream-deep/40 py-16 sm:py-28">
          <div className="container-page">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                  Kaise kaam karta hai
                </h2>
                <p className="mt-3 text-base text-ink-soft sm:mt-4 sm:text-lg">
                  Teen aasan kadam. Form bharne ki zaroorat nahi.
                </p>
              </div>
            </Reveal>

            <div className="mt-12 grid gap-8 sm:mt-14 md:grid-cols-3 md:gap-6">
              {steps.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.1}>
                  <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-line bg-surface text-terracotta shadow-soft">
                      <s.icon size={26} strokeWidth={2} />
                    </div>
                    <span className="mt-5 inline-block font-display text-xs font-bold uppercase tracking-widest text-ink-soft">
                      Step {i + 1}
                    </span>
                    <h3 className="mt-1 font-display text-2xl font-semibold">
                      {s.title}
                    </h3>
                    <p className="mx-auto mt-2 max-w-xs leading-relaxed text-ink-soft">
                      {s.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* A day with Saathi */}
        <section className="container-page py-16 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <span className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-4 py-1.5 text-sm font-semibold text-terracotta">
                  <Clock size={15} />
                  Ek din Saathi ke saath
                </span>
                <h2 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Subah se raat tak, bina pooche.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
                  Aapko kuch yaad rakhne ki zaroorat nahi. Saathi sahi time pe,
                  sahi cheez, khud bata deta hai — jaise ek samajhdaar dost.
                </p>
              </div>
            </Reveal>

            <div className="relative space-y-4">
              <div
                aria-hidden
                className="absolute left-[26px] top-4 bottom-4 w-px bg-line sm:left-[30px]"
              />
              {day.map((d, i) => (
                <Reveal key={d.time} delay={i * 0.1}>
                  <div className="relative flex gap-4 sm:gap-5">
                    <span
                      className={`relative z-10 flex shrink-0 items-center justify-center rounded-2xl border-4 border-cream ${d.color}`}
                      style={{ height: 52, width: 52 }}
                    >
                      <d.icon size={22} />
                    </span>
                    <div className="flex-1 rounded-3xl border border-line bg-surface p-5 shadow-soft">
                      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                        {d.time}
                      </p>
                      <p className="mt-2 leading-relaxed text-ink">{d.text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* India-first */}
        <section className="container-page pb-16 sm:pb-28">
          <Reveal>
            <div className="overflow-hidden rounded-[2rem] border border-line bg-surface shadow-soft sm:rounded-[2.5rem]">
              <div className="grid items-center gap-8 p-7 sm:p-12 lg:grid-cols-2 lg:p-16">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-4 py-1.5 text-sm font-semibold text-terracotta">
                    <MapPin size={15} />
                    India ke liye bana
                  </span>
                  <h2 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                    Aapki bhasha, aapke documents.
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
                    FASTag, RC, insurance, driving license, gas connection,
                    warranty — wahi cheezein jo India mein matter karti hain.
                    Hindi mein bhi baat karo. Bilkul apne dost jaisa.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {[
                    "Passport",
                    "Driving License",
                    "Car Insurance",
                    "FASTag",
                    "RC / PUC",
                    "Warranty / AMC",
                  ].map((doc) => (
                    <div
                      key={doc}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-cream-deep/30 px-4 py-3.5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
                        <FileClock size={17} />
                      </span>
                      <span className="text-sm font-semibold">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section className="container-page pb-16 sm:pb-28">
          <Reveal>
            <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                Sawaal hain? Bilkul natural hai.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <Faq />
          </Reveal>
        </section>

        {/* Final CTA */}
        <section className="container-page pb-20 sm:pb-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center text-cream sm:rounded-[2.5rem] sm:px-12 sm:py-20">
              <div aria-hidden className="absolute inset-0 -z-0">
                <div className="blob -right-20 -top-20 h-72 w-72 bg-terracotta/30" />
                <div className="blob -bottom-24 -left-10 h-72 w-72 bg-amber-warm/20" />
              </div>
              <div className="relative mx-auto max-w-2xl">
                <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Sabse pehle Saathi try karo
                </h2>
                <p className="mt-4 text-base text-cream/75 sm:text-lg">
                  Early access list mein jud jao. Launch hote hi aapko batayenge
                  — koi spam nahi, bas khabar.
                </p>
                <div className="mx-auto mt-8 max-w-lg text-left">
                  <WaitlistForm id="footer" />
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-terracotta text-white">
              <Heart size={16} className="fill-white" strokeWidth={2.4} />
            </span>
            <span className="font-display text-lg font-semibold">Saathi</span>
          </div>
          <p className="text-sm text-ink-soft">
            Made with{" "}
            <Heart
              size={13}
              className="inline fill-terracotta text-terracotta"
            />{" "}
            in India · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
