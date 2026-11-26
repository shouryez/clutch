"use client";

import { motion } from "motion/react";
import { Aurora, GridBg } from "@/components/fx/Ambient";
import { Label, Lines } from "@/components/fx/Reveal";

const ease = [0.16, 1, 0.3, 1] as const;

const chat = [
  { me: false, who: "Procurement · Northwind", t: "We have a quote from Freshdesk at 30% less. Match 25% off or we don’t renew." },
  { me: true, who: "Clutch", t: "Understood. Your team’s usage grew 60% this year and saved roughly 340 agent-hours. 25% isn’t something I can do." },
  { me: true, who: "Clutch", t: "I can do 12% if we lock in 24 months — and I’ll include onboarding for the 12 new agents you hired." },
  { me: false, who: "Procurement · Northwind", t: "Make it 15 and we sign today." },
  { me: true, who: "Clutch", t: "15% needs my manager’s sign-off. Requesting it now — give me a minute." },
];

const ledger = [
  ["List price", "₹48,00,000", ""],
  ["Target", "₹42,24,000", "−12% · 24 mo"],
  ["Walk-away", "₹40,80,000", "−15% floor"],
];

export function Negotiation() {
  return (
    <section className="relative overflow-hidden bg-ink px-5 py-36 md:px-10">
      <Aurora tone="mixed" intensity={0.8} />
      <GridBg size={72} />
      <div className="relative mx-auto max-w-[1600px]">
        <Label n="06">Negotiation</Label>
        <h2 className="mt-8 max-w-[18ch] text-[clamp(2.8rem,6.4vw,7rem)] font-medium leading-[0.9] tracking-[-0.05em]">
          <Lines lines={[<>It haggles like your best rep.</>, <span key="b" className="serif-i text-signal">It can’t give away the company.</span>]} />
        </h2>

        <div className="mt-20 grid gap-6 lg:grid-cols-12">
          {/* chat */}
          <div className="rounded-[28px] border border-line bg-carbon p-6 md:p-8 lg:col-span-7">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ash">
              <span>Thread · renewal-northwind-2027</span>
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" /> live</span>
            </div>
            <div className="mt-8 space-y-4">
              {chat.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "0px 0px -15% 0px" }}
                  transition={{ duration: 0.8, ease, delay: i * 0.18 }}
                  className={`max-w-[80%] ${m.me ? "ml-auto" : ""}`}
                >
                  <div className={`mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${m.me ? "text-right text-signal" : "text-ash"}`}>{m.who}</div>
                  <div className={`rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed ${m.me ? "bg-bone text-ink" : "border border-line"}`}>{m.t}</div>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.1, duration: 0.8, ease }}
                className="mt-6 flex items-center justify-between rounded-2xl border border-volt/40 bg-volt/[0.06] px-5 py-4"
              >
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-volt">Slack · #deal-desk</div>
                  <div className="mt-1 text-[15px]">Approve 15% for Northwind? ₹40,80,000 · 24 months</div>
                </div>
                <div className="flex gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
                  <span className="rounded-full border border-line px-3 py-1.5 text-ash">Deny</span>
                  <span className="rounded-full bg-volt px-3 py-1.5 text-ink">Approve</span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* strategy */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            <div className="rounded-[28px] border border-signal/40 p-6 md:p-8">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]">
                <span className="text-signal">Strategy · private</span>
                <span className="text-ash">never shown to customer</span>
              </div>
              <div className="mt-6 divide-y divide-line">
                {ledger.map(([k, v, s], i) => (
                  <motion.div
                    key={k}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.15 }}
                    className="flex items-baseline justify-between py-3.5"
                  >
                    <span className="text-sm text-ash">{k}</span>
                    <span className="text-right">
                      <span className="block text-2xl font-medium tabular-nums tracking-[-0.03em]">{v}</span>
                      <span className="font-mono text-[11px] text-ash">{s}</span>
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 font-mono text-[11px]">
                <div>
                  <div className="uppercase tracking-[0.16em] text-ash">Gave</div>
                  <div className="mt-2 text-bone">12% discount</div>
                  <div className="text-bone">onboarding × 12</div>
                </div>
                <div>
                  <div className="uppercase tracking-[0.16em] text-ash">Got</div>
                  <div className="mt-2 text-volt">24-month term</div>
                  <div className="text-volt">+12 seats</div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] bg-[#0f0f0d] p-6 font-mono text-[12.5px] leading-[1.9] md:p-8">
              <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-ash">src/lib/dealdesk.ts — every offer passes here</div>
              {[
                ["propose", "discount=0.25  term=12", "✕ exceeds max_discount 0.15", "text-signal"],
                ["propose", "discount=0.12  term=24", "✓ within policy", "text-volt"],
                ["propose", "discount=0.15  term=24", "⏸ needs approval > 0.10", "text-bone"],
                ["approve", "by=@meera", "✓ 15% · ₹40,80,000", "text-volt"],
              ].map(([fn, args, res, tone], i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.25, duration: 0.5 }}
                  className="flex flex-wrap gap-x-3"
                >
                  <span className="text-ash">{fn}(</span>
                  <span className="text-bone/80">{args}</span>
                  <span className="text-ash">)</span>
                  <span className={tone}>{res}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
