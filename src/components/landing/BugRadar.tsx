"use client";

import { motion } from "motion/react";
import { Aurora, GridBg } from "@/components/fx/Ambient";
import { Counter, Label, Rise } from "@/components/fx/Reveal";

const accounts = [
  ["Northwind Logistics", "₹48 L", "“Exports failing again.”"],
  ["Pallas Retail", "₹36 L", "“CSV just times out.”"],
  ["Orbit Fintech", "₹62 L", "“Our auditors need these exports.”"],
  ["Juniper Edu", "₹19 L", "“Third time this week.”"],
];

export function BugRadar() {
  return (
    <section className="relative overflow-hidden bg-ink px-5 py-36 md:px-10">
      <Aurora tone="signal" intensity={1.1} />
      <GridBg dots size={26} />
      <div className="relative mx-auto grid max-w-[1600px] gap-16 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Label n="09">Revenue bug radar</Label>
          <div className="mt-10 text-[clamp(5rem,15vw,15rem)] font-medium leading-[0.8] tracking-[-0.07em] text-signal">
            <Counter to={3.0} duration={2.4} format={(n) => `₹${n.toFixed(1)}`} />
            <span className="serif-i ml-2 text-[0.45em] tracking-normal">Cr</span>
          </div>
          <p className="mt-8 max-w-[22ch] text-[clamp(1.8rem,3vw,3rem)] font-medium leading-[1.02] tracking-[-0.04em]">
            of renewals blocked by <span className="serif-i">one</span> bug.
          </p>
          <p className="mt-8 max-w-md text-[15px] leading-relaxed text-ash">
            Clutch clusters every churn reason across every account, then files the engineering ticket with the money
            attached. The roadmap stops listening to whoever shouts loudest.
          </p>
        </div>

        <Rise className="lg:col-span-6" y={60}>
          <div className="rounded-[28px] border border-line bg-carbon p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              <span className="rounded-full bg-volt/10 px-2.5 py-1 text-volt">● Open</span>
              <span className="text-ash">helpdeck/core #412 · opened by clutch-bot</span>
            </div>
            <h3 className="mt-5 text-2xl font-medium leading-snug tracking-[-0.03em] md:text-3xl">
              CSV export times out above 10k rows
            </h3>
            <div className="mt-5 flex flex-wrap gap-2 font-mono text-[11px]">
              <span className="rounded-full bg-signal px-2.5 py-1 text-ink">P0</span>
              <span className="rounded-full border border-signal/50 px-2.5 py-1 text-signal">₹3.0 Cr ARR at risk</span>
              <span className="rounded-full border border-line px-2.5 py-1 text-ash">7 accounts</span>
              <span className="rounded-full border border-line px-2.5 py-1 text-ash">renewals in ≤ 90d: 2</span>
            </div>
            <div className="mt-8 divide-y divide-line border-t border-line">
              {accounts.map(([n, arr, q], i) => (
                <motion.div
                  key={n}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 py-4"
                >
                  <span className="text-[15px]">{n}</span>
                  <span className="font-mono text-[13px] tabular-nums text-bone">{arr}</span>
                  <span className="col-span-2 text-sm text-ash">{q}</span>
                </motion.div>
              ))}
              <div className="pt-4 font-mono text-[11px] text-ash">+ 3 more accounts</div>
            </div>
          </div>
        </Rise>
      </div>
    </section>
  );
}
