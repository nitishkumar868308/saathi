import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
import BackHomeLink from "@/components/BackHomeLink";

export default function LegalPage({
  title,
  sections,
  /** "Aakhri update" — ye bhi bhasha ke saath badalta hai. */
  lastUpdatedLabel = "Aakhri update",
}: {
  title: string;
  sections: { h: string; p: string }[];
  lastUpdatedLabel?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-cream">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/15 sm:h-96 sm:w-96" />
      </div>

      <SubHeader />

      <main className="container-page py-14 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <BackHomeLink className="mb-6" />
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            {lastUpdatedLabel}:{" "}
            {new Date().toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
            })}
          </p>

          <div className="mt-10 space-y-8">
            {sections.map((s) => (
              <section key={s.h}>
                <h2 className="font-display text-xl font-semibold">{s.h}</h2>
                <p className="mt-2 leading-relaxed text-ink-soft">{s.p}</p>
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
