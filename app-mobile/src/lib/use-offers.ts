import { useEffect, useState } from "react";
import { getOffers, DEFAULT_OFFERS, type Offers } from "./plan";

/**
 * Live offer numbers. Pehle defaults dikhte hain (koi blank/flash nahi),
 * phir asli values aa jaati hain. Fail ho to defaults hi rehte hain.
 */
export function useOffers(): Offers {
  const [offers, setOffers] = useState<Offers>(DEFAULT_OFFERS);

  useEffect(() => {
    let alive = true;
    getOffers()
      .then((o) => {
        if (alive) setOffers(o);
      })
      .catch(() => {
        /* defaults */
      });
    return () => {
      alive = false;
    };
  }, []);

  return offers;
}
