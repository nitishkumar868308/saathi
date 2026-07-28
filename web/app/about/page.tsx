import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-server";
import AboutContent from "@/components/AboutContent";


export function generateMetadata(): Promise<Metadata> {
  // Meta DB (`seo_pages`) se aata hai — admin panel se badla ja sakta hai.
  // Row na ho to yahi defaults chalte hain.
  return pageMetadata("/about", {
    title: "About",
    description:
      "Why we built Saathi — a reminder app that takes the burden of remembering off you. Our story and what we care about.",
  });
}

export default function AboutPage() {
  return <AboutContent />;
}
