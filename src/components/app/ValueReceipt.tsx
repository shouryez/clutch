"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { inrCompact } from "@/lib/format";
import type { Value } from "@/lib/value";

type Data = { account: { id: string; name: string; plan: string; seats: number; renewal: string; since: string; champion: string | null }; daysToRenewal: number; value: Value };

const n = (x: number) => x.toLocaleString("en-IN");

export function ValueReceipt({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch(`/api/value/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setErr(true));
  }, [id]);

  if (err) return <div className="grid min-h-screen place-items-center bg-bone text-ink">Receipt not found.</div>;
  if (!d) return <div className="min-h-screen bg-bone" />;
  const v = d.value;
  const max = Math.max(...v.months.map((m) => m.conversations), 1);
  const renewal = new Date(d.account.renewal + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="min-h-screen bg-bone px-4 py-8 text-ink sm:py-14">
      <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-[620px] rounded-[28px] bg-[#f7f4ee] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] ring-1 ring-ink/10 sm:p-10">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-[13px] text-bone">H</span>
            Helpdeck
          </span>
          <span className="text-right font-mono text-[10px] uppercase leading-tight tracking-[0.14em] text-ink/50">Value receipt<span className="hidden sm:inline"> · {v.period}</span></span>
        </header>

        <div className="mt-10 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">Prepared for {d.account.name}</div>
        <h1 className="mt-2 text-[clamp(2.4rem,8vw,3.8rem)] font-medium leading-[0.95] tracking-[-0.055em]">
          {n(v.hoursSaved)} hours
          <span className="block text-ink/45">given back to your team.</span>
        </h1>
        <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink/70">
          That’s about <b className="font-semibold text-ink">{inrCompact(v.valueInr)}</b> of agent time in the {v.period}, against <b className="font-semibold text-ink">{inrCompact(v.cost)}</b> paid for the same period
          {v.roi >= 1 ? ` — ${v.roi.toFixed(1)}× what Helpdeck cost.` : "."}
        </p>

        <div className="my-8 border-t border-dashed border-ink/25" />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
          {[
            ["Conversations handled", n(v.conversations)],
            ["Automations fired", n(v.automations)],
            ["Median first response", `${v.firstResponseMins} min`],
            ["Active teammates", `${v.activeUsers} / ${v.seats}`],
          ].map(([k, val]) => (
            <div key={k}>
              <dt className="text-[12px] text-ink/55">{k}</dt>
              <dd className="mt-1 whitespace-nowrap font-mono text-[clamp(18px,5.5vw,24px)] tracking-[-0.02em] tabular-nums">{val}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8">
          <div className="text-[12px] text-ink/55">Conversations per month</div>
          <div className="mt-3 flex h-28 items-end gap-2">
            {v.months.map((m, i) => (
              <div key={m.label + i} className="flex flex-1 flex-col items-center gap-1.5">
                <motion.div
                  className={`w-full rounded-t-[5px] ${i === v.months.length - 1 ? "bg-[#ff5a1f]" : "bg-ink/80"}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${(m.conversations / max) * 96}px` }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  title={`${m.label}: ${n(m.conversations)}`}
                />
                <span className="font-mono text-[10px] uppercase text-ink/50">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="text-[12px] text-ink/55">What your team uses</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.features.map((f) => (
              <span key={f} className="rounded-full bg-ink px-2.5 py-1 text-[12px] text-bone">
                {f}
              </span>
            ))}
            {v.unused.map((f) => (
              <span key={f} className="rounded-full border border-dashed border-ink/30 px-2.5 py-1 text-[12px] text-ink/50">
                {f}
              </span>
            ))}
          </div>
        </div>

        {v.opportunity && (
          <div className="mt-8 rounded-2xl bg-ink p-5 text-bone">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#d7ff3d]">Left on the table</div>
            <p className="mt-2 text-[17px] leading-snug tracking-[-0.01em]">
              Turning on <b className="font-semibold">{v.opportunity.feature.toLowerCase()}</b> would save roughly <b className="font-semibold">{n(v.opportunity.hours)} more hours</b> a quarter.
            </p>
            <p className="mt-1 text-[13px] text-bone/60">{v.opportunity.note} Setup is free — reply to book a 30-minute session.</p>
          </div>
        )}

        <div className="my-8 border-t border-dashed border-ink/25" />
        <footer className="flex flex-wrap items-end justify-between gap-4 text-[12.5px] text-ink/60">
          <div>
            {d.account.plan} plan · {d.account.seats} seats · customer since {d.account.since.slice(0, 4)}
            <br />
            Renews {renewal}
            {d.daysToRenewal >= 0 ? ` · in ${d.daysToRenewal} days` : ""}
          </div>
          <div className="sm:text-right">
            Meera Kapoor
            <br />
            Customer Success, Helpdeck
          </div>
        </footer>
        <p className="mt-6 font-mono text-[10px] leading-relaxed text-ink/40">
          Figures from your workspace’s own usage: {8} min saved per automation and 4 min per conversation vs. plain email, at ₹700 per agent-hour.
        </p>
      </motion.article>
    </main>
  );
}
