"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Live-ish social proof pill: "500+ log jud chuke hain".
 * Reads the real count from /api/waitlist and shows a rounded "N+".
 */
export default function WaitlistCount({
  dark = false,
}: {
  dark?: boolean;
}) {
  const { waitlist: tw } = useT();
  const [count, setCount] = useState<number>(500);

  useEffect(() => {
    let alive = true;
    fetch("/api/waitlist")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.count === "number") setCount(d.count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const rounded = Math.floor(count / 50) * 50;

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 ${
        dark
          ? "border-white/15 bg-white/10 text-cream"
          : "border-line bg-surface text-ink"
      }`}
    >
      <span className="flex -space-x-2" aria-hidden>
        {["#C25A37", "#E0A458", "#7C8A6B", "#A8492B"].map((c, i) => (
          <span
            key={i}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface text-[10px] font-bold text-white"
            style={{ backgroundColor: c }}
          >
            <Users size={11} />
          </span>
        ))}
      </span>
      <span className="text-sm font-semibold">
        {rounded.toLocaleString("en-IN")}+
        <span className={dark ? "text-cream/70" : "text-ink-soft"}>
          {" "}
          {tw.countSuffix}
        </span>
      </span>
    </div>
  );
}
