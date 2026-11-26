"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useSyncExternalStore } from "react";
import { Counter, Label, Lines } from "@/components/fx/Reveal";
import { Magnetic } from "@/components/fx/Magnetic";
import { Aurora, GridBg } from "@/components/fx/Ambient";
import { Wordmark } from "./Nav";

export function Numbers() {
  const stats = [
    { v: 71, suf: "%", k: "of renewals touchless", d: "Healthy accounts close with zero human touches." },
    { v: 90, suf: " days", k: "earlier warning", d: "Signals caught at T−90, not on renewal day." },
    { v: 0, suf: "", k: "missed notice windows", d: "Every clause read, every deadline on a clock." },
  ];
  return (
    <section className="relative overflow-hidden border-t border-line bg-ink px-5 py-28 md:px-10">
      <GridBg size={90} />
      <div className="relative mx-auto max-w-[1600px]">
        <Label n="11">In the simulated portfolio · 60 accounts</Label>
        <div className="mt-14 grid divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {stats.map((s) => (
            <div key={s.k} className="py-10 md:px-8 md:first:pl-0">
              <div className="bg-gradient-to-b from-bone to-bone/40 bg-clip-text text-[clamp(4rem,8vw,8rem)] font-medium leading-none tracking-[-0.06em] text-transparent">
                <Counter to={s.v} format={(n) => `${Math.round(n)}`} />
                <span className="serif-i text-[0.5em] tracking-normal text-signal">{s.suf}</span>
              </div>
              <div className="mt-4 text-lg">{s.k}</div>
              <div className="mt-1 text-sm text-ash">{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  const ref = useRef<HTMLElement>(null);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "https://clutch.local",
  );
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const wordY = useTransform(scrollYProgress, [0, 1], ["40%", "0%"]);

  return (
    <section id="cta" ref={ref} className="relative overflow-hidden bg-ink px-5 pt-36 md:px-10">
      <Aurora tone="signal" intensity={1.3} />
      <div className="relative mx-auto max-w-[1600px]">
        <Label n="13">Try it</Label>
        <div className="mt-10 grid items-end gap-14 lg:grid-cols-12">
          <h2 className="text-[clamp(3.4rem,9vw,10rem)] font-medium leading-[0.86] tracking-[-0.06em] lg:col-span-8">
            <Lines lines={[<>Pick up.</>, <span key="c" className="serif-i text-signal">It’s Clutch.</span>]} />
          </h2>
          <div className="flex items-end gap-6 lg:col-span-4 lg:justify-end">
            <div className="rounded-2xl bg-bone p-3" data-cursor="Scan">
              <QRCodeSVG value={`${origin}/call/northwind`} size={132} bgColor="#eee9df" fgColor="#0b0b0a" />
            </div>
            <div className="pb-1">
              <p className="max-w-[18ch] text-sm leading-relaxed text-ash">Scan with your phone. It will ring.</p>
              <Magnetic className="mt-5">
                <a
                  href="/app"
                  data-cursor="Open"
                  className="group inline-flex items-center gap-3 rounded-full bg-signal px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.14em] text-ink"
                >
                  Open command center
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </a>
              </Magnetic>
            </div>
          </div>
        </div>

        <footer className="mt-32 border-t border-line pt-12">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-4">
              <div className="text-[28px]">
                <Wordmark />
              </div>
              <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-ash">The renewal autopilot for B2B SaaS. Spots churn early, calls the customer, closes the paperwork.</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-volt" /> all agents operational
              </div>
            </div>
            {(
              [
                ["Product", [["Command center", "/app"], ["Inbox agent", "/app/inbox"], ["Contracts", "/app/contracts"], ["Bug radar", "/app/radar"], ["Voice call", "/call/northwind-logistics"]]],
                ["How it works", [["The 90 days", "#how"], ["The call", "#call"], ["Everything else", "#features"], ["Pricing", "#pricing"]]],
                ["Trust", [["Guardrails", "/app/settings"], ["Outbox audit trail", "/app/outbox"], ["Integrations", "/app/integrations"], ["Value receipt", "/value/northwind-logistics"]]],
              ] as const
            ).map(([h, links]) => (
              <div key={h} className="md:col-span-2 md:col-start-auto">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ash">{h}</div>
                <ul className="mt-4 space-y-2.5">
                  {links.map(([l, href]) => (
                    <li key={l}>
                      <a href={href} className="text-[14px] text-bone/80 transition hover:text-signal">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-wrap justify-between gap-4 border-t border-line py-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ash">
            <span>PS-BA4 · Churn-risk & contract renewal automator</span>
            <span>Sarvam AI · Gemini · Documenso · Stripe · Next.js</span>
            <span>© 2026 Clutch</span>
          </div>
        </footer>
      </div>
      <motion.div style={{ y: wordY }} className="pointer-events-none -mb-[4vw] select-none text-center text-[31vw] leading-[0.78] text-carbon">
        <Wordmark />
      </motion.div>
    </section>
  );
}
