import type { Metadata, Viewport } from "next";
import { Fraunces, Mulish } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { ToastProvider } from "@/components/Toast";
import Analytics from "@/components/Analytics";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  preload: true,
});

const mulish = Mulish({
  subsets: ["latin"],
  variable: "--font-mulish",
  display: "swap",
  preload: true,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.apkasaathi.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Apka Saathi — jo kuch nahi bhoolta",
    template: "%s · Apka Saathi",
  },
  description:
    "Apka Saathi ek AI companion hai jo aapke documents ki expiry, zaroori dates aur roz ke kaam bina pooche yaad dilata hai. Passport, insurance, FASTag, EMI — sab yaad. Hindi + English. Play Store se free download karo.",
  keywords: [
    "Apka Saathi",
    "AI reminder app",
    "document expiry reminder",
    "India reminder app",
    "Hindi AI assistant",
    "FASTag reminder",
    "insurance expiry reminder",
    "personal AI companion",
  ],
  authors: [{ name: "Apka Saathi" }],
  creator: "Apka Saathi",
  applicationName: "Apka Saathi",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Apka Saathi — jo kuch nahi bhoolta",
    description:
      "Documents ki expiry, daily brief, aur reminders — sab ek dost ki tarah bina pooche sambhalta hai. Never forget what matters.",
    url: SITE_URL,
    siteName: "Apka Saathi",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Apka Saathi — jo kuch nahi bhoolta",
    description:
      "AI saathi jo aapke documents, dates aur kaam bina pooche yaad dilata hai.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "productivity",
};

export const viewport: Viewport = {
  themeColor: "#F7F2E9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Apka Saathi",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Android",
  description:
    "AI companion that reminds you about document expiries, important dates and daily tasks — without being asked.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "500",
  },
  inLanguage: ["hi", "en"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi" className={`${fraunces.variable} ${mulish.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <LanguageProvider>
          <ToastProvider>{children}</ToastProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
