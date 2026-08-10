"use client";

import { useEffect, useState } from "react";

export type CountryPrice = {
  code: string;
  currency: string;
  symbol: string;
  monthly: number;
  yearly: number;
  isIndia: boolean;
  /**
   * 'play' = Google Play Console ka apna daam (asli sach).
   * 'manual' = purana base × multiplier wala hisaab (fallback).
   * UI isse badalta kuch nahi — ye sirf debug ke liye hai.
   */
  source: "play" | "manual";
  /**
   * Bana-banaya label — "₹99", "$1.99", "99 kr".
   *
   * ⚠️ `symbol + number` khud mat jodna. Har currency apne niyam se chalti hai
   *    (symbol aage, peeche, space ke saath ya bina), aur wo jodna India-USA ke
   *    liye chal jaata hai par baaki aadhi duniya ke liye galat dikhta hai.
   *    Server `Intl` se ye label pehle hi sahi bana ke bhejta hai.
   */
  monthlyLabel: string;
  yearlyLabel: string;
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
