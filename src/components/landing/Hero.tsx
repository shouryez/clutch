"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Lines } from "@/components/fx/Reveal";
import { VoiceField } from "@/components/fx/VoiceField";

const ease = [0.16, 1, 0.3, 1] as const;

function IncomingCall() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: 4 }}
      animate={{ opacity: 1, y: 0, rotate: -3 }}
      transition={{ duration: 1.4, ease, delay: 1.1 }}
      className="w-[300px] select-none rounded-[28px] border border-line bg-carbon/85 p-5 shadow-[0_40px_120px_-20px_rgba(255,90,31,0.25)] backdrop-blur-md"
      data-cursor="Answer"
    >
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ash">
        <span>Incoming · 02:14</span>
        <span className="text-signal">AI</span>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <div className="relative grid h-12 w-12 place-items-center rounded-full bg-signal text-ink">
          <span className="ring-pulse absolute inset-0 rounded-full text-signal" />
          <span className="text-lg font-semibold tracking-tighter">c.</span>
        </div>
        <div>
          <div className="text-lg leading-tight tracking-tight">Clutch</div>
          <div className="text-sm text-ash">Helpdeck renewals</div>
        </div>
      </div>
      <div className="mt-5 flex h-8 items-end gap-[3px]">
        {Array.from({ length: 34 }).map((_, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-bone/70"
            animate={{ height: ["20%", `${30 + ((i * 37) % 70)}%`, "25%"] }}
            transition={{ duration: 0.9 + (i % 5) * 0.13, repeat: Infinity, ease: "easeInOut", delay: i * 0.03 }}
          />
        ))}
      </div>
      <p className="mt-4 text-[13px] leading-snug text-bone/80">
        “Hi Rohan — exports failed 14 times this month. Your renewal’s in 45 days. Can we talk?”
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="rounded-full border border-line py-2.5 text-center text-ash">Decline</span>
        <span className="rounded-full bg-volt py-2.5 text-center text-ink">Accept</span>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const fieldScale = useTransform(scrollYProgress, [0, 1], [1, 1.25]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section id="top" ref={ref} className="relative h-[100svh] min-h-[720px] overflow-hidden">
      <motion.div style={{ scale: fieldScale, opacity: fade }} className="absolute inset-0">
        <VoiceField className="h-full w-full" />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_100%,rgba(11,11,10,0.95)_20%,transparent_60%)]" />

      <motion.div style={{ y, opacity: fade }} className="relative mx-auto flex h-full max-w-[1600px] flex-col justify-between px-5 pb-8 pt-28 md:px-10 md:pb-10">
        <div className="flex items-start justify-between">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="space-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ash"
          >
            <div><span className="text-signal">§01</span> Renewal autopilot</div>
            <div>for B2B SaaS</div>
          </motion.div>
          <div className="hidden lg:block">
            <IncomingCall />
          </div>
        </div>

        <div>
          <h1 className="text-[clamp(3.4rem,min(10.4vw,13.5vh),12.5rem)] font-medium leading-[0.86] tracking-[-0.055em]">
            <Lines
              delay={0.15}
              stagger={0.11}
              lines={[
                <>Renewals,</>,
                <>
                  won <span className="serif-i text-signal">while</span>
                </>,
                <span key="s" className="serif-i">you sleep.</span>,
              ]}
            />
          </h1>

          <div className="mt-10 grid gap-8 border-t border-line pt-6 md:grid-cols-12">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease, delay: 0.9 }}
              className="max-w-md text-[15px] leading-relaxed text-bone/75 md:col-span-5"
            >
              Clutch spots churn 90 days early, <em className="not-italic text-bone">calls the customer</em>, negotiates
              inside lines it can’t cross, gets the contract signed and updates billing. You wake up to a renewed account.
            </motion.p>
            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1.2 }}
              className="grid grid-cols-3 gap-6 font-mono text-[11px] uppercase tracking-[0.14em] md:col-span-6 md:col-start-7"
            >
              {[
                ["Watch", "signals · contracts"],
                ["Call", "voice · Hinglish"],
                ["Close", "e-sign · billing"],
              ].map(([k, v], i) => (
                <div key={k}>
                  <dt className="text-ash">0{i + 1}</dt>
                  <dd className="mt-1 text-bone">{k}</dd>
                  <dd className="text-ash normal-case tracking-normal">{v}</dd>
                </div>
              ))}
            </motion.dl>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="absolute bottom-8 right-5 hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ash md:right-10 md:flex"
      >
        Scroll
        <span className="relative block h-10 w-px overflow-hidden bg-line">
          <motion.span
            className="absolute inset-x-0 top-0 h-4 bg-signal"
            animate={{ y: ["-100%", "260%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
      </motion.div>
    </section>
  );
}
