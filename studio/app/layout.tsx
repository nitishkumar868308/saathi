import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Reel Studio",
  description: "Apka Saathi ke reels banane wala local editor.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
