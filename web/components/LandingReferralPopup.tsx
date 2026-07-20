"use client";

import { useEffect, useState } from "react";
import { useOffers } from "@/lib/useOffers";
import ReferralModal from "@/components/ReferralModal";

/**
 * Home page khulte hi referral landing modal — page ke TOP-LEVEL pe (neeche wale
 * ReferralSection ke andar nahi), taaki hero ke upar khule aur band karne pe
 * user top pe rehe. Design wahi shared ReferralModal ka hai jo CTA click pe bhi
 * khulta hai — dono same.
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
