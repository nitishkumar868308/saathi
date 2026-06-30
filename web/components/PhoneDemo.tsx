"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { Heart, Mic, FileClock, Check } from "lucide-react";

type Msg = {
  role: "user" | "saathi";
  kind?: "text" | "voice" | "card" | "doc";
  text: string;
  sub?: string;
};

const script: Msg[] = [
  { role: "user", kind: "doc", text: "Car insurance ka photo 📄" },
  {
    role: "saathi",
    text: "Mil gaya 👍 Expiry 12 March hai. 1 hafta pehle yaad dila dunga.",
  },
  { role: "user", kind: "voice", text: "Kal gym jana hai 7 baje" },
  { role: "saathi", text: "Set! Roz 7 baje reminder. 💪" },
  {
    role: "saathi",
    kind: "card",
    text: "Good morning! ☀️",
    sub: "Car insurance is hafte expire · Gym 7 baje",
  },
];

export default function PhoneDemo() {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(reduce ? script.length : 1);

  // Looping reveal of chat messages
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      setCount((c) => (c >= script.length ? 1 : c + 1));
    }, 1700);
    return () => clearInterval(id);
  }, [reduce]);

  // 3D tilt on pointer move (desktop)
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), {
    stiffness: 150,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), {
    stiffness: 150,
    damping: 18,
  });

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  const shown = script.slice(0, count);

  return (
    <div
      className="mx-auto w-full max-w-[320px] [perspective:1200px]"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <motion.div
        style={reduce ? undefined : { rotateX, rotateY }}
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={
          reduce
            ? undefined
            : { duration: 6, repeat: Infinity, ease: "easeInOut" }
        }
        className="relative rounded-[2.75rem] border border-ink/10 bg-ink p-2.5 shadow-warm [transform-style:preserve-3d]"
      >
        {/* Screen */}
        <div className="relative overflow-hidden rounded-[2.25rem] bg-cream">
          {/* status bar / header */}
          <div className="flex items-center gap-2.5 border-b border-line bg-surface px-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-terracotta text-white">
              <Heart size={16} className="fill-white" strokeWidth={2.4} />
            </span>
            <div className="leading-tight">
              <p className="font-display text-base font-semibold">Saathi</p>
              <p className="text-[11px] text-sage">online · yaad rakh raha hai</p>
            </div>
            <span className="ml-auto h-2 w-2 rounded-full bg-sage" />
          </div>

          {/* chat area (fixed height to avoid layout shift) */}
          <div className="flex h-[360px] flex-col justify-end gap-2.5 px-3.5 pb-4 pt-3">
            <AnimatePresence initial={false}>
              {shown.map((m, i) => (
                <motion.div
                  key={`${count}-${i}`}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className={
                    m.role === "user" ? "flex justify-end" : "flex justify-start"
                  }
                >
                  <Bubble msg={m} />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* input bar */}
            <div className="mt-1 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
              <span className="text-[13px] text-ink-soft">Kuch bhi bolo...</span>
              <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-terracotta text-white">
                <Mic size={15} />
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.kind === "card") {
    return (
      <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-ink px-3.5 py-3 text-cream shadow-soft">
        <p className="font-display text-sm font-semibold">{msg.text}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-cream/75">
          <FileClock size={13} className="text-amber-warm" />
          {msg.sub}
        </p>
      </div>
    );
  }

  const isUser = msg.role === "user";
  return (
    <div
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug shadow-soft ${
        isUser
          ? "rounded-br-md bg-terracotta text-white"
          : "rounded-bl-md bg-surface text-ink"
      }`}
    >
      {msg.kind === "voice" && (
        <span className="mb-1 flex items-center gap-1.5 text-[11px] opacity-80">
          <Mic size={12} /> Voice
        </span>
      )}
      {msg.kind === "doc" && (
        <span className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 text-[11px]">
          <Check size={12} /> insurance.jpg
        </span>
      )}
      {msg.text}
    </div>
  );
}
