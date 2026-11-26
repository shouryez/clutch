"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { inrCompact } from "@/lib/format";
import { PLAYBOOK } from "@/lib/playbook";
import type { AccountSummary } from "@/lib/types";
import { inRenewalWindow } from "./charts";
import { Loading, type State } from "./CommandCenter";
import { post, useApi } from "./live";
import { I } from "./icons";
import { PlayButton, STAGES, stageOf, stake } from "./plays";
import { Btn, Mono, page, PageHeader, TierBadge } from "./ui";

function Card({ a }: { a: AccountSummary }) {
  const s = stageOf(a);
  const run = a.activeRun;
  const doc = PLAYBOOK[run && (s === "working" || s === "waiting") ? run.play : a.health.cause];
  return (
    <motion.div layout="position" className="rounded-xl border border-line bg-carbon p-3 transition hover:border-ash/60">
      <Link href={`/app/accounts/${a.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13.5px] font-medium leading-tight">{a.name}</span>
          <span className="font-mono text-[11px] tabular-nums">{inrCompact(a.arr)}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <TierBadge tier={a.health.tier} />
          <span className="font-mono text-[10.5px] text-ash">risk {a.health.risk}</span>
          <span className="ml-auto font-mono text-[10.5px] text-ash">{a.renewed ? "signed" : `${a.health.daysToRenewal}d`}</span>
        </div>
        {s === "flagged" || s === "ready" ? <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-ash">{a.health.why}</p> : null}
      </Link>
      {(s === "working" || s === "waiting") && run && (
        <div className="mt-2.5">
          <div className="flex gap-[3px]">
            {Array.from({ length: run.total }, (_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < run.done ? "bg-volt" : i === run.done ? "animate-pulse bg-signal" : "bg-line"}`} />
            ))}
          </div>
          <div className="mt-1.5 text-[11.5px] leading-snug">
            <span className="text-ash">{doc.title} · </span>
            {s === "waiting" ? <span className="text-bone">waiting: {run.step.toLowerCase()}</span> : <span className="text-bone">{run.step.toLowerCase()}</span>}
          </div>
        </div>
      )}
      {run?.status === "done" && (s === "flagged" || s === "ready") && <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-volt">✓ {PLAYBOOK[run.play].label} done · next: renewal</div>}
      {s === "renewed" && <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-volt">renewed ✓</div>}
      {(s === "flagged" || s === "ready") && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <PlayButton a={a} compact />
          <span className="hidden text-right text-[10.5px] leading-tight text-ash 2xl:block">{doc.steps.length} steps</span>
        </div>
      )}
    </motion.div>
  );
}

export function Renewals() {
  const { data } = useApi<State>("/api/state");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(true);
  if (!data) return <Loading />;
  const inWindow = inRenewalWindow(data.accounts);
  return (
    <div className={page}>
      <PageHeader
        eyebrow="Pipeline"
        title="Renewals"
        subtitle={`${inWindow.length} renewals in the next 120 days · ${inrCompact(inWindow.reduce((t, a) => t + a.arr, 0))} ARR. Cards move left to right on their own as Clutch works.`}
        actions={
          <>
            <Btn onClick={() => setHelp((x) => !x)}>{help ? "Hide" : "How it works"}</Btn>
            <Btn
              tone="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await post("/api/autopilot");
                setTimeout(() => setBusy(false), 2500);
              }}
            >
              <I.bolt width={13} height={13} /> {busy ? "Autopilot engaged" : "Run autopilot"}
            </Btn>
          </>
        }
      />

      {help && (
        <motion.section initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid gap-3 rounded-2xl border border-line bg-carbon p-5 md:grid-cols-3">
          <div>
            <Mono className="text-signal">1 · Clutch picks the play</Mono>
            <p className="mt-1.5 text-[13px] leading-relaxed text-bone/80">
              Every night it scores each account on usage, champion activity, tickets, tone and billing, then maps the biggest cause to a play: competitor mention → <b className="font-medium text-bone">Competitor save</b>, champion gone → <b className="font-medium text-bone">Re-thread</b>, healthy → <b className="font-medium text-bone">Touchless renew</b>.
            </p>
          </div>
          <div>
            <Mono className="text-signal">2 · You press go (or autopilot does)</Mono>
            <p className="mt-1.5 text-[13px] leading-relaxed text-bone/80">
              The button opens a preview of every step — who gets emailed, what price is quoted, what changes in billing — personalised to that account. Nothing runs blind. Discounts can’t pass 15%, and anything over 10% needs your approval.
            </p>
          </div>
          <div>
            <Mono className="text-signal">3 · It runs until it’s signed</Mono>
            <p className="mt-1.5 text-[13px] leading-relaxed text-bone/80">
              Clutch files the bug, writes the emails, calls the customer, sends the order form and waits for the signature. When they sign, billing and the contract update and the card lands in <b className="font-medium text-volt">Renewed</b>. Everything it wrote is in the{" "}
              <Link href="/app/outbox" className="underline underline-offset-4">
                outbox
              </Link>
              .
            </p>
          </div>
        </motion.section>
      )}

      <div className="mt-5 grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4 xl:grid-flow-row xl:grid-cols-5">
        {STAGES.map((c) => {
          const items = inWindow.filter((a) => stageOf(a) === c.key).sort((x, y) => stake(y) - stake(x));
          return (
            <section key={c.key} className="flex min-h-[62vh] min-w-0 flex-col rounded-2xl border border-line bg-[#0f0f0e]">
              <header className="border-b border-line px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
                    <span className="truncate text-[13px] font-medium">{c.title}</span>
                    <span className="rounded-full bg-carbon px-1.5 font-mono text-[10px] text-ash">{items.length}</span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-mono text-[10px] tabular-nums text-ash">{inrCompact(items.reduce((t, a) => t + a.arr, 0))}</span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-snug text-ash">{c.hint}</p>
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
                {items.map((a) => (
                  <Card key={a.id} a={a} />
                ))}
                {!items.length && <div className="px-1 py-6 text-center text-[12px] text-ash/70">Nothing here</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
