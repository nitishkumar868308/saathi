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
} from "lucide-react";
import WaitlistForm from "@/components/WaitlistForm";

const features = [
  {
    icon: FileClock,
    title: "Document Expiry Guardian",
    body: "Passport, license, insurance, FASTag, warranty — photo daalo. Saathi expiry yaad rakhta hai aur time se pehle yaad dilata hai.",
    accent: "bg-terracotta/10 text-terracotta",
  },
  {
    icon: Sunrise,
    title: "Daily Brief",
    body: "Har subah ek pyaara message — aaj kya hai, is hafte kya expire ho raha hai, kaunsa kaam pending hai.",
    accent: "bg-amber-warm/15 text-amber-warm",
  },
  {
    icon: Mic,
    title: "Bol ya likh ke baat",
    body: "Dost jaise baat karo — type karo ya mic dabake bolo. “Kal 8 baje uthana” — bas, ho gaya.",
    accent: "bg-sage/15 text-sage",
  },
  {
    icon: Heart,
    title: "Aapko yaad rakhta hai",
    body: "Jo aap ek baar batate ho, woh yaad rakhta hai. Har baar dohrana nahi padta — sach mein ek saathi.",
    accent: "bg-terracotta/10 text-terracotta",
  },
  {
    icon: ShieldCheck,
    title: "Pura private",
    body: "Aapke documents aapke paas — local aur encrypted. Aap chaho toh sab kuch ek tap mein delete.",
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
    body: "Sahi time pe notification — 1 mahina, 1 hafta pehle, aur expire hone pe. Bina aapke pooche.",
  },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      {/* Soft background blobs */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-96 w-96 bg-amber-warm/25" />
        <div className="blob right-[-10rem] top-40 h-[28rem] w-[28rem] bg-terracotta/15" />
        <div className="blob bottom-0 left-1/3 h-80 w-80 bg-sage/15" />
      </div>

      {/* Nav */}
      <header className="container-page flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta text-white shadow-warm">
            <Heart size={20} strokeWidth={2.4} className="fill-white" />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">
            Saathi
          </span>
        </div>
        <a
          href="#waitlist"
          className="hidden rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink shadow-soft transition hover:border-terracotta hover:text-terracotta sm:inline-block"
        >
          Early access
        </a>
      </header>

      {/* Hero */}
      <section className="container-page grid items-center gap-12 pb-16 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-12">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
            Aapka AI saathi · India ke liye
          </span>

          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.25rem]">
            Aapka saathi,
            <br />
            jo kuch nahi
            <span className="relative ml-3 inline-block text-terracotta">
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

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            Documents ki expiry, roz ke kaam, zaroori dates — Saathi sab yaad
            rakhta hai aur ek dost ki tarah{" "}
            <span className="font-semibold text-ink">bina pooche</span> khayal
            rakhta hai. Bas baat karo, ya bol do.
          </p>

          <div className="mt-8 max-w-xl" id="waitlist">
            <WaitlistForm id="hero" />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sage" />
              Jald aa raha hai · Android
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={16} className="text-sage" />
              100% private
            </span>
          </div>
        </div>

        {/* Hero visual: daily brief card */}
        <div className="animate-fade-up [animation-delay:120ms]">
          <div className="relative mx-auto max-w-sm">
            <div className="animate-float rounded-4xl border border-line bg-surface p-6 shadow-soft sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-terracotta text-white">
                  <Heart size={18} className="fill-white" strokeWidth={2.4} />
                </span>
                <div>
                  <p className="font-display text-lg font-semibold leading-none">
                    Saathi
                  </p>
                  <p className="text-xs text-ink-soft">Good morning ☀️</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-cream-deep/60 p-4">
                  <p className="text-sm leading-relaxed text-ink">
                    Aaj 2 kaam hain. Aur ek zaroori baat —{" "}
                    <span className="font-semibold text-terracotta">
                      car insurance is hafte expire ho raha hai
                    </span>{" "}
                    (12 ko). Renew kara doon?
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-warm/15 text-amber-warm">
                    <FileClock size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      Car Insurance
                    </p>
                    <p className="text-xs text-ink-soft">3 din mein expire</p>
                  </div>
                  <span className="ml-auto rounded-full bg-terracotta/10 px-2.5 py-1 text-xs font-semibold text-terracotta">
                    Soon
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage/15 text-sage">
                    <Bell size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      Gym · 7:00 AM
                    </p>
                    <p className="text-xs text-ink-soft">Roz wala reminder</p>
                  </div>
                  <span className="ml-auto rounded-full bg-sage/15 px-2.5 py-1 text-xs font-semibold text-sage">
                    On
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-2xl bg-cream-deep/60 px-4 py-3 text-sm text-ink-soft">
                <Mic size={16} className="text-terracotta" />
                <span>&ldquo;Kal mummy ko call karna yaad dilana&rdquo;</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intro strip */}
      <section className="container-page py-8">
        <p className="mx-auto max-w-3xl text-center font-display text-2xl font-medium leading-snug text-ink sm:text-3xl">
          ChatGPT aapke poochne ka wait karta hai.{" "}
          <span className="text-terracotta">Saathi khud aage aata hai.</span>
        </p>
      </section>

      {/* Features */}
      <section className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Ek dost jo sach mein khayal rakhe
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Yaad rakhne ki tension khatam. Saathi sambhal leta hai.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-4xl border border-line bg-surface p-7 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-warm"
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${f.accent}`}
              >
                <f.icon size={24} strokeWidth={2} />
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold">
                {f.title}
              </h3>
              <p className="mt-2.5 leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}

          {/* Closing CTA tile */}
          <div className="flex flex-col justify-center rounded-4xl bg-ink p-7 text-cream shadow-soft">
            <h3 className="font-display text-2xl font-semibold leading-snug">
              Aur dheere-dheere,
              <br />
              poori life ka saathi.
            </h3>
            <p className="mt-3 leading-relaxed text-cream/70">
              Gym, goals, aur bahut kuch — sab isi mein add hota jayega.
            </p>
            <a
              href="#join"
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark"
            >
              Mujhe chahiye
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-cream-deep/40 py-20 sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Kaise kaam karta hai
            </h2>
            <p className="mt-4 text-lg text-ink-soft">
              Teen aasan kadam. Form bharne ki zaroorat nahi.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-line bg-surface text-terracotta shadow-soft">
                  <s.icon size={26} strokeWidth={2} />
                </div>
                <span className="mt-5 inline-block font-display text-sm font-bold uppercase tracking-widest text-ink-soft">
                  Step {i + 1}
                </span>
                <h3 className="mt-1 font-display text-2xl font-semibold">
                  {s.title}
                </h3>
                <p className="mx-auto mt-2.5 max-w-xs leading-relaxed text-ink-soft">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* India-first */}
      <section className="container-page py-20 sm:py-28">
        <div className="overflow-hidden rounded-[2.5rem] border border-line bg-surface shadow-soft">
          <div className="grid items-center gap-10 p-9 sm:p-12 lg:grid-cols-2 lg:p-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-4 py-1.5 text-sm font-semibold text-terracotta">
                <MapPin size={15} />
                India ke liye bana
              </span>
              <h2 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Aapki bhasha, aapke documents.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-soft">
                FASTag, RC, insurance, driving license, gas connection, warranty
                — wahi cheezein jo India mein matter karti hain. Hindi mein bhi
                baat karo. Bilkul apne dost jaisa.
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
      </section>

      {/* Final CTA */}
      <section id="join" className="container-page pb-24">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-ink px-6 py-16 text-center text-cream sm:px-12 sm:py-20">
          <div aria-hidden className="absolute inset-0 -z-0">
            <div className="blob -right-20 -top-20 h-72 w-72 bg-terracotta/30" />
            <div className="blob -bottom-24 -left-10 h-72 w-72 bg-amber-warm/20" />
          </div>
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Sabse pehle Saathi try karo
            </h2>
            <p className="mt-4 text-lg text-cream/75">
              Early access list mein jud jao. Launch hote hi aapko batayenge —
              koi spam nahi, bas khabar.
            </p>
            <div className="mx-auto mt-8 max-w-lg text-left">
              <WaitlistForm id="footer" />
            </div>
          </div>
        </div>
      </section>

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
    </main>
  );
}
