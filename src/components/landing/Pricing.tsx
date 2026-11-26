"use client";

import { motion } from "motion/react";
import { Aurora } from "@/components/fx/Ambient";
import { Label, Lines } from "@/components/fx/Reveal";

const TIERS = [
  {
    name: "Starter",
    price: "Free",
    per: "up to 25 accounts",
    blurb: "See your churn risk before it's a cancellation.",
    items: ["Nightly risk scoring with evidence", "Renewal pipeline & notice deadlines", "Contract reader · 10 a month", "Value receipts"],
    cta: "Start free",
  },
  {
    name: "Growth",
    price: "₹24,999",
    per: "per month · up to 500 accounts",
    blurb: "Let Clutch run the plays, with you on the approvals.",
    items: ["All 8 plays + autopilot", "Inbox agent for customer replies", "Voice agent · 300 minutes", "Slack, Stripe, GitHub, e-sign", "Bug radar with the ₹ attached"],
    cta: "Start a pilot",
    hot: true,
  },
  {
    name: "Outcome",
    price: "2%",
    per: "of the ARR Clutch saves",
    blurb: "Pay only when a renewal it touched is signed.",
    items: ["Everything in Growth, unlimited", "Unlimited voice minutes", "Custom guardrails & approvers", "SSO, audit log, data residency (IN)"],
    cta: "Talk to us",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative overflow-hidden border-t border-line bg-ink px-5 py-32 md:px-10">
      <Aurora tone="signal" intensity={0.6} />
      <div className="relative mx-auto max-w-[1400px]">
        <Label n="12">Pricing</Label>
        <div className="mt-8 grid items-end gap-8 lg:grid-cols-12">
          <h2 className="text-[clamp(2.4rem,5vw,4.8rem)] font-medium leading-[0.92] tracking-[-0.055em] lg:col-span-7">
            <Lines lines={[<>Priced like a teammate,</>, <span key="b" className="serif-i text-signal">paid like a closer.</span>]} />
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-bone/70 lg:col-span-5">A CSM costs ₹18 lakh a year and handles about 60 renewals. Clutch handles all of them — and on Outcome you only pay for the revenue it keeps.</p>
        </div>
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ delay: i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className={`relative flex flex-col rounded-[24px] border p-7 ${t.hot ? "border-signal/50 bg-gradient-to-b from-signal/[0.12] to-carbon shadow-[0_40px_100px_-40px_rgba(255,90,31,0.6)]" : "border-line bg-carbon/70"}`}
            >
              {t.hot && <span className="absolute -top-3 left-7 rounded-full bg-signal px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink">Most teams</span>}
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash">{t.name}</div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-[48px] font-medium leading-none tracking-[-0.05em]">{t.price}</span>
              </div>
              <div className="mt-1 text-[13px] text-ash">{t.per}</div>
              <p className="mt-4 text-[14.5px] text-bone/85">{t.blurb}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {t.items.map((x) => (
                  <li key={x} className="flex gap-2.5 text-[13.5px] text-bone/80">
                    <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${t.hot ? "bg-signal text-ink" : "bg-line text-bone"}`}>✓</span>
                    {x}
                  </li>
                ))}
              </ul>
              <a href="/app" className={`mt-8 rounded-full py-3 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] transition ${t.hot ? "bg-signal text-ink hover:brightness-110" : "border border-line hover:border-ash"}`}>
                {t.cta} →
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
