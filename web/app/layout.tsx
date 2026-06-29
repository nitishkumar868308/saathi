import type { Metadata } from "next";
import { Fraunces, Mulish } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const mulish = Mulish({
  subsets: ["latin"],
  variable: "--font-mulish",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Saathi — Aapka personal saathi jo kuch nahi bhoolta",
  description:
    "Ek AI saathi jo aapke zaroori documents aur dates kabhi bhoolne nahi deta — aur ek dost ki tarah bina pooche aapki life ka khayal rakhta hai.",
  openGraph: {
    title: "Saathi — Aapka personal saathi",
    description:
      "Documents ki expiry, daily brief, aur reminders — sab ek dost ki tarah sambhalta hai.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${mulish.variable}`}>
      <body>{children}</body>
    </html>
  );
}
