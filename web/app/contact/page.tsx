import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Saathi team se baat karo — sawaal, feedback ya bas hello. Hum jaldi jawab denge.",
};

export default function ContactPage() {
  return <ContactForm />;
}
