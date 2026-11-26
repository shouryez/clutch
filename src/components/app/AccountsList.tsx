"use client";

import { useState } from "react";
import { inRenewalWindow } from "./charts";
import { AccountTable, Loading, type State } from "./CommandCenter";
import { useApi } from "./live";
import { Pipeline } from "./Pipeline";
import { stageOf, stake, type Stage } from "./plays";
import { Mono, page, PageHeader, Panel } from "./ui";

const FILTERS = ["all", "critical", "watch", "healthy", "expansion"] as const;

export function AccountsList() {
  const { data } = useApi<State>("/api/state");
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  const [stage, setStage] = useState<Stage | null>(null);
  const [q, setQ] = useState("");
  if (!data) return <Loading />;
  const list = data.accounts
    .filter((a) => (stage ? stageOf(a) === stage : true))
    .filter((a) => (f === "all" ? true : f === "expansion" ? a.health.upsell >= 60 : a.health.tier === f))
    .filter((a) => a.name.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => Number(stageOf(x) === "later") - Number(stageOf(y) === "later") || stake(y) - stake(x));

  return (
    <div className={page}>
      <PageHeader eyebrow="Portfolio" title="Accounts" subtitle="All 60 accounts, re-read every night: usage, tickets, email tone, billing and contracts. The button on each row previews the play Clutch picked before anything runs." />

      <section className="mt-5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <Mono>Renewal pipeline · click a stage to filter</Mono>
          {stage && (
            <button onClick={() => setStage(null)} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-signal">
              clear stage ✕
            </button>
          )}
        </div>
        <Pipeline accounts={inRenewalWindow(data.accounts)} active={stage} onSelect={setStage} />
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((x) => (
          <button
            key={x}
            onClick={() => setF(x)}
            className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition ${f === x ? "bg-bone text-ink" : "border border-line text-ash hover:text-bone"}`}
          >
            {x}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search accounts"
          className="ml-auto w-64 rounded-full border border-line bg-transparent px-4 py-1.5 text-[13px] outline-none placeholder:text-ash focus:border-ash"
        />
      </div>
      <Panel className="mt-4" pad={false} title={`${list.length} accounts${stage ? ` · ${stage}` : ""}`} right={<Mono>sorted by revenue at stake</Mono>}>
        <AccountTable accounts={list} />
      </Panel>
    </div>
  );
}
