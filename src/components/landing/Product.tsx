"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Aurora, GridBg } from "@/components/fx/Ambient";
import { Label, Lines } from "@/components/fx/Reveal";

const TABS = [
  { k: "command", label: "Command center", note: "Today's brief, the pipeline, and where every rupee renewing this quarter stands." },
  { k: "account", label: "Account", note: "Risk with its evidence, the contract clause that matters, and the play Clutch picked." },
  { k: "inbox", label: "Inbox agent", note: "Customer replies read, understood and acted on — re-quotes, contacts, documents." },
  { k: "radar", label: "Bug radar", note: "Bugs ranked by the ARR they block, filed with the money attached." },
] as const;

const CHIPS: { t: string; side: "left" | "right"; y: string; d: number }[] = [
  { t: "₹4.4 Cr at risk, found", side: "left", y: "-3%", d: 0.1 },
  { t: "Play preview · 8 steps", side: "right", y: "-3%", d: 0.25 },
  { t: "Reply handled in 0.7s", side: "right", y: "96%", d: 0.4 },
  { t: "Notice window · 11 days", side: "left", y: "96%", d: 0.55 },
];

export function Product() {
  const ref = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("command");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [28, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [80, 0]);
  const glow = useTransform(scrollYProgress, [0, 1], [0.2, 1]);
  const cur = TABS.find((t) => t.k === tab)!;

  return (
    <section id="product" ref={ref} className="relative overflow-hidden bg-ink px-5 pb-32 pt-36 md:px-10">
      <Aurora tone="mixed" />
      <GridBg />
      <div className="relative mx-auto max-w-[1400px]">
        <div className="grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Label n="02">The product</Label>
            <h2 className="mt-8 text-[clamp(2.6rem,6vw,6rem)] font-medium leading-[0.9] tracking-[-0.055em]">
              <Lines lines={[<>A renewals team</>, <span key="b" className="serif-i text-signal">that never sleeps.</span>]} />
            </h2>
          </div>
          <p className="max-w-md text-[15px] leading-relaxed text-bone/70 lg:col-span-5">
            One workspace for the CSM: what’s at risk and why, what Clutch is doing about it, and everything it wrote — every email, quote and filing,
            readable in full.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`relative rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition ${tab === t.k ? "text-ink" : "text-ash hover:text-bone"}`}
            >
              {tab === t.k && <motion.span layoutId="product-tab" className="absolute inset-0 rounded-full bg-bone" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 h-5 text-[13px] text-ash">{cur.note}</p>

        <div className="relative mt-8" style={{ perspective: 1600 }}>
          <motion.div aria-hidden style={{ opacity: glow }} className="absolute -inset-x-10 -bottom-10 top-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(255,90,31,0.28),transparent_70%)] blur-2xl" />
          <motion.div style={{ rotateX, scale, y, transformOrigin: "50% 0%" }} className="relative overflow-hidden rounded-[22px] border border-line bg-carbon shadow-[0_60px_160px_-40px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-2 border-b border-line bg-[#0f0f0e] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3a3833]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3a3833]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3a3833]" />
              <span className="mx-auto rounded-md border border-line px-3 py-0.5 font-mono text-[10.5px] text-ash">app.clutch.ai/{tab === "command" ? "" : tab}</span>
            </div>
            <div className="relative aspect-[1440/900] w-full bg-ink">
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, scale: 1.01 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} className="absolute inset-0">
                  <Image src={`/shots/${tab}.png`} alt={`${cur.label} screen`} fill sizes="(min-width: 1400px) 1400px, 100vw" className="object-cover object-top" priority={tab === "command"} />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
          {CHIPS.map((c) => (
            <motion.div
              key={c.t}
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-20% 0px" }}
              transition={{ delay: 0.5 + c.d, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute hidden items-center gap-2 rounded-full border border-line bg-ink/80 px-3.5 py-2 text-[12.5px] shadow-2xl backdrop-blur-md lg:flex"
              style={{ [c.side]: "3%", top: c.y }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_10px_rgba(255,90,31,0.9)]" />
              {c.t}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
