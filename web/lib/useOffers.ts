"use client";

import { useEffect, useState } from "react";
import { DEFAULT_OFFERS, type Offers } from "@/lib/offers";

/**
 * Client components ke liye live offers.
 * Pehle defaults dikhte hain (koi flash/blank nahi), phir asli numbers aa jaate hain.
 */
export function useOffers(): Offers {
  const [offers, setOffers] = useState<Offers>(DEFAULT_OFFERS);

  useEffect(() => {
    let alive = true;
    fetch("/api/offers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setOffers(d as Offers);
      })
      .catch(() => {
        /* defaults hi rahenge */
      });
    return () => {
      alive = false;
    };
  }, []);

  return offers;
}
