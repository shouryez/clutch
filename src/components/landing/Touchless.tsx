"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { Label } from "@/components/fx/Reveal";

const nodes = [
  ["T−90", "Health check", "Meridian Labs · risk 12"],
  ["+00:04", "Value recap", "“3,410 tickets auto-routed”"],
  ["+00:09", "Quote", "+7% contractual uplift"],
  ["+00:12", "Email", "to finance + champion"],
  ["+00:31", "Signed", "Documenso"],
  ["+00:37", "Billing", "Stripe subscription"],
  ["+00:38", "Logged", "CRM · #renewals"],
];

function Node({ i, p, n }: { i: number; p: MotionValue<number>; n: (typeof nodes)[number] }) {
  const at = 0.12 + (i / (nodes.length - 1)) * 0.7;
  const on = useTransform(p, [at - 0.02, at], [0, 1], { clamp: true });
  const bg = useTransform(on, [0, 1], ["#eee9df", "#0b0b0a"]);
  const y = useTransform(on, [0, 1], [16, 0]);
  return (
    <div className="relative flex flex-col items-center text-center">
      <motion.div style={{ backgroundColor: bg }} className="relative z-10 h-5 w-5 rounded-full border-2 border-ink" />
      <motion.div style={{ opacity: on, y }} className="mt-5 w-32">
        <div className="font-mono text-[10px] tracking-[0.14em] text-ink/50">{n[0]}</div>
        <div className="mt-1 text-lg font-medium leading-tight tracking-[-0.03em]">{n[1]}</div>
        <div className="mt-1 text-[13px] leading-snug text-ink/60">{n[2]}</div>
      </motion.div>
    </div>
  );
}

export function Touchless() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const draw = useTransform(scrollYProgress, [0.1, 0.84], [0, 1], { clamp: true });
  const secs = useTransform(scrollYProgress, [0.1, 0.84], [0, 38], { clamp: true });
  const clock = useTransform(secs, (s) => `00:${String(Math.floor(s)).padStart(2, "0")}`);
  const done = useTransform(scrollYProgress, [0.84, 0.9], [0, 1], { clamp: true });

  return (
    <section ref={ref} className="relative h-[300vh] bg-bone text-ink">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-5 md:px-10">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <Label n="07" className="text-ink/60">Touchless renewal</Label>
              <h2 className="mt-8 max-w-[14ch] text-[clamp(2.8rem,6.4vw,7rem)] font-medium leading-[0.9] tracking-[-0.05em]">
                Healthy accounts <span className="serif-i">renew themselves.</span>
              </h2>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">Elapsed</div>
              <motion.div className="text-[clamp(4rem,10vw,10rem)] font-medium leading-none tabular-nums tracking-[-0.06em]">{clock}</motion.div>
              <motion.div style={{ opacity: done }} className="font-mono text-[11px] uppercase tracking-[0.16em]">
                <span className="bg-ink px-2 py-1 text-volt">renewed · 0 human touches</span>
              </motion.div>
            </div>
          </div>

          <div className="relative mt-20 overflow-x-auto pb-4">
            <div className="relative min-w-[900px]">
              <div className="absolute left-[7%] right-[7%] top-[9px] h-[2px] bg-ink/15" />
              <motion.div style={{ scaleX: draw }} className="absolute left-[7%] right-[7%] top-[9px] h-[2px] origin-left bg-ink" />
              <div className="relative grid grid-cols-7">
                {nodes.map((n, i) => (
                  <Node key={n[1]} i={i} p={scrollYProgress} n={n} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
