"use client";

import { inrCompact } from "@/lib/format";
import type { clusters } from "@/lib/bugs";
import type { Artifact } from "@/lib/types";
import { Runway } from "./charts";
import { Loading, type State } from "./CommandCenter";
import { useApi } from "./live";
import { Mono, page, PageHeader, Panel, Stat, tierColor } from "./ui";

type Cluster = ReturnType<typeof clusters>[number];

function Bars({ rows, color = "#eee9df", fmt = (v: number) => String(v) }: { rows: { label: string; value: number; color?: string; note?: string }[]; color?: string; fmt?: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${fmt(r.value)}${r.note ? ` · ${r.note}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px]">{r.label}</span>
            <span className="shrink-0 font-mono text-[12px] tabular-nums">
              {fmt(r.value)}
              {r.note && <span className="ml-2 text-ash">{r.note}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-line">
            <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: r.color ?? color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Analytics() {
  const { data } = useApi<State>("/api/state");
  const { data: radar } = useApi<{ clusters: Cluster[] }>("/api/radar");
  const { data: ob } = useApi<{ artifacts: Artifact[] }>("/api/outbox");
  if (!data || !radar) return <Loading />;
  const acc = data.accounts;
  const k = data.kpis;
  const total = acc.reduce((t, a) => t + a.arr, 0);
  const window = acc.filter((a) => !a.renewed && a.health.daysToRenewal >= 0 && a.health.daysToRenewal <= 120);
  // if nothing is done: each account churns with probability ≈ risk/100 × 0.6
  const expectedLoss = window.reduce((t, a) => t + a.arr * (a.health.risk / 100) * 0.6, 0);
  const tiers = (["critical", "watch", "healthy"] as const).map((t) => {
    const xs = acc.filter((a) => a.health.tier === t);
    return { label: t === "critical" ? "Critical (risk 60+)" : t === "watch" ? "Watch (35–59)" : "Healthy (under 35)", value: xs.reduce((s, a) => s + a.arr, 0), color: tierColor(t), note: `${xs.length} accts` };
  });

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() + i, 1));
  const byMonth = months.map((m) => {
    const list = acc.filter((a) => {
      const d = new Date(a.renewalDate + "T00:00:00");
      return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
    });
    return { m, safe: list.filter((a) => a.health.tier === "healthy").reduce((t, a) => t + a.arr, 0), risk: list.filter((a) => a.health.tier !== "healthy").reduce((t, a) => t + a.arr, 0), n: list.length };
  });
  const maxM = Math.max(...byMonth.map((b) => b.safe + b.risk), 1);

  const drivers = new Map<string, { n: number; arr: number }>();
  for (const a of acc.filter((x) => x.health.tier !== "healthy")) {
    const top = [...a.health.signals].sort((x, y) => y.contribution - x.contribution)[0];
    const d = drivers.get(top.label) ?? { n: 0, arr: 0 };
    drivers.set(top.label, { n: d.n + 1, arr: d.arr + a.arr });
  }

  const arts = ob?.artifacts ?? [];
  const steps = data.runs.reduce((t, r) => t + r.steps.filter((s) => s.status === "done").length, 0);
  const ledger = [
    ["Emails written", arts.filter((a) => a.kind === "email").length],
    ["Quotes priced", arts.filter((a) => a.kind === "quote").length],
    ["Issues filed", arts.filter((a) => a.kind === "issue").length],
    ["Billing changes", arts.filter((a) => a.kind === "billing").length],
    ["Meetings booked", arts.filter((a) => a.kind === "meeting").length],
  ] as const;

  return (
    <div className={page}>
      <PageHeader eyebrow="Intelligence" title="Analytics" subtitle="Four questions: how much is at risk, why, when it lands, and what Clutch has done about it." />
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total ARR" value={inrCompact(total)} sub={`${acc.length} accounts`} />
        <Stat label="At risk · next 120 days" value={inrCompact(k.arrAtRisk)} sub={`${k.atRiskCount} accounts · ${((k.arrAtRisk / total) * 100).toFixed(1)}% of book`} tone="risk" />
        <Stat label="Expected loss if nothing is done" value={inrCompact(expectedLoss)} sub="risk-weighted, renewals in 120 days" tone="risk" />
        <Stat label="Protected by Clutch" value={inrCompact(k.arrRenewed + k.savedArr)} sub={`${k.renewedCount} renewed · ${k.saves} cancellations stopped`} tone="good" />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="1 · How much is at risk" right={<Mono>ARR by risk tier</Mono>}>
          <Bars rows={tiers} fmt={inrCompact} />
        </Panel>

        <Panel title="2 · Why" right={<Mono>biggest signal per at-risk account</Mono>}>
          <Bars rows={[...drivers.entries()].sort((x, y) => y[1].arr - x[1].arr).map(([label, d]) => ({ label, value: d.arr, note: `${d.n} accts` }))} color="#ff5a1f" fmt={inrCompact} />
        </Panel>

        <Panel title="3 · When it lands" right={<Mono>renewals by month</Mono>}>
          <div className="flex h-48 items-end gap-3">
            {byMonth.map((b) => (
              <div key={b.m.toISOString()} className="flex flex-1 flex-col items-center gap-2" title={`${b.m.toLocaleDateString("en-IN", { month: "long" })}: ${b.n} renewals · ${inrCompact(b.safe + b.risk)} (${inrCompact(b.risk)} at risk)`}>
                <span className="font-mono text-[10.5px] tabular-nums text-ash">{b.n ? inrCompact(b.safe + b.risk) : ""}</span>
                <div className="flex w-full max-w-[56px] flex-col justify-end gap-[2px]" style={{ height: 140 }}>
                  {b.risk > 0 && <div className="w-full rounded-t-[4px] bg-signal" style={{ height: `${(b.risk / maxM) * 100}%` }} />}
                  {b.safe > 0 && <div className={`w-full bg-[#6e6a61] ${b.risk > 0 ? "" : "rounded-t-[4px]"}`} style={{ height: `${(b.safe / maxM) * 100}%` }} />}
                </div>
                <span className="font-mono text-[10px] uppercase text-ash">{b.m.toLocaleDateString("en-IN", { month: "short" })}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-[11.5px] text-ash">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-signal" /> at risk</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#6e6a61]" /> healthy</span>
          </div>
        </Panel>

        <Panel title="4 · What Clutch has done" right={<Mono>this session</Mono>}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[34px] font-medium leading-none tracking-[-0.04em] tabular-nums">{steps}</div>
              <div className="mt-1 text-[12px] text-ash">steps run without a human</div>
            </div>
            <div>
              <div className="text-[34px] font-medium leading-none tracking-[-0.04em] tabular-nums text-volt">~{Math.round((steps * 15) / 60)}h</div>
              <div className="mt-1 text-[12px] text-ash">CSM time saved (≈ 15 min per step)</div>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-line/60 rounded-xl border border-line">
            {ledger.map(([l, n]) => (
              <div key={l} className="flex justify-between px-3 py-2 text-[13px]">
                <dt className="text-ash">{l}</dt>
                <dd className="font-mono tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="lg:col-span-2" title="Bugs by revenue they block" right={<Mono>from the bug radar</Mono>}>
          <Bars rows={radar.clusters.map((c) => ({ label: c.title, value: c.arr, note: `${c.accounts.length} accts` }))} fmt={inrCompact} />
        </Panel>

        <Panel className="lg:col-span-2" title="Renewal runway · risk tier × days to renewal" right={<Mono>dot size = ARR · tick = notice window closes</Mono>}>
          <Runway accounts={acc} />
        </Panel>
      </div>
    </div>
  );
}
