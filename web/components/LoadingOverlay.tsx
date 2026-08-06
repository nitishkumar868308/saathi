"use client";

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import Loader from "@/components/Loader";

/**
 * Full-screen loader — screen ke theek beech mein, peeche blur wala overlay
 * taaki kaam poora hone tak user peeche ka form chhu na sake.
 *
 * Portal se document.body pe render hota hai — taaki transformed ancestors
 * (framer-motion / animate-fade-up) fixed positioning ko clip na karein.
 *
 * ⚠️ Loader par koi dikhne wala text nahi — na "Sending…" jaisi line, na brand
 * ka naam. `label` sirf screen readers ke liye hai (`aria-label`). App ka loader
 * bhi aisa hi hai: loader ka kaam sirf ye batana hai ki kuch chal raha hai.
 *
 * Andar ka mark `<Loader>` hi hai — app, web aur admin, teeno jagah bilkul ek
 * jaisa. Pehle yahan alag rings + bouncing dots the; do alag-alag loader dikhna
 * band ho gaya. Responsive size Loader khud clamp() se sambhaal leta hai.
 */
export default function LoadingOverlay({ label }: { label?: string }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-cream/70 p-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <Loader size={78} />
    </motion.div>,
    document.body,
  );
}
