"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { Label, Lines } from "@/components/fx/Reveal";

/* ---------- mini UIs ---------- */

function RiskDial({ value }: { value: number }) {
  const r = 70;
  const c = Math.PI * r; // half circle
  return (
    <svg viewBox="0 0 180 104" className="w-full max-w-[260px]">
      <path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="#2a2925" strokeWidth="10" strokeLinecap="round" />
      <motion.path
        d="M20 94 A70 70 0 0 1 160 94"
        fill="none"
        stroke="#ff5a1f"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - value / 100) }}
        viewport={{ once: true }}
        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
      />
      <text x="90" y="86" textAnchor="middle" className="fill-bone font-mono" fontSize="34" letterSpacing="-2">
        {value}
      </text>
    </svg>
  );
}

function Chip({ children, tone = "line" }: { children: ReactNode; tone?: "line" | "signal" }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] tracking-wide ${
        tone === "signal" ? "border-signal/50 text-signal" : "border-line text-bone/80"
      }`}
    >
      {children}
    </span>
  );
}

function WatchUI() {
  return (
    <div className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-line bg-ink/60 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">Northwind Logistics · ₹48 L ARR</div>
          <div className="mt-1 text-sm text-ash">Risk score</div>
        </div>
        <Chip tone="signal">● at risk</Chip>
      </div>
      <RiskDial value={81} />
      <p className="text-[15px] leading-relaxed">
        Usage is down 40% in six weeks, the champion has gone quiet, and a P1 ticket mentions a competitor.
      </p>
      <div className="flex flex-wrap gap-2">
        <Chip>usage −40% · 6w</Chip>
        <Chip>champion inactive 16d</Chip>
        <Chip tone="signal">#3318 “Freshdesk”</Chip>
      </div>
      <div>
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
          <span>Notice window</span>
          <span className="text-signal">12 days left</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full bg-signal"
            initial={{ width: "0%" }}
            whileInView={{ width: "86%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

function CallUI() {
  return (
    <div className="flex h-full flex-col justify-between gap-6 rounded-2xl bg-ink p-6 text-bone">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="text-ash">On call · 01:42</span>
        <span className="flex items-center gap-2">
          <span className="rounded-full border border-line px-2 py-0.5 text-ash line-through">EN</span>→
          <span className="rounded-full bg-signal px-2 py-0.5 text-ink">HI</span>
        </span>
      </div>
      <div className="flex h-28 items-center justify-center gap-[3px]">
        {Array.from({ length: 56 }).map((_, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-signal"
            animate={{ height: [6, 10 + ((i * 53) % 90), 8] }}
            transition={{ duration: 0.7 + (i % 7) * 0.09, repeat: Infinity, ease: "easeInOut", delay: (i % 11) * 0.05 }}
          />
        ))}
      </div>
      <div className="space-y-3 text-[15px] leading-snug">
        <p className="text-ash">Rohan — “Haan yaar, exports bahut fail ho rahe hain.”</p>
        <p>
          Clutch — “Fix Thursday ko ship ho raha hai. Main personally track kar rahi hoon.”
        </p>
      </div>
    </div>
  );
}

function NegotiateUI() {
  const rows = [
    { k: "They asked", v: "25% off", s: "✕ max_discount 15%", bad: true },
    { k: "Clutch offered", v: "12% · 24 mo", s: "✓ within policy", bad: false },
    { k: "Walk-away", v: "₹40,80,000", s: "private", bad: false },
  ];
  return (
    <div className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-ink/15 bg-ink/[0.04] p-6 text-ink">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">Deal desk · guardrails in code</div>
      <div className="divide-y divide-ink/15">
        {rows.map((r, i) => (
          <motion.div
            key={r.k}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 * i, duration: 0.8 }}
            className="flex items-baseline justify-between py-4"
          >
            <span className="text-sm text-ink/60">{r.k}</span>
            <span className="text-2xl font-medium tracking-[-0.03em]">{r.v}</span>
            <span className={`font-mono text-[11px] ${r.bad ? "text-signal" : "text-ink/60"}`}>{r.s}</span>
          </motion.div>
        ))}
      </div>
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">Leverage</div>
        {[
          ["Usage growth", 0.78],
          ["Switching cost", 0.64],
          ["Competitor gap", 0.31],
        ].map(([k, v]) => (
          <div key={k as string} className="mb-2 flex items-center gap-3">
            <span className="w-32 text-sm">{k}</span>
            <div className="h-1.5 flex-1 rounded-full bg-ink/10">
              <motion.div
                className="h-full rounded-full bg-ink"
                initial={{ width: 0 }}
                whileInView={{ width: `${(v as number) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CloseUI() {
  const steps = [
    ["00:00", "Order form generated", "₹42,24,000 · 24 mo"],
    ["00:03", "Sent for signature", "Documenso"],
    ["00:47", "Signed by Rohan M.", "on his phone, mid-call"],
    ["00:48", "Subscription updated", "Stripe"],
    ["00:48", "CRM + #renewals", "Slack"],
  ];
  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line bg-ink/60 p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">Close · Northwind</div>
      <ol className="space-y-0">
        {steps.map(([t, a, b], i) => (
          <motion.li
            key={a}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.18, duration: 0.6 }}
            className="grid grid-cols-[56px_18px_1fr] items-start gap-3 border-b border-line py-3 last:border-0"
          >
            <span className="font-mono text-[12px] tabular-nums text-ash">{t}</span>
            <span className="mt-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-volt text-[9px] text-ink">✓</span>
            <span>
              <span className="block text-[15px]">{a}</span>
              <span className="block text-sm text-ash">{b}</span>
            </span>
          </motion.li>
        ))}
      </ol>
      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">Human touches</span>
        <span className="text-4xl font-medium tracking-[-0.04em] text-volt">0</span>
      </div>
    </div>
  );
}

