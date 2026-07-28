import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-server";
import ReferralClient from "@/components/ReferralClient";

export function generateMetadata(): Promise<Metadata> {
  // Har user ka apna referral link hota hai, isliye default noindex.
  // Admin chahe to `seo_pages` se ye bhi badal sakta hai.
  return pageMetadata("/referral", {
    title: "Refer & Earn",
    description:
      "Share your referral link — when a friend joins and uses Saathi, you both get Saathi Plus free.",
    noindex: true,
  });
}

export default function ReferralPage() {
  return <ReferralClient />;
}
