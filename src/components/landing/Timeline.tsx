"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { Aurora, GridBg } from "@/components/fx/Ambient";
import { Label } from "@/components/fx/Reveal";

type Ev = { day: number; title: string; detail: string; src: string; up: boolean; left?: boolean };

const events: Ev[] = [
  { day: 108, title: "Champion’s last login", detail: "Ananya (Ops Lead) stops logging in. Two weeks later her email bounces.", src: "auth · email", up: true },
  { day: 96, title: "Usage −42%", detail: "Weekly active agents fall from 71 to 41 over six weeks. No complaint filed.", src: "product events", up: false, left: true },
  { day: 71, title: "“Exports failing again.”", detail: "“…honestly we’re looking at Freshdesk.” Ticket #3318, P1, open 19 days.", src: "support", up: true },
  { day: 55, title: "Card declined ×2", detail: "Auto-pay fails on the Q3 invoice. Retried twice, then silence.", src: "billing", up: false },
  { day: 30, title: "Notice window closes", detail: "Clause 9.2: 30 days’ written notice. Nobody had it on a calendar.", src: "contract.pdf p.4", up: true },
];

function pos(day: number) {
  return `${((120 - day) / 120) * 100}%`;
}

function DayCounter({ p }: { p: MotionValue<number> }) {
  const day = useTransform(p, [0.22, 0.98], [120, 0], { clamp: true });
  const text = useTransform(day, (d) => `T−${String(Math.round(d)).padStart(3, "0")}`);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

export function Timeline() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["0vw", "-250vw"]);
  const fill = useTransform(scrollYProgress, [0.22, 0.98], [0, 1], { clamp: true });

  return (
    <section ref={ref} className="relative h-[480vh] bg-ink">
      <div className="sticky top-0 h-screen overflow-hidden">
        <Aurora tone="signal" intensity={0.9} />
        <GridBg size={80} />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex max-w-[1600px] justify-between px-5 pt-24 md:px-10">
          <Label n="03">The 90 days nobody watches</Label>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ash">
            Days to renewal <span className="ml-2 text-bone"><DayCounter p={scrollYProgress} /></span>
          </div>
        </div>

        <motion.div style={{ x }} className="flex h-full w-[350vw] items-stretch">
          {/* Intro panel */}
          <div className="flex w-[90vw] shrink-0 flex-col justify-center px-5 md:px-10">
            <p className="max-w-[16ch] text-[clamp(2.6rem,6.6vw,7.5rem)] font-medium leading-[0.92] tracking-[-0.05em]">
              Customers don’t churn on renewal day.
            </p>
            <p className="mt-6 text-[clamp(2.6rem,6.6vw,7.5rem)] leading-[0.92] tracking-[-0.03em]">
              <span className="serif-i text-signal">They decide 90 days before.</span>
            </p>
            <p className="mt-10 max-w-md text-[15px] leading-relaxed text-ash">
              The signals are there — scattered across five tools no one reads together. Keep scrolling. This is one real
              pattern, compressed.
            </p>
          </div>

          {/* Ruler */}
          <div className="relative w-[260vw] shrink-0">
            <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
            <motion.div style={{ scaleX: fill }} className="absolute inset-x-0 top-1/2 h-px origin-left bg-signal" />

            {Array.from({ length: 13 }).map((_, i) => {
              const d = 120 - i * 10;
              return (
                <div key={d} className="absolute top-1/2" style={{ left: pos(d) }}>
                  <div className="h-3 w-px -translate-y-1/2 bg-ash/60" />
                  <div className="mt-3 -translate-x-1/2 font-mono text-[10px] tracking-[0.14em] text-ash">T−{d}</div>
                </div>
              );
            })}

            {/* The moment they decided */}
            <div className="absolute inset-y-[14%] w-px bg-signal" style={{ left: pos(90) }}>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ amount: 0.5 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-6 top-0 w-[30vw] min-w-[300px]"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">T−90 · inferred</div>
                <div className="serif-i mt-2 text-[clamp(2rem,3.6vw,3.8rem)] leading-[0.95] text-signal">
                  This is when they decided to leave.
                </div>
              </motion.div>
            </div>

            {events.map((e) => (
              <div key={e.day} className="absolute top-1/2" style={{ left: pos(e.day) }}>
                <span className="absolute -left-[5px] -top-[5px] h-[11px] w-[11px] rotate-45 border border-signal bg-ink" />
                <motion.div
                  initial={{ opacity: 0, y: e.up ? 24 : -24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ amount: 0.6 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  className={`absolute w-[300px] border-line ${e.left ? "right-0 border-r pr-4 text-right" : "left-0 border-l pl-4"} ${e.up ? "bottom-10" : "top-16"}`}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">
                    T−{e.day} · {e.src}
                  </div>
                  <div className="mt-2 text-2xl font-medium tracking-[-0.03em]">{e.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-ash">{e.detail}</p>
                </motion.div>
              </div>
            ))}

            {/* T-0 */}
            <div className="absolute inset-y-[18%] right-[4vw] flex flex-col justify-end text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">T−000 · renewal date</div>
              <div className="mt-2 text-[clamp(2.4rem,5vw,5.5rem)] font-medium leading-[0.9] tracking-[-0.05em] text-ash">
                You found out
                <br />
                <span className="text-bone">here.</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
