"use client";

import { useEffect, useState } from "react";

export type CountryPrice = {
  code: string;
  currency: string;
  symbol: string;
  monthly: number;
  yearly: number;
  isIndia: boolean;
};

/**
 * User ke IP-country ka local price (/api/pricing se). Null jab tak load na ho —
 * caller ₹ base fallback dikhata hai.
 */
export function useCountryPrice(): CountryPrice | null {
  const [price, setPrice] = useState<CountryPrice | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/pricing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setPrice(d as CountryPrice);
      })
      .catch(() => {
        /* ₹ fallback */
      });
    return () => {
      alive = false;
    };
  }, []);
  return price;
}
