import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-server";
import LegalContent from "@/components/LegalContent";

export function generateMetadata(): Promise<Metadata> {
  // Meta DB (`seo_pages`) se aata hai — admin panel se badla ja sakta hai.
  // Row na ho to yahi defaults chalte hain.
  return pageMetadata("/privacy", {
    title: "Privacy Policy",
    description:
      "How Apka Saathi stores your documents and reminders, what we never do with your data, and the control you keep.",
  });
}

/**
 * Policy ka text `dictionaries.ts` > `legal.privacy` me hai — teeno bhasha me.
 * Pehle wo yahin hardcoded Hinglish tha aur language switcher se badalta hi
 * nahi tha, jabki app ke andar yahi page teeno bhasha me chalta hai.
 */
export default function PrivacyPage() {
  return <LegalContent kind="privacy" />;
}
