"use client";

import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import SaathiLogo from "@/components/SaathiLogo";

/**
 * Pyaara full-screen loader — screen ke beech mein, backdrop blur ke saath.
 * Submit hone tak dikhta hai taki user ko clearly pata chale.
 *
 * Portal se document.body pe render hota hai — taaki transformed ancestors
 * (framer-motion / animate-fade-up) fixed positioning ko clip na karein.
 */
export default function LoadingOverlay({ label }: { label?: string }) {
  const reduce = useReducedMotion();

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-cream/70 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <div className="flex flex-col items-center gap-5">
        {/* Pulsing heart in a soft glow */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* expanding rings */}
          {!reduce &&
            [0, 0.6].map((delay) => (
              <motion.span
                key={delay}
                className="absolute rounded-full bg-terracotta/30"
                style={{ height: 56, width: 56 }}
                initial={{ scale: 0.6, opacity: 0.5 }}
                animate={{ scale: 1.9, opacity: 0 }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay,
                }}
              />
            ))}
          <motion.span
            className="relative flex h-16 w-16 items-center justify-center rounded-3xl shadow-warm"
            animate={
              reduce ? undefined : { scale: [1, 1.12, 1] }
            }
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          >
            <SaathiLogo size={64} className="rounded-3xl" />
          </motion.span>
        </div>

        {/* bouncing dots */}
        <span className="flex items-center gap-1.5">
          {["#C25A37", "#E0A458", "#7C8A6B"].map((c, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full animate-loader-bounce"
              style={{ backgroundColor: c, animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </span>

        {label && (
          <p className="font-display text-base font-semibold text-ink">
            {label}
          </p>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
