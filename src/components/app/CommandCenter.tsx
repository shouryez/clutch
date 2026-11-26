"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { briefing } from "@/lib/brief";
import { inrCompact } from "@/lib/format";
import { PLAYBOOK } from "@/lib/playbook";
import type { AccountSummary } from "@/lib/types";
import type { stateView } from "@/lib/views";
import { ArrSplit, inRenewalWindow, RenewalBars } from "./charts";
import { Feed } from "./Feed";
import { post, useApi } from "./live";
import { I } from "./icons";
import { Pipeline } from "./Pipeline";
import { PlayButton, stageOf, stake, STAGES } from "./plays";
import { Btn, Mono, page, PageHeader, Panel, RiskBar, TierBadge } from "./ui";
import { ExportBrief } from "./Boardroom";

export { PLAY_LABEL, PlayButton, stake } from "./plays";
export type State = ReturnType<typeof stateView>;
type Brief = ReturnType<typeof briefing>;

/* ---------------- account table (used by Accounts) ---------------- */

export function StageCell({ a }: { a: AccountSummary }) {
  const s = stageOf(a);
  if (s === "later") return <span className="text-[12px] text-ash">monitoring</span>;
  const st = STAGES.find((x) => x.key === s)!;
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-1.5 text-[12px]">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot} ${s === "working" ? "animate-pulse" : ""}`} />
        {st.title}
      </span>
      {a.activeRun && (s === "working" || s === "waiting") && (
        <span className="mt-0.5 block truncate font-mono text-[10.5px] text-ash">
          {a.activeRun.done}/{a.activeRun.total} · {a.activeRun.step}
        </span>
      )}
    </div>
  );
}

