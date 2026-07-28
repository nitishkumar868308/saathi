"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { trackPage } from "@/lib/analytics";

/**
 * Har route change par ek `page_view` event apne Supabase me.
 *
 * Layout me ek hi baar mount hota hai, isliye nayi page banate waqt kuch yaad
 * nahi rakhna padta. GA4 se alag: ye per-user journey ke liye hai jo admin panel
 * me app ke events ke saath ek hi timeline me dikhta hai.
 *
 * `useSearchParams` client-side navigation ko static export se todta hai, isliye
 * layout me ise `<Suspense>` ke andar rakha gaya hai.
 */
export default function PageTracker() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    // Referral link (?ref=CODE) bhi saath bhejo — kaun kis link se aaya, pata rahe.
    const ref = params.get("ref") ?? params.get("utm_source");
    trackPage(pathname || "/", ref ? { ref } : undefined);
  }, [pathname, params]);

  return null;
}
