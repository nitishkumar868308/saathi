import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Mulish } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { ToastProvider } from "@/components/Toast";
import Analytics from "@/components/Analytics";
import PageTracker from "@/components/PageTracker";
import ThemeFab from "@/components/ThemeFab";
import { pageMetadata, SITE_URL, SITE_NAME } from "@/lib/seo-server";
import { THEME_SCRIPT } from "@/lib/theme";

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

/**
 * Home ka meta ab DB (`seo_pages`) se aata hai — admin panel se badla ja sakta
 * hai, deploy ki zaroorat nahi. Yahan diye gaye defaults tab chalte hain jab row
 * na ho ya DB na chale (site kabhi khaali <title> ke saath live na jaaye).
 *
 * Default likhne ka tareeka:
 *  - Title 60 characters ke andar, sabse kaam ka keyword pehle, brand aakhir me.
 *  - Description ~155 characters, usme wahi shabd jo log sach me search karte hain.
 *  - Keyword stuffing nahi: har shabd ek poore vaakya me apni jagah par.
 *
 * `template` yahin rehta hai — child pages ka title "%s · Apka Saathi" banta hai.
 */
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata(
    "/",
    {
      title: "Reminder App for Documents, Medicine & Bills — Apka Saathi",
      description:
        "Apka Saathi reminds you before your passport, Aadhaar, insurance or FASTag expires, and nudges you for medicines, bills and daily tasks. Free Android app in Hindi and English.",
      keywords: [
        "reminder app",
        "document reminder app",
        "document expiry reminder",
        "medicine reminder app",
        "bill reminder app",
        "passport expiry reminder",
        "Aadhaar reminder",
        "insurance renewal reminder",
        "FASTag recharge reminder",
        "Hindi reminder app",
        "Apka Saathi",
      ],
    },
    {
      metadataBase: new URL(SITE_URL),
      authors: [{ name: SITE_NAME }],
      creator: SITE_NAME,
      publisher: SITE_NAME,
      applicationName: SITE_NAME,
      // Google Search Console ka HTML-tag verification. Env set karte hi tag lag
      // jaata hai — code me kabhi paste karne ki zaroorat nahi.
      verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
      category: "productivity",
    },
    // Child pages ka title isi saanche me: "About · Apka Saathi".
    `%s · ${SITE_NAME}`,
  );
}

export const viewport: Viewport = {
  // Browser/phone ki apni patti ka rang. Ek hi rang dene par dark theme me
  // upar ki patti safed reh jaati hai aur poore page se alag chipakti hai.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F2E9" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1714" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Structured data (JSON-LD) — Google ko saaf-saaf batata hai ki company kaun hai
 * aur app kya karta hai. Teen alag @type ek graph me:
 *
 *   Organization      — company/brand ki pehchaan (logo, sampark, social)
 *   WebSite           — site ka naam, taaki sitelinks aur brand box ban sake
 *   SoftwareApplication — app ka category, platform aur price
 *
 * ⚠️ `aggregateRating` jaan-boojh ke hata diya gaya hai. Google ka policy hai ki
 * rating asli aur site par dikhti honi chahiye; banaya hua rating markup manual
 * action la sakta hai. Play Store par asli reviews aane ke baad wahi number
 * yahan daalna.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
      email: "info@apkasaathi.com",
      description:
        "Apka Saathi builds a friendly reminder app that remembers document expiries, medicines and bills for you.",
      areaServed: "IN",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: ["en-IN", "hi-IN"],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Android",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      description:
        "Reminder app that tracks document expiry dates — passport, Aadhaar, insurance, FASTag — and reminds you about medicines, bills and daily tasks.",
      featureList: [
        "Document expiry reminders",
        "Medicine reminders",
        "Bill and EMI reminders",
        "Daily brief",
        "Hindi and English",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
      },
      inLanguage: ["hi", "en"],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi" className={`${fraunces.variable} ${mulish.variable}`}>
      <head>
        {/*
          ⚠️ Theme sabse pehle — React se bhi pehle.
          React ke baad lagane par dark mode wale user ko pehli render par poori
          safed screen dikhti hai aur phir wo kaali hoti hai. Wo jhatka dark mode
          ki sabse aam shikayat hai, aur uska ek hi ilaaj hai: ek chhota blocking
          inline script, <head> me.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <LanguageProvider>
          <ToastProvider>
            {children}
            {/* Har page par theme switch — bottom-right. LanguageProvider ke
                ANDAR hona zaroori hai: iska label chuni hui bhasha se aata hai. */}
            <ThemeFab />
          </ToastProvider>
        </LanguageProvider>
        <Analytics />
        {/* Apna per-user journey tracking. useSearchParams ke kaaran Suspense me. */}
        <Suspense fallback={null}>
          <PageTracker />
        </Suspense>
      </body>
    </html>
  );
}