export function AccountTable({ accounts, limit }: { accounts: AccountSummary[]; limit?: number }) {
  const rows = limit ? accounts.slice(0, limit) : accounts;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {["Account", "ARR", "Risk", "Why Clutch flagged it", "Stage", "Renews", "Next move"].map((h) => (
              <th key={h} className={`px-4 py-2.5 font-mono text-[9.5px] font-normal uppercase tracking-[0.16em] text-ash ${h === "Next move" ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="group border-b border-line/70 last:border-0 hover:bg-ink/40">
              <td className="whitespace-nowrap px-4 py-3">
                <Link href={`/app/accounts/${a.id}`} className="block">
                  <span className="block font-medium tracking-[-0.01em] group-hover:text-signal">{a.name}</span>
                  <span className="mt-0.5 flex items-center gap-3">
                    <TierBadge tier={a.health.tier} />
                    <span className="whitespace-nowrap text-[12px] text-ash">{a.seats} seats</span>
                  </span>
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] tabular-nums">{inrCompact(a.arr)}</td>
              <td className="px-4 py-3">
                <RiskBar value={a.health.risk} tier={a.health.tier} />
              </td>
              <td className="min-w-[240px] max-w-[340px] px-4 py-3 text-[12.5px] leading-snug text-bone/75">{a.health.why}</td>
              <td className="w-[170px] px-4 py-3">
                <StageCell a={a} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] tabular-nums">
                {a.renewed ? "—" : `${a.health.daysToRenewal}d`}
                {!a.renewed && a.health.tier !== "healthy" && a.health.daysToNotice >= 0 && a.health.daysToNotice <= 30 && (
                  <span className="block text-[10.5px] text-signal">notice {a.health.daysToNotice}d</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <PlayButton a={a} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- morning brief ---------------- */

function useBriefAudio() {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);
  const play = async () => {
    if (state === "playing" || state === "loading") {
      stop.current();
      setState("idle");
      return;
    }
    setState("loading");
    try {
      const r = await post<{ audios: string[]; mime?: string }>("/api/brief");
      let cancelled = false;
      let el: HTMLAudioElement | null = null;
      stop.current = () => {
        cancelled = true;
        el?.pause();
      };
      setState("playing");
      for (const b64 of r.audios) {
        if (cancelled) break;
        el = new Audio(`data:${r.mime ?? "audio/mpeg"};base64,${b64}`);
        await new Promise<void>((res) => {
          el!.onended = () => res();
          el!.onerror = () => res();
          el!.play().catch(() => res());
        });
      }
      if (!cancelled) setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };
  return { state, play };
}

function BriefPanel({ brief, accounts, onAutopilot, autoState }: { brief: Brief; accounts: AccountSummary[]; onAutopilot: () => void; autoState: string }) {
  const audio = useBriefAudio();
  return (
    <Panel
      title="Today's brief · written from last night's scan"
      right={
        <button onClick={audio.play} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-bone transition hover:border-ash">
          {audio.state === "playing" ? (
            <>
              <span className="flex h-3 items-end gap-[2px]">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="w-[2px] bg-signal" animate={{ height: [3, 12, 5, 10, 3] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </span>
              stop
            </>
          ) : audio.state === "loading" ? (
            "voicing…"
          ) : audio.state === "error" ? (
            "voice unavailable"
          ) : (
            <>▶ listen · 40s</>
          )}
        </button>
      }
      pad={false}
    >
      <ol>
        {brief.items.map((it, i) => {
          const a = accounts.find((x) => x.id === it.accountId);
          return (
            <li key={it.accountId} className="grid grid-cols-[28px_1fr] gap-x-3 border-b border-line px-5 py-4 md:grid-cols-[28px_1fr_auto]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-signal/15 font-mono text-[11px] text-signal">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <Link href={`/app/accounts/${it.accountId}`} className="text-[15px] font-medium tracking-[-0.01em] hover:text-signal">
                    {it.name}
                  </Link>
                  <span className="font-mono text-[12px] tabular-nums text-ash">{inrCompact(it.arr)}</span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-signal">{it.deadline}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-bone/75">{it.reason}.</p>
                <p className="mt-1 text-[12px] text-ash">
                  Clutch suggests <span className="text-bone">{PLAYBOOK[it.play].title.toLowerCase()}</span> — {PLAYBOOK[it.play].outcome.charAt(0).toLowerCase() + PLAYBOOK[it.play].outcome.slice(1)}
                </p>
              </div>
              <div className="col-start-2 mt-3 md:col-start-3 md:mt-0 md:self-center">{a && <PlayButton a={a} compact />}</div>
            </li>
          );
        })}
        {!brief.items.length && <li className="border-b border-line px-5 py-5 text-[13px] text-ash">Nothing urgent. Every at-risk account already has a play running.</li>}
      </ol>
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 bg-carbon px-5 py-3.5">
          <div className="min-w-0">
            <div className="text-[13px]">
              <span className="text-volt">{brief.touchless.count} healthy renewals</span> · {inrCompact(brief.touchless.arr)}
            </div>
            <div className="text-[11.5px] text-ash">can renew with zero human touches</div>
          </div>
          <Btn tone="volt" className="px-3 py-1.5" disabled={autoState === "running" || !brief.touchless.count} onClick={onAutopilot}>
            {autoState === "running" ? "Starting…" : "Autopilot"}
          </Btn>
        </div>
        <div className="flex items-center justify-between gap-3 bg-carbon px-5 py-3.5">
          {brief.bug ? (
            <>
              <div className="min-w-0">
                <div className="truncate text-[13px]">
                  <span className="text-signal">1 bug</span> blocks {inrCompact(brief.bug.arr)} · {brief.bug.accounts} accounts
                </div>
                <div className="truncate text-[11.5px] text-ash">{brief.bug.title}</div>
              </div>
              <Link href="/app/radar" className="shrink-0 rounded-full border border-line px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] hover:border-ash">
                Bug radar →
              </Link>
            </>
          ) : (
            <div className="text-[13px] text-ash">No unfiled revenue bugs.</div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------- queue: compact, never clipped ---------------- */

function Queue({ accounts }: { accounts: AccountSummary[] }) {
  return (
    <ul>
      {accounts.map((a) => (
        <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-line/70 px-5 py-3 last:border-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_64px_200px]">
          <Link href={`/app/accounts/${a.id}`} className="group min-w-0">
            <span className="block truncate text-[13.5px] font-medium group-hover:text-signal">{a.name}</span>
            <span className="mt-0.5 flex items-center gap-2.5">
              <TierBadge tier={a.health.tier} />
              <span className="font-mono text-[11px] tabular-nums text-ash">{inrCompact(a.arr)}</span>
            </span>
          </Link>
          <p className="col-span-2 row-start-2 line-clamp-2 text-[12px] leading-snug text-ash lg:col-span-1 lg:row-start-auto">{a.health.why}</p>
          <span className="hidden text-right font-mono text-[11.5px] tabular-nums lg:block">
            {a.renewed ? "—" : `${a.health.daysToRenewal}d`}
            {!a.renewed && a.health.tier !== "healthy" && a.health.daysToNotice >= 0 && a.health.daysToNotice <= 30 && <span className="block text-[10px] text-signal">notice {a.health.daysToNotice}d</span>}
          </span>
          <div className="col-start-2 row-start-1 text-right lg:col-start-auto lg:row-start-auto">
            <PlayButton a={a} compact />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CommandCenter() {
  const { data } = useApi<State>("/api/state");
  const { data: brief } = useApi<Brief>("/api/brief");
  const [auto, setAuto] = useState<"idle" | "running" | "done">("idle");
  if (!data) return <Loading />;
  const k = data.kpis;
  const window = inRenewalWindow(data.accounts);
  const queue = window.filter((a) => !a.renewed).sort((x, y) => stake(y) - stake(x));
  const live = Object.values(data.integrations).filter(Boolean).length;
  const runs = data.runs.slice(0, 6);
  const total = window.reduce((t, a) => t + a.arr, 0);
  const autopilot = async () => {
    setAuto("running");
    await post("/api/autopilot");
    setAuto("done");
    setTimeout(() => setAuto("idle"), 4000);
  };

  return (
    <div className={page}>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        title={
          <>
            Good evening, Meera <span className="serif-i text-signal">·</span>{" "}
            <span className="text-ash">{brief ? `${brief.items.length} accounts need you` : `${k.atRiskCount} at risk`}</span>
          </>
        }
        subtitle={`${window.length} renewals worth ${inrCompact(total)} land in the next 120 days. Clutch read every account overnight and lined up a play for each one.`}
        actions={
          <>
            <Link href="/app/integrations" className="rounded-full border border-line px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash hover:text-bone">
              {live}/7 integrations live
            </Link>
            <ExportBrief compact />
            <Btn tone="primary" disabled={auto === "running"} onClick={autopilot} title="Starts the recommended play on the 10 accounts with the most revenue at stake. Touchless renewals sign themselves in the demo.">
              <I.bolt width={13} height={13} /> {auto === "running" ? "Starting…" : auto === "done" ? "Autopilot engaged" : "Run autopilot"}
            </Btn>
          </>
        }
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">{brief ? <BriefPanel brief={brief} accounts={data.accounts} onAutopilot={autopilot} autoState={auto} /> : <Panel title="Today's brief"><div className="h-52" /></Panel>}</div>
        <div className="min-w-0 space-y-5 xl:col-span-5">
          <Panel title={`Where the ${inrCompact(total)} stands`} right={<Mono>renewing in 120 days</Mono>}>
            <ArrSplit accounts={data.accounts} />
          </Panel>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Renewed by Clutch" value={inrCompact(k.arrRenewed + k.savedArr)} sub={`${k.renewedCount} renewals · ${k.saves} saves`} tone="good" />
            <MiniStat label="Touchless" value={k.renewedCount ? `${Math.round((k.touchlessCount / k.renewedCount) * 100)}%` : "—"} sub="no human touched it" />
            <MiniStat label="Plays running" value={String(k.activeRuns)} sub={`${k.critical} critical accounts`} />
          </div>
          <Deadlines accounts={window.filter((x) => !x.renewed)} />
        </div>
      </div>

      <section className="mt-5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <Mono>Renewal pipeline · how accounts move</Mono>
          <Link href="/app/renewals" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash hover:text-bone">
            Open board →
          </Link>
        </div>
        <Pipeline accounts={window} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-8">
          <Panel title="When the money renews · ARR per week" right={<Mono>next 4 months</Mono>}>
            <RenewalBars accounts={data.accounts} />
          </Panel>
          <Panel title="Queue · ranked by revenue at stake" right={<Link href="/app/accounts" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash hover:text-bone">All 60 →</Link>} pad={false}>
            <Queue accounts={queue.slice(0, 8)} />
          </Panel>
        </div>
        <div className="min-w-0 space-y-5 xl:col-span-4">
          <Panel title="Plays in flight" right={<Link href="/app/outbox" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash hover:text-bone">Outbox →</Link>} pad={false}>
            {runs.length ? (
              <ul>
                {runs.map((r) => {
                  const a = data.accounts.find((x) => x.id === r.accountId);
                  const done = r.steps.filter((s) => s.status === "done").length;
                  const cur = r.steps.find((s) => s.status === "running" || s.status === "waiting");
                  return (
                    <li key={r.id} className="border-b border-line px-5 py-3 last:border-0">
                      <Link href={`/app/accounts/${r.accountId}`} className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13.5px]">{a?.name}</span>
                        <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${r.status === "done" ? "text-volt" : r.status === "failed" ? "text-signal" : r.status === "waiting" ? "text-bone" : "text-ash"}`}>{r.status}</span>
                      </Link>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="flex flex-1 gap-[3px]">
                          {r.steps.map((s) => (
                            <span key={s.key} className={`h-1 flex-1 rounded-full ${s.status === "done" ? "bg-volt" : s.status === "running" || s.status === "waiting" ? "animate-pulse bg-signal" : s.status === "failed" ? "bg-signal" : "bg-line"}`} />
                          ))}
                        </div>
                        <span className="font-mono text-[10.5px] tabular-nums text-ash">
                          {done}/{r.steps.length}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[11.5px] text-ash">
                        {r.title}
                        {cur ? ` · ${cur.label}` : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-5 py-6 text-[13px] leading-relaxed text-ash">
                Nothing running yet. Press a play button to preview what it does, or run autopilot to let Clutch work the top 10 accounts.
              </div>
            )}
          </Panel>
          <Panel
            title="Live agent feed"
            right={
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ash">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" /> streaming
              </span>
            }
            pad={false}
          >
            <div className="max-h-[560px] overflow-y-auto">
              <Feed events={data.feed} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Notice windows: after this date the customer can no longer give notice — the real deadline for a save. */
function Deadlines({ accounts }: { accounts: AccountSummary[] }) {
  const list = accounts
    .filter((a) => a.health.daysToNotice >= 0 && a.health.daysToNotice <= 45)
    .sort((x, y) => x.health.daysToNotice - y.health.daysToNotice)
    .slice(0, 5);
  return (
    <Panel title="Notice windows closing" right={<Mono>the real deadline</Mono>} pad={false}>
      <ul>
        {list.map((a) => (
          <li key={a.id} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line/70 px-5 py-2.5 last:border-0">
            <span className={`font-mono text-[18px] leading-none tabular-nums ${a.health.tier !== "healthy" && a.health.daysToNotice <= 15 ? "text-signal" : ""}`}>
              {a.health.daysToNotice}
              <span className="text-[10px] text-ash">d</span>
            </span>
            <Link href={`/app/accounts/${a.id}`} className="min-w-0 hover:text-signal">
              <span className="block truncate text-[13px]">{a.name}</span>
              <span className="block truncate text-[11px] text-ash">
                {inrCompact(a.arr)} · renews {a.health.daysToRenewal}d
              </span>
            </Link>
            <TierBadge tier={a.health.tier} />
          </li>
        ))}
        {!list.length && <li className="px-5 py-4 text-[12.5px] text-ash">No notice windows close in the next 45 days.</li>}
      </ul>
      <p className="border-t border-line px-5 py-2.5 text-[11px] leading-snug text-ash">After the notice date the contract renews or lapses on its own terms — saves have to land before it.</p>
    </Panel>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-carbon p-3.5">
      <div className="truncate font-mono text-[9.5px] uppercase tracking-[0.14em] text-ash">{label}</div>
      <div className={`mt-2 truncate text-[22px] font-medium leading-none tracking-[-0.04em] tabular-nums ${tone === "good" ? "text-volt" : ""}`}>{value}</div>
      <div className="mt-1 truncate text-[11px] text-ash">{sub}</div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Mono>Loading the world…</Mono>
    </div>
  );
}
