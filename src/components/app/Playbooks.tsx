"use client";

import Link from "next/link";
import { useState } from "react";
import { inrCompact } from "@/lib/format";
import { PLAYBOOK } from "@/lib/playbook";
import type { PlayKey } from "@/lib/types";
import { Loading, type State } from "./CommandCenter";
import { I } from "./icons";
import { post, useApi } from "./live";
import { PlayButton } from "./plays";
import { Btn, Mono, page, PageHeader, Stat } from "./ui";

const ORDER: PlayKey[] = ["competitor", "touchless", "champion", "bug", "adoption", "billing", "expansion", "rightsize"];

export function Playbooks() {
  const { data } = useApi<State>("/api/state");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<PlayKey>("competitor");
  if (!data) return <Loading />;
  const runs = data.runs;
  const eligible = (k: PlayKey) => data.accounts.filter((a) => !a.renewed && !a.activeRun && a.health.cause === k && a.health.daysToRenewal >= 0 && a.health.daysToRenewal <= 120);
  const doc = PLAYBOOK[open];
  const el = eligible(open);
  return (
    <div className={page}>
      <PageHeader
        eyebrow="Automation"
        title="Playbooks"
        subtitle="A play is a recipe: a trigger Clutch watches for, the steps it runs across your tools, and the outcome that means done. Every discount inside a play passes the deal-desk guardrails in code."
        actions={
          <Btn
            tone="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await post("/api/autopilot");
              setTimeout(() => setBusy(false), 2500);
            }}
          >
            <I.bolt width={13} height={13} /> {busy ? "Autopilot engaged" : "Run autopilot on the book"}
          </Btn>
        }
      />
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Plays run" value={String(runs.length)} sub="this session" />
        <Stat label="Completed" value={String(runs.filter((r) => r.status === "done").length)} tone="good" sub="end to end" />
        <Stat label="Steps automated" value={String(runs.reduce((t, r) => t + r.steps.filter((s) => s.status === "done").length, 0))} sub="emails, quotes, filings, billing" />
        <Stat label="Guardrails" value="15% max" sub="approval above 10% · in code" tone="risk" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <nav className="min-w-0 space-y-2 xl:col-span-4">
          {ORDER.map((k) => {
            const d = PLAYBOOK[k];
            const n = eligible(k).length;
            const r = runs.filter((x) => x.play === k).length;
            return (
              <button
                key={k}
                onClick={() => setOpen(k)}
                className={`w-full rounded-2xl border p-4 text-left transition ${open === k ? "border-bone/60 bg-ink" : "border-line bg-carbon hover:border-ash/60"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-medium tracking-[-0.01em]">{d.title}</span>
                  <span className="font-mono text-[10.5px] text-ash">
                    {n ? <span className="text-signal">{n} eligible</span> : "0 eligible"} · {r} run{r === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-ash">When: {d.trigger.toLowerCase()}</div>
              </button>
            );
          })}
        </nav>

        <section className="min-w-0 rounded-[20px] border border-line bg-carbon xl:col-span-8">
          <header className="border-b border-line p-6">
            <Mono>Play</Mono>
            <h2 className="mt-1 text-[28px] font-medium leading-tight tracking-[-0.04em]">{doc.title}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <Mono className="text-signal">The problem</Mono>
                <p className="mt-1.5 text-[13px] leading-relaxed text-bone/85">{doc.problem}</p>
              </div>
              <div>
                <Mono>Trigger</Mono>
                <p className="mt-1.5 text-[13px] leading-relaxed text-bone/85">{doc.trigger}. Clutch checks every account every night.</p>
              </div>
              <div>
                <Mono className="text-volt">Done means</Mono>
                <p className="mt-1.5 text-[13px] leading-relaxed text-bone/85">{doc.outcome}</p>
              </div>
            </div>
          </header>
          <div className="p-6">
            <Mono>Steps · what actually happens</Mono>
            <ol className="mt-4">
              {doc.steps.map((s, i) => (
                <li key={s.key + i} className="relative grid grid-cols-[32px_1fr] gap-x-4 pb-5 last:pb-0">
                  {i < doc.steps.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-26px)] w-px bg-line" />}
                  <span className={`grid h-8 w-8 place-items-center rounded-full font-mono text-[11px] ${s.human ? "bg-bone text-ink" : "border border-line text-ash"}`}>{i + 1}</span>
                  <div className="min-w-0 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-medium">{s.label}</span>
                      <span className="rounded-full border border-line px-2 py-px font-mono text-[9.5px] uppercase tracking-[0.1em] text-ash">{s.system}</span>
                      {s.human ? (
                        <span className="rounded-full bg-bone/10 px-2 py-px font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone">waits · {s.human}</span>
                      ) : (
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-volt/80">automatic</span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ash">{s.does}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <footer className="border-t border-line p-6">
            <Mono>Eligible right now · {el.length}</Mono>
            {el.length ? (
              <ul className="mt-3 divide-y divide-line/70 rounded-xl border border-line">
                {el.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <Link href={`/app/accounts/${a.id}`} className="min-w-0 hover:text-signal">
                      <span className="block truncate text-[13.5px]">{a.name}</span>
                      <span className="block truncate text-[11.5px] text-ash">
                        {inrCompact(a.arr)} · renews {a.health.daysToRenewal}d · {a.health.why}
                      </span>
                    </Link>
                    <PlayButton a={a} compact play={open} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-ash">No account needs this play right now — either none match the trigger, or Clutch is already running it.</p>
            )}
          </footer>
        </section>
      </div>
    </div>
  );
}
