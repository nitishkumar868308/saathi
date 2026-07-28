import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-server";
import ContactForm from "@/components/ContactForm";


export function generateMetadata(): Promise<Metadata> {
  // Meta DB (`seo_pages`) se aata hai — admin panel se badla ja sakta hai.
  // Row na ho to yahi defaults chalte hain.
  return pageMetadata("/contact", {
    title: "Contact",
    description:
      "Questions, feedback or just hello — reach the Saathi team and we will reply quickly.",
  });
}

export default function ContactPage() {
  return <ContactForm />;
}
