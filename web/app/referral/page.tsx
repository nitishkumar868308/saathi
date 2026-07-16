import type { Metadata } from "next";
import ReferralClient from "@/components/ReferralClient";

export const metadata: Metadata = {
  title: "Refer & Earn",
  description:
    "Apna referral link share karo — dost join kare aur Saathi use kare to dono ko Saathi Plus plan free.",
  robots: { index: false, follow: false },
};

export default function ReferralPage() {
  return <ReferralClient />;
}
