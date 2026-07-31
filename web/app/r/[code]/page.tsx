import type { Metadata } from "next";
import InviteCard from "@/components/InviteCard";
import { getOffers } from "@/lib/offers";

export const metadata: Metadata = {
  title: "Aapko invite mila 🎁",
  robots: { index: false, follow: false },
};

/**
 * Referral share-link: apkasaathi.com/r/CODE
 * App install hone ke baad ye link app kholta hai aur code apne aap bhar jaata hai.
 * Yahan bas invite dikhate hain + Play Store bhejte hain.
 *
 * Dikhne wala saara text `InviteCard` me hai — wo client component hai taaki
 * language switcher yahan bhi kaam kare (pehle poora page hardcoded Hinglish tha).
 */
export default async function ReferralInvite({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase().slice(0, 10);
  const offers = await getOffers();
  return <InviteCard code={code} days={offers.referralDays} />;
}
