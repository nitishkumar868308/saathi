import type { Metadata } from "next";
import { redirect } from "next/navigation";
// import { Suspense } from "react";
// import CheckoutClient from "@/components/CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

// NOTE: Web checkout abhi OFF hai — payment app ke andar (Google Play Billing) hota hai.
// CheckoutClient code delete nahi kiya, baad me kaam aa sakta hai.
export default function CheckoutPage() {
  redirect("/");

  // return (
  //   <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream" />}>
  //     <CheckoutClient />
  //   </Suspense>
  // );
}
