"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Aurora } from "@/components/fx/Ambient";
import { Label, Lines } from "@/components/fx/Reveal";
import { Spotlight } from "@/components/fx/Ambient";

const ease = [0.16, 1, 0.3, 1] as const;
const inView = { initial: "off", whileInView: "on", viewport: { once: true, margin: "-15% 0px" } } as const;

function Card({ k, title, body, children, className }: { k: string; title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <Spotlight className={className}>
      <div className="flex h-full flex-col p-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-signal">{k}</div>
        <div className="mt-2 text-[21px] font-medium leading-tight tracking-[-0.03em]">{title}</div>
        <p className="mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-ash">{body}</p>
        <div className="mt-6 flex-1">{children}</div>
      </div>
    </Spotlight>
  );
}

function InboxDemo() {
  const acts = ["Re-priced: 72 → 82 seats · upfront", "Order form sent for e-signature", "Procurement copied", "Reply sent in 0.9s"];
  return (
    <motion.div {...inView} className="grid gap-3 md:grid-cols-2">
      <motion.div variants={{ off: { opacity: 0, x: -14 }, on: { opacity: 1, x: 0 } }} transition={{ duration: 0.6, ease }} className="rounded-2xl border border-line bg-ink/70 p-4">
        <div className="flex items-center justify-between text-[12px] text-ash">
          <span>Neel · Dune Pharma</span>
          <span className="font-mono">2m</span>
        </div>
        <p className="mt-2 text-[13.5px] leading-snug text-bone/90">“Can we go to 10 more seats at renewal and pay annually upfront? Loop in procurement.”</p>
        <motion.span variants={{ off: { opacity: 0, scale: 0.8 }, on: { opacity: 1, scale: 1 } }} transition={{ delay: 0.6 }} className="mt-3 inline-block rounded-full border border-bone/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]">
          change request · 99%
        </motion.span>
      </motion.div>
      <ul className="space-y-2">
        {acts.map((a, i) => (
          <motion.li key={a} variants={{ off: { opacity: 0, y: 8 }, on: { opacity: 1, y: 0 } }} transition={{ delay: 0.9 + i * 0.25, ease }} className="flex items-center gap-2.5 rounded-xl border border-line bg-ink/50 px-3 py-2.5 text-[13px]">
            <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-volt text-[9px] text-ink">✓</span>
            {a}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

function BriefDemo() {
  return (
    <div className="flex h-full flex-col justify-end">
      <div className="flex h-16 items-center gap-[3px]">
        {Array.from({ length: 42 }).map((_, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-signal/80"
            animate={{ height: [6, 10 + ((i * 53) % 46), 8] }}
            transition={{ duration: 1 + (i % 6) * 0.12, repeat: Infinity, ease: "easeInOut", delay: i * 0.025 }}
          />
        ))}
      </div>
      <p className="mt-4 font-serif text-[19px] italic leading-snug text-bone/85">“Good morning, Meera. Three accounts need you today. First: Northwind, 48 lakh…”</p>
    </div>
  );
}

function ContractDemo() {
  const lines = [
    ["The Initial Term continues for ", "twelve (12) months", "."],
    ["Fees may increase by up to ", "8%", " at renewal."],
    ["Either party may give not less than ", "sixty (60) days'", " notice."],
    ["This Agreement shall ", "automatically renew", "."],
  ];
  return (
    <motion.div {...inView} className="space-y-1.5 rounded-2xl border border-line bg-ink/60 p-4 font-serif text-[14px] leading-snug text-bone/60">
      {lines.map(([a, m, b], i) => (
        <p key={i}>
          {a}
          <motion.mark variants={{ off: { backgroundColor: "rgba(255,90,31,0)" }, on: { backgroundColor: "rgba(255,90,31,0.25)" } }} transition={{ delay: 0.4 + i * 0.3 }} className="rounded px-0.5 text-bone">
            {m}
          </motion.mark>
          {b}
        </p>
      ))}
      <motion.div variants={{ off: { opacity: 0 }, on: { opacity: 1 } }} transition={{ delay: 1.8 }} className="mt-3 border-t border-line pt-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-volt">
        notice by 2 Dec · uplift 8% · auto-renew ✓
      </motion.div>
    </motion.div>
  );
}

function LadderDemo() {
  const r = [5, 8, 10, 12, 15];
  return (
    <motion.div {...inView} className="relative flex h-40 items-end gap-2 pt-6">
      {r.map((d, i) => (
        <motion.div key={d} variants={{ off: { height: 0 }, on: { height: `${(d / 18) * 100}%` } }} transition={{ delay: 0.2 + i * 0.12, duration: 0.7, ease }} className={`relative flex-1 rounded-t-[6px] ${d > 10 ? "bg-signal/70" : "bg-bone/80"}`}>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10.5px] text-ash">{d}%</span>
        </motion.div>
      ))}
      <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-volt/70" style={{ bottom: `${(15 / 18) * 100}%` }}>
        <span className="absolute -top-5 right-0 font-mono text-[10px] uppercase tracking-[0.1em] text-volt">hard limit · in code</span>
      </div>
    </motion.div>
  );
}

function LoopDemo() {
  const names = ["Northwind", "Orbit", "Pallas", "Juniper", "Aster", "Ember", "Vertex"];
  return (
    <motion.div {...inView} className="grid items-center gap-4 md:grid-cols-[auto_1fr]">
      <motion.div variants={{ off: { opacity: 0, scale: 0.9 }, on: { opacity: 1, scale: 1 } }} className="rounded-2xl border border-line bg-ink/70 p-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash">github · helpdeck/core</div>
        <div className="mt-1 text-[15px]">#413 CSV export times out</div>
        <motion.span variants={{ off: { backgroundColor: "rgba(215,255,61,0.08)" }, on: { backgroundColor: "rgba(168,85,247,0.25)" } }} transition={{ delay: 0.9 }} className="mt-2 inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]">
          closed · fix shipped
        </motion.span>
      </motion.div>
      <div className="flex flex-wrap gap-2">
        {names.map((n, i) => (
          <motion.span key={n} variants={{ off: { opacity: 0, x: -20 }, on: { opacity: 1, x: 0 } }} transition={{ delay: 1.1 + i * 0.12, ease }} className="flex items-center gap-2 rounded-full border border-line bg-ink/60 px-3 py-1.5 text-[12.5px]">
            <span className="h-1.5 w-1.5 rounded-full bg-volt" /> {n} told
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

function ValueDemo() {
  return (
    <motion.div {...inView} variants={{ off: { rotate: -4, y: 20, opacity: 0 }, on: { rotate: -2, y: 0, opacity: 1 } }} transition={{ duration: 0.8, ease }} className="rounded-2xl bg-bone p-4 text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]">
      <div className="flex justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/50">
        <span>Helpdeck</span>
        <span>value receipt</span>
      </div>
      <div className="mt-3 text-[30px] font-medium leading-none tracking-[-0.05em]">3,304 hrs</div>
      <div className="text-[12.5px] text-ink/60">given back to your team · 1.9× what you paid</div>
      <div className="mt-3 border-t border-dashed border-ink/25 pt-2 font-mono text-[10.5px] text-ink/60">16,971 conversations · 16,292 automations</div>
    </motion.div>
  );
}

function OutboxDemo() {
  const items = ["Email · renewal order form", "Quote · ₹59,32,080 · 12 mo", "Billing · 77 seats → term 2028", "Slack · #renewals"];
  return (
    <div className="relative h-40">
      {items.map((t, i) => (
        <motion.div
          key={t}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.15, ease }}
          className="absolute inset-x-0 rounded-xl border border-line bg-ink px-3.5 py-2.5 text-[12.5px] shadow-xl"
          style={{ top: i * 30, scale: 1 - (items.length - 1 - i) * 0.03, zIndex: i }}
        >
          <span className="text-bone/90">{t}</span>
          <span className="float-right font-mono text-[9.5px] uppercase tracking-[0.1em] text-volt">logged</span>
        </motion.div>
      ))}
    </div>
  );
}

export function Bento() {
  return (
    <section id="features" className="relative overflow-hidden bg-ink px-5 py-36 md:px-10">
      <Aurora tone="signal" intensity={0.8} />
      <div className="relative mx-auto max-w-[1400px]">
        <Label n="08">Everything around the call</Label>
        <h2 className="mt-8 max-w-4xl text-[clamp(2.4rem,5.5vw,5.4rem)] font-medium leading-[0.92] tracking-[-0.055em]">
          <Lines lines={[<>The boring 80% of renewals,</>, <span key="b" className="serif-i text-signal">automated end to end.</span>]} />
        </h2>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2" k="Inbox agent" title="Customer replies answer themselves." body="“Add 10 seats.” “Kavya left, talk to me.” “Send the SOC 2.” Clutch reads the intent, acts inside the guardrails and replies — in under a second.">
            <InboxDemo />
          </Card>
          <Card k="Morning brief" title="Your day, read aloud." body="Written from last night's scan — it can't invent a number — and voiced by Sarvam Bulbul.">
            <BriefDemo />
          </Card>
          <Card k="Contract reader" title="Paste a contract. Get the deadlines." body="Renewal date, notice window, uplift cap and auto-renew — each with the sentence it came from.">
            <ContractDemo />
          </Card>
          <Card k="Guardrails" title="Lines it can't cross." body="One step up the ladder per turn. Above 10% asks you. Above 15% never happens.">
            <LadderDemo />
          </Card>
          <Card k="Value receipt" title="Proof, before the price talk." body="Every order form ships with what the product saved them, in their own numbers.">
            <ValueDemo />
          </Card>
          <Card className="md:col-span-2" k="Close the loop" title="Bug fixed → every customer told." body="When engineering closes the P0, Clutch emails each account that reported it, closes their tickets and re-scores their risk.">
            <LoopDemo />
          </Card>
          <Card k="Outbox" title="Every action, readable." body="The full audit trail: every email, quote, filing and billing change, in full.">
            <OutboxDemo />
          </Card>
        </div>
      </div>
    </section>
  );
}
