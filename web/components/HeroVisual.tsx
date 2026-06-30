"use client";

import PhoneDemo from "./PhoneDemo";
import { FileClock, Check, Bell } from "lucide-react";

export default function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md py-4 sm:py-8">
      {/* warm glow behind the phone */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-10 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(224,164,88,0.40), rgba(194,90,55,0.20) 45%, transparent 70%)",
        }}
      />

      {/* floating: expiry alert (top-left) */}
      <div
        className="absolute left-0 top-8 z-20 hidden animate-float sm:block"
        style={{ animationDelay: "-1s" }}
      >
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-warm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
            <FileClock size={17} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink">Car Insurance</p>
            <p className="text-[11px] font-semibold text-terracotta">
              3 din mein expire
            </p>
          </div>
          <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-terracotta" />
        </div>
      </div>

      {/* floating: reminder done (bottom-right) */}
      <div
        className="absolute bottom-12 right-0 z-20 hidden animate-float sm:block"
        style={{ animationDelay: "-3s" }}
      >
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-warm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage/15 text-sage">
            <Check size={17} strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink">Gym · 7:00 AM</p>
            <p className="text-[11px] font-semibold text-sage">Reminder set</p>
          </div>
        </div>
      </div>

      {/* floating: daily brief chip (top-right) */}
      <div
        className="absolute right-2 top-0 z-20 hidden animate-float md:block"
        style={{ animationDelay: "-2s" }}
      >
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 shadow-soft">
          <Bell size={14} className="text-amber-warm" />
          <span className="text-xs font-semibold text-ink">
            Morning brief bheja
          </span>
        </div>
      </div>

      <PhoneDemo />
    </div>
  );
}
