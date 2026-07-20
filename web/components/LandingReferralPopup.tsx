"use client";

import { useEffect, useState } from "react";
import { useOffers } from "@/lib/useOffers";
import ReferralModal from "@/components/ReferralModal";

/**
 * Home page khulte hi referral landing modal.
 *
 * ⚠️ Ye page ke TOP-LEVEL pe rehta hai (neeche wale ReferralSection ke andar
 * nahi). Pehle hum bottom CTA wale section ka hi modal reuse karte the — usse
 * lagta tha ki modal bottom section se juda hai aur band karne pe user page ke
 * neeche pahunch jaata tha. Ab landing modal alag hai, hero ke upar khulta hai,
 * band karne pe user top pe hi rehta hai.
 */
export default function LandingReferralPopup() {
  const offers = useOffers();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!offers.referralsEnabled) return;
    const id = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(id);
  }, [offers.referralsEnabled]);

  if (!offers.referralsEnabled) return null;
  return <ReferralModal open={open} onClose={() => setOpen(false)} />;
}
