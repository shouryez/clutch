"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { inr } from "@/lib/format";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.08em] font-semibold tracking-[-0.06em] ${className ?? ""}`}>
      clutch
      <span className="inline-block h-[0.22em] w-[0.22em] translate-y-[-0.02em] rounded-full bg-signal" />
    </span>
  );
}

function Ticker() {
  const [v, setV] = useState(8420000);
  useEffect(() => {
    const id = setInterval(() => setV((x) => x + Math.round(4000 + Math.random() * 26000)), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="tabular-nums">
      ARR saved today <span className="text-volt">{inr(v)}</span>
    </span>
  );
}

export function Nav() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > prev && y > 240);
  });

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 mix-blend-difference"
      animate={{ y: hidden ? "-110%" : "0%" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-5 md:px-10">
        <a href="#top" className="text-2xl text-bone">
          <Wordmark />
        </a>
        <div className="hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone md:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-signal opacity-70" />
            <span className="relative h-2 w-2 rounded-full bg-signal" />
          </span>
          Live <span className="opacity-40">/</span> <Ticker />
        </div>
        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.16em] text-bone">
          <a href="#product" className="hidden opacity-70 transition-opacity hover:opacity-100 lg:block">Product</a>
          <a href="#how" className="hidden opacity-70 transition-opacity hover:opacity-100 sm:block">How</a>
          <a href="#call" className="hidden opacity-70 transition-opacity hover:opacity-100 sm:block">The call</a>
          <a href="#pricing" className="hidden opacity-70 transition-opacity hover:opacity-100 lg:block">Pricing</a>
          <a href="/app" className="rounded-full border border-bone px-3.5 py-1.5 transition hover:bg-bone hover:text-ink">Open app →</a>
        </nav>
      </div>
    </motion.header>
  );
}
