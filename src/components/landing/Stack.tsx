"use client";

import { motion } from "motion/react";
import { Aurora, GridBg } from "@/components/fx/Ambient";
import { Label, Lines } from "@/components/fx/Reveal";
import { Wordmark } from "./Nav";

const INNER = ["Sarvam voice", "Deal desk", "Gemini", "Contracts"];
const OUTER = ["Slack", "GitHub", "Stripe", "Documenso", "Resend", "Calendar", "Helpdeck data", "Browser"];

function Ring({ items, r, dur, reverse }: { items: string[]; r: number; dur: number; reverse?: boolean }) {
  return (
    <div className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0 }}>
      <div className="absolute rounded-full border border-dashed border-line" style={{ width: r * 2, height: r * 2, left: -r, top: -r }} />
      <div className="absolute" style={{ animation: `orbit ${dur}s linear infinite ${reverse ? "reverse" : ""}` }}>
        {items.map((t, i) => {
          const a = (i / items.length) * 360;
          return (
            <div key={t} className="absolute" style={{ transform: `rotate(${a}deg) translate(${r}px) rotate(${-a}deg)` }}>
              <div style={{ animation: `orbit ${dur}s linear infinite ${reverse ? "" : "reverse"}` }}>
                <span className="block -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-carbon/90 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-bone/85 shadow-xl backdrop-blur">
                  {t}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Stack() {
  return (
    <section className="relative overflow-hidden border-t border-line bg-ink px-5 py-32 md:px-10">
      <Aurora tone="volt" intensity={0.7} />
      <GridBg dots size={28} />
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-16 lg:grid-cols-2">
        <div>
          <Label n="10">Works with your stack</Label>
          <h2 className="mt-8 text-[clamp(2.4rem,5vw,4.8rem)] font-medium leading-[0.92] tracking-[-0.055em]">
            <Lines lines={[<>Plugs into what</>, <span key="b" className="serif-i text-signal">you already run.</span>]} />
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-bone/70">
            Every external system sits behind one adapter. Missing a key? Clutch still writes the email or the issue and logs it — add the key and the same step goes live. The demo never breaks; production never guesses.
          </p>
          <ul className="mt-8 grid max-w-md grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
            {[
              ["Voice", "Sarvam Saaras + Bulbul"],
              ["Agent brain", "sarvam-105b · Gemini backup"],
              ["Signature", "Documenso (open source)"],
              ["Billing", "Stripe subscriptions"],
              ["Engineering", "GitHub issues"],
              ["Team", "Slack + email"],
            ].map(([k, v]) => (
              <li key={k}>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">{k}</div>
                <div className="text-bone/90">{v}</div>
              </li>
            ))}
          </ul>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="relative mx-auto aspect-square w-full max-w-[560px]">
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,90,31,0.35),transparent_70%)] blur-xl" />
          <Ring items={INNER} r={120} dur={46} />
          <Ring items={OUTER} r={230} dur={80} reverse />
          <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-signal/40 bg-ink text-[26px] shadow-[0_0_60px_-10px_rgba(255,90,31,0.7)]">
            <span className="ring-pulse absolute inset-0 rounded-full text-signal/60" />
            <Wordmark />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
