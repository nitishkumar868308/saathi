import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Saathi ki terms of service — seedhi aur saaf shartein.",
};

const sections = [
  {
    h: "1. Saathi kya hai",
    p: "Saathi ek personal AI companion hai jo aapke documents, dates aur kaam yaad rakhta hai aur reminders bhejta hai. Ye service abhi early access mein hai.",
  },
  {
    h: "2. Aapki zimmedari",
    p: "Aap sahi jaankari denge aur service ka istemaal kanooni tarike se karenge. Aapka account aur password aapki zimmedari hai.",
  },
  {
    h: "3. Reminders",
    p: "Saathi poori koshish karta hai ki reminders sahi time par pahunchein, par technical dikkat (network, device settings) ke kaaran kabhi delay ho sakta hai. Zaroori kaam ke liye Saathi ko ek madadgar samjho, akhri bharosa nahi.",
  },
  {
    h: "4. Pricing",
    p: "Core features free rahenge. Kuch advanced features (jaise family sharing) paid ho sakte hain. Early access users ko launch par special deal milegi. Koi bhi charge pehle saaf bataya jayega.",
  },
  {
    h: "5. Data aur privacy",
    p: "Aapka data hamari Privacy Policy ke mutabik handle hota hai. Aap jab chaho apna data delete kar sakte ho.",
  },
  {
    h: "6. Badlaav",
    p: "In terms mein badlaav ho sakta hai. Bada badlaav hone par hum aapko email ya app ke through bata denge.",
  },
  {
    h: "7. Sampark",
    p: "Koi sawaal ya shikayat? hello@saathi.app par likho.",
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of Service" sections={sections} />;
}