/* ---------- cards ---------- */

const agents = [
  {
    n: "01",
    name: "Watch",
    tag: "reads everything, together",
    body: "Usage, tickets, email tone, billing and the contract PDF itself. Every score comes with the sentence that explains it and the evidence behind each word.",
    points: ["Contract reader with clause citations", "Champion-loss detection", "Notice-window countdowns"],
    theme: "bg-carbon text-bone border border-line",
    ui: <WatchUI />,
  },
  {
    n: "02",
    name: "Call",
    tag: "picks up the phone",
    body: "A real-time voice agent that calls the account, knows its history, and switches to Hindi or Hinglish the moment the customer does. Interrupt it — it listens.",
    points: ["Open-source voice stack (Pipecat)", "Live transcript on the big screen", "Always discloses it’s an AI"],
    theme: "bg-signal text-ink",
    ui: <CallUI />,
  },
  {
    n: "03",
    name: "Negotiate",
    tag: "inside lines it can’t cross",
    body: "The model proposes; a deal-desk engine written in code decides. It trades discount for term, case studies or upfront payment — never below the floor.",
    points: ["Leverage computed from real usage", "Competitor pricing pulled live", "Manager approval above 10%"],
    theme: "bg-bone text-ink",
    ui: <NegotiateUI />,
  },
  {
    n: "04",
    name: "Close",
    tag: "signs, bills, logs",
    body: "Order form, e-signature, subscription update, CRM, Slack. Healthy accounts renew themselves at T−90 without anyone opening a spreadsheet.",
    points: ["Documenso e-sign", "Stripe billing", "Touchless renewals"],
    theme: "bg-carbon text-bone border border-line",
    ui: <CloseUI />,
  },
];

function AgentCard({ a, i }: { a: (typeof agents)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, i === agents.length - 1 ? 1 : 0.9]);
  const shade = useTransform(scrollYProgress, [0, 1], [0, i === agents.length - 1 ? 0 : 0.55]);

  return (
    <div ref={ref} className="sticky h-[100vh]" style={{ top: `calc(9vh + ${i * 22}px)` }}>
      <motion.article
        style={{ scale, transformOrigin: "50% 0%" }}
        className={`relative mx-auto grid h-[80vh] max-w-[1600px] gap-8 overflow-hidden rounded-[32px] p-7 md:grid-cols-12 md:p-12 ${a.theme}`}
      >
        <div className="flex flex-col justify-between md:col-span-6">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[12px] tracking-[0.18em] opacity-60">{a.n} / 04</span>
          </div>
          <div>
            <h3 className="text-[clamp(4rem,10vw,10rem)] font-medium leading-[0.82] tracking-[-0.065em]">{a.name}</h3>
            <p className="serif-i mt-3 text-[clamp(1.5rem,2.4vw,2.4rem)] leading-none opacity-80">{a.tag}</p>
            <p className="mt-8 max-w-lg text-[16px] leading-relaxed opacity-80">{a.body}</p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">
              {a.points.map((p) => (
                <li key={p}>— {p}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="hidden md:col-span-5 md:col-start-8 md:block">{a.ui}</div>
        <motion.div style={{ opacity: shade }} className="pointer-events-none absolute inset-0 bg-ink" />
      </motion.article>
    </div>
  );
}

export function Agents() {
  return (
    <section id="how" className="relative bg-ink px-4 pb-[10vh] pt-36 md:px-8">
      <div className="mx-auto max-w-[1600px] px-1 md:px-4">
        <Label n="04">Four agents · one pipeline</Label>
        <h2 className="mt-8 text-[clamp(3rem,8vw,9rem)] font-medium leading-[0.88] tracking-[-0.055em]">
          <Lines lines={[<>Not a dashboard.</>, <span key="t" className="serif-i text-signal">A renewal team.</span>]} />
        </h2>
      </div>
      <div className="mt-20">
        {agents.map((a, i) => (
          <AgentCard key={a.n} a={a} i={i} />
        ))}
      </div>
    </section>
  );
}
