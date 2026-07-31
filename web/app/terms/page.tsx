import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-server";
import LegalContent from "@/components/LegalContent";

export function generateMetadata(): Promise<Metadata> {
  // Meta DB (`seo_pages`) se aata hai — admin panel se badla ja sakta hai.
  // Row na ho to yahi defaults chalte hain.
  return pageMetadata("/terms", {
    title: "Terms & Conditions",
    description:
      "The terms that apply when you use Apka Saathi — plain and short.",
  });
}

/** Text `dictionaries.ts` > `legal.terms` me hai — teeno bhasha me. */
export default function TermsPage() {
  return <LegalContent kind="terms" />;
}
