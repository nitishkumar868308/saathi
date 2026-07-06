import type { Metadata } from "next";
import AboutContent from "@/components/AboutContent";

export const metadata: Metadata = {
  title: "About",
  description:
    "Saathi kyun bana — ek AI companion jo yaad rakhne ka bojh apne upar leta hai. Hamari kahani, hamari values.",
};

export default function AboutPage() {
  return <AboutContent />;
}
