"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const faqs = [
  {
    q: "Saathi free hai?",
    a: "Shuruaat mein free. Early access wale logon ko launch pe sabse pehle aur best deal milegi. Aage chal ke kuch premium features aa sakte hain, par core kaam free rahega.",
  },
  {
    q: "Mera data safe hai? Documents kahan jaate hain?",
    a: "Aapke documents aapke apne private storage mein, encrypted. Hum unhe kisi AI ke memory server pe save nahi karte. Aap chaho toh ek tap mein sab kuch delete kar sakte ho.",
  },
  {
    q: "Kya ye ChatGPT se alag hai?",
    a: "Haan. ChatGPT aapke poochne ka wait karta hai. Saathi khud aage aata hai — bina pooche expiry, dates aur kaam yaad dilata hai. Aur ye India ke documents (FASTag, RC, insurance) ke liye bana hai.",
  },
  {
    q: "Hindi mein baat kar sakte hain?",
    a: "Bilkul. Hindi, English ya Hinglish — jaise aap bolte ho waise baat karo. Type karo ya mic dabake bol do.",
  },
  {
    q: "Kab launch ho raha hai? Android ya iPhone?",
    a: "Pehle Android pe early access aayega, phir iPhone. Waitlist mein judo — launch hote hi aapko sabse pehle khabar denge.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-line overflow-hidden rounded-4xl border border-line bg-surface">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-cream-deep/30 sm:px-8"
            >
              <span className="font-display text-lg font-semibold text-ink">
                {f.q}
              </span>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-terracotta transition-transform duration-300 ${
                  isOpen ? "rotate-45 bg-terracotta/10" : ""
                }`}
              >
                <Plus size={18} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 leading-relaxed text-ink-soft sm:px-8">
                    {f.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
