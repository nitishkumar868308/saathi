import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutClient from "@/components/CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream" />
      }
    >
      <CheckoutClient />
    </Suspense>
  );
}
