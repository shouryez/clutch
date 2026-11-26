"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { inr, inrCompact } from "@/lib/format";
import { PLAYBOOK } from "@/lib/playbook";
import type { Artifact, PlayKey, PlayRun, PlayStep } from "@/lib/types";
import type { accountView } from "@/lib/views";
import { UsageChart } from "./charts";
import { MailButton } from "./MailButton";
import { ArtifactPeek, ArtifactView, KIND_LABEL, ModeChip } from "./Artifact";
import { Loading } from "./CommandCenter";
import { playTone, PreviewTrigger } from "./plays";
import { Feed } from "./Feed";
import { post, usePublicUrl, useApi, useLive } from "./live";
import { Btn, Dial, Mono, page, Panel, Stat, TierBadge, useNow } from "./ui";

type View = NonNullable<ReturnType<typeof accountView>>;

const STEP_ICON: Record<PlayStep["status"], string> = {
  pending: "border border-line",
  running: "border-2 border-bone border-t-transparent animate-spin",
  waiting: "bg-signal animate-pulse",
  done: "bg-volt",
  failed: "bg-signal",
  skipped: "border border-line",
};

function RunTimeline({ run, artifacts }: { run: PlayRun; artifacts: Artifact[] }) {
  const publicUrl = usePublicUrl();
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const elapsed = Math.max(0, Math.round(((run.endedAt ?? now) - run.startedAt) / 1000));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <Mono>{run.status === "done" ? "Completed" : run.status === "failed" ? "Failed" : run.status === "waiting" ? "Waiting on the outside world" : "Running"}</Mono>
          <div className="mt-1 text-xl font-medium tracking-[-0.03em]">{run.title}</div>
        </div>
        <span className="font-mono text-[12px] tabular-nums text-ash">{elapsed}s</span>
      </div>
      <ol className="mt-5">
        {run.steps.map((s, i) => (
          <motion.li
            key={s.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: s.status === "pending" ? 0.45 : 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="relative grid grid-cols-[22px_1fr] gap-x-3 pb-4 last:pb-0"
          >
            {i < run.steps.length - 1 && <span className="absolute left-[6px] top-4 h-[calc(100%-8px)] w-px bg-line" />}
            <span className={`relative mt-1 h-3.5 w-3.5 rounded-full ${STEP_ICON[s.status]}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[14px]">{s.label}</span>
                <span className="font-mono text-[10.5px] text-ash">{s.tool}</span>
              </div>
              {s.trace && s.trace.length > 0 && (s.status === "running" || s.status === "done") && (
                <ul data-testid="agent-trace" className={`mt-1.5 space-y-0.5 border-l border-line pl-2.5 font-mono text-[11px] leading-relaxed ${s.status === "running" ? "text-bone/85" : "text-ash/70"}`}>
                  {s.trace.map((t, k) => (
                    <motion.li key={k} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="flex gap-1.5">
                      <span className={s.status === "running" && k === s.trace!.length - 1 ? "text-signal" : "text-ash/60"}>›</span>
                      <span>
                        {t}
                        {s.status === "running" && k === s.trace!.length - 1 && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-signal align-middle" />}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              )}
              {s.output && <div className={`mt-1 text-[12.5px] leading-snug ${s.status === "failed" ? "text-signal" : "text-bone/80"}`}>{s.status === "done" ? "✓ " : ""}{s.output}</div>}
              {s.artifactId && (
                <div className="flex flex-wrap items-center gap-3">
                  <ArtifactPeek artifact={artifacts.find((x) => x.id === s.artifactId)} />
                  <span className="mt-1.5">
                    <MailButton artifactId={s.artifactId} sent={artifacts.find((x) => x.id === s.artifactId)?.sent ?? null} />
                  </span>
                </div>
              )}
              {s.status === "waiting" && s.key === "await_signature" && s.link && (
                <div className="mt-3 flex items-center gap-4 rounded-xl border border-line bg-ink/60 p-3">
                  <div className="rounded-lg bg-bone p-1.5">
                    <QRCodeSVG value={publicUrl(s.link)} size={84} bgColor="#eee9df" fgColor="#0b0b0a" />
                  </div>
                  <div className="text-[12.5px] leading-snug text-ash">
                    Scan to sign as the customer, or{" "}
                    <a href={s.link} target="_blank" className="text-bone underline underline-offset-4">
                      open the order form
                    </a>
                    .
                  </div>
                </div>
              )}
              {s.status === "waiting" && s.key !== "await_signature" && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {s.link && (
                    <div className="flex items-center gap-3 rounded-xl border border-line bg-ink/60 p-2.5">
                      <div className="rounded-md bg-bone p-1">
                        <QRCodeSVG value={publicUrl(s.link)} size={64} bgColor="#eee9df" fgColor="#0b0b0a" />
                      </div>
                      <span className="max-w-[18ch] text-[12px] text-ash">
                        Scan to take the call ·{" "}
                        <a href={`/app/call/${run.accountId}`} className="text-bone underline underline-offset-4">
                          live view
                        </a>
                      </span>
                    </div>
                  )}
                  <Btn
                    tone="volt"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await post(`/api/runs/${run.id}/advance`, { note: s.key === "call" ? "call completed · customer agreed to 2-year renewal" : "confirmed" });
                      setBusy(false);
                    }}
                  >
                    Mark done →
                  </Btn>
                </div>
              )}
              {s.status === "done" && s.link && s.link.startsWith("http") && (
                <a href={s.link} target="_blank" className="mt-1 inline-block font-mono text-[11px] text-bone underline underline-offset-4">
                  {s.link.replace("https://", "")}
                </a>
              )}
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function PlayPicker({ v }: { v: View }) {
  const run = v.runs[0];
  const active = !!run && (run.status === "running" || run.status === "waiting");
  const rec = v.plays.find((p) => p.recommended)!;
  const doc = PLAYBOOK[rec.key as PlayKey];
  const locked = active || !!v.renewed;
  return (
    <div>
      <div className="rounded-2xl border border-signal/40 bg-signal/[0.06] p-5">
        <Mono className="text-signal">Recommended play</Mono>
        <div className="mt-2 text-2xl font-medium tracking-[-0.03em]">{doc.title}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-bone/75">{doc.problem}</p>
        <ol className="mt-3 space-y-1">
          {doc.steps.map((s, i) => (
            <li key={s.key + i} className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-bone/80">
              <span className="w-4 font-mono text-[10px] text-ash">{i + 1}</span>
              {s.label}
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ash">· {s.system}</span>
              {s.human && <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone">· waits</span>}
            </li>
          ))}
        </ol>
        <PreviewTrigger
          accountId={v.account.id}
          play={rec.key as PlayKey}
          disabled={locked}
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition disabled:opacity-40 ${playTone(rec.key as PlayKey) === "volt" ? "bg-volt text-ink" : "bg-signal text-ink hover:bg-[#ff7140]"}`}
        >
          {v.renewed ? "Renewed ✓" : active ? "Play running" : "Preview & run →"}
        </PreviewTrigger>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={`/app/deal/${v.account.id}`} className="rounded-xl border border-line px-3 py-2.5 text-[13px] transition hover:border-ash">
          Deal room <span className="text-ash">→</span>
          <span className="block text-[11px] text-ash">negotiate by chat, inside guardrails</span>
        </Link>
        <Link href={`/app/call/${v.account.id}`} className="rounded-xl border border-line px-3 py-2.5 text-[13px] transition hover:border-ash">
          Voice call <span className="text-ash">→</span>
          <span className="block text-[11px] text-ash">AI calls them · you listen live</span>
        </Link>
      </div>
      <div className="mt-5">
        <Mono>Other plays · click to preview</Mono>
        <ul className="mt-2 divide-y divide-line/70 rounded-xl border border-line">
          {v.plays
            .filter((p) => !p.recommended)
            .map((p) => (
              <li key={p.key}>
                <PreviewTrigger accountId={v.account.id} play={p.key as PlayKey} disabled={locked} className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-ink/50 disabled:opacity-40">
                  <span className="min-w-0">
                    <span className="block text-[13px]">{PLAYBOOK[p.key as PlayKey].title}</span>
                    <span className="block truncate text-[11.5px] text-ash">{PLAYBOOK[p.key as PlayKey].trigger}</span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-ash">→</span>
                </PreviewTrigger>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function RenewalPath({ v }: { v: View }) {
  const run = v.runs[0];
  const live = run && run.status !== "failed" ? run : undefined;
  const cust = live?.steps.find((s) => s.key === "await_signature" || s.key === "call" || s.key === "confirm");
  const acting: "done" | "now" | "todo" = !live ? "todo" : live.status === "running" && cust?.status !== "done" ? "now" : "done";
  const custState: "done" | "now" | "todo" = !live ? "todo" : cust?.status === "waiting" ? "now" : cust?.status === "done" || (!cust && live.status === "done") ? "done" : "todo";
  const nodes: { label: string; sub: string; state: "done" | "now" | "todo" }[] = [
    { label: "Risk detected", sub: `score ${v.health.risk} · nightly scan`, state: "done" },
    { label: "Play chosen", sub: PLAYBOOK[(live?.play ?? v.health.cause) as PlayKey].title, state: "done" },
    { label: "Clutch acting", sub: live ? `${live.steps.filter((s) => s.status === "done").length}/${live.steps.length} steps done` : "waiting for a go", state: acting },
    { label: "Customer step", sub: cust ? cust.label : live ? "none needed" : "call or signature", state: custState },
    { label: v.renewed ? "Renewed" : "Signed & billed", sub: v.renewed ? `new term ends ${v.account.contract.end}` : `renewal due ${v.account.contract.end}`, state: v.renewed ? "done" : "todo" },
  ];
  return (
    <ol className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-carbon p-3 sm:grid-cols-5 sm:gap-0 sm:p-0">
      {nodes.map((n, i) => (
        <li key={n.label} className={`relative flex items-start gap-3 sm:px-4 sm:py-3.5 ${i ? "sm:border-l sm:border-line" : ""}`}>
          <span
            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${
              n.state === "done" ? "bg-volt text-ink" : n.state === "now" ? "animate-pulse bg-signal text-ink" : "border border-line text-ash"
            }`}
          >
            {n.state === "done" ? "✓" : i + 1}
          </span>
          <span className="min-w-0">
            <span className={`block text-[13px] ${n.state === "todo" ? "text-ash" : ""}`}>{n.label}</span>
            <span className="block truncate text-[11.5px] text-ash">{n.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function SentPanel({ items }: { items: Artifact[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <Panel
      title={`What Clutch produced · ${items.length}`}
      right={
        <Link href="/app/outbox" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash hover:text-bone">
          Outbox →
        </Link>
      }
      pad={false}
    >
      <ul>
        {items.map((x) => (
          <li key={x.id} className="border-b border-line last:border-0">
            <button onClick={() => setOpen(open === x.id ? null : x.id)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-ink/40">
              <span className="w-20 shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">{KIND_LABEL[x.kind]}</span>
              <span className="flex-1 truncate text-[12.5px]">{x.title}</span>
              <ModeChip a={x} />
            </button>
            {open === x.id && (
              <div className="px-4 pb-4">
                <ArtifactView a={x} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function AccountView({ id }: { id: string }) {
  const { data: v, error } = useApi<View>(`/api/accounts/${id}`);
  const { events } = useLive();
  const [clause, setClause] = useState<string | null>("notice");
  if (error === "404") return <div className="p-10 text-ash">Account not found.</div>;
  if (!v) return <Loading />;
  const a = v.account;
  const h = v.health;
  const champ = a.contacts.find((c) => c.isChampion);
  const run = v.runs[0];
  const activeClause = a.contract.clauses.find((c) => c.key === clause);
  const noticePct = Math.max(0, Math.min(1, 1 - h.daysToNotice / 90));
  const usageAlarm = (h.signals.find((s) => s.key === "usage")?.value ?? 0) > 0.3;

  return (
    <div className={page}>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash">
        <Link href="/app/accounts" className="hover:text-bone">Accounts</Link>
        <span>/</span>
        <span className="text-bone">{a.name}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-bone text-[18px] font-semibold tracking-tight text-ink">{a.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
          <div>
            <h1 className="text-[26px] font-medium leading-tight tracking-[-0.035em]">{a.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[12.5px] text-ash">
              <TierBadge tier={h.tier} />
              <span>{a.industry} · {a.city}</span>
              <span>CSM {a.csm}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/value/${a.id}`} target="_blank" className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] hover:border-ash">Value receipt ↗</a>
          <Link href={`/app/call/${a.id}`} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] hover:border-ash">Call customer</Link>
          <Link href={`/app/deal/${a.id}`} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] hover:border-ash">Deal desk</Link>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ARR" value={inrCompact(a.arr)} sub={`${inr(a.pricePerSeatMonth)}/seat/mo`} />
        <Stat label="Plan" value={`${a.seats} seats`} sub={a.plan} />
        <Stat label="Renews in" value={`${h.daysToRenewal}d`} sub={a.contract.end} />
        <Stat label="Notice window" value={h.daysToNotice < 0 ? "closed" : `${h.daysToNotice}d`} sub={`${a.contract.noticeDays}-day notice clause`} tone={h.daysToNotice < 15 && h.tier !== "healthy" ? "risk" : undefined} />
      </div>

      <RenewalPath v={v} />

      {v.renewed && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-volt px-6 py-4 text-ink">
          <span className="text-xl font-medium tracking-[-0.03em]">Renewed{v.renewed.touchless ? " — touchless" : ""}.</span>
          <span className="font-mono text-[12px] uppercase tracking-[0.12em]">
            {inr(v.offers.find((o) => o.id === v.renewed!.offerId)?.price ?? 0)} · new term ends {a.contract.end}
          </span>
        </motion.div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="min-w-0 space-y-5">
          <Panel title="Churn risk">
            <div className="flex flex-col items-center">
              <Dial value={h.risk} tier={h.tier} />
            </div>
            <p className="mt-4 text-[17px] leading-snug tracking-[-0.01em]">{h.why}</p>
            <div className="mt-6 space-y-3">
              {[...h.signals]
                .sort((x, y) => y.contribution - x.contribution)
                .map((s) => (
                  <div key={s.key} className="grid grid-cols-[110px_1fr_34px] items-center gap-3" title={s.evidence}>
                    <span className="text-[12.5px] text-ash">{s.label}</span>
                    <div className="h-1.5 rounded-full bg-line">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: s.value > 0.6 ? "#ff5a1f" : "#eee9df" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(2, s.value * 100)}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <span className="text-right font-mono text-[11px] tabular-nums text-ash">{Math.round(s.value * 100)}</span>
                  </div>
                ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {h.signals
                .filter((s) => s.value > 0.3)
                .map((s) => (
                  <span key={s.key} className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${s.value > 0.6 ? "border-signal/50 text-signal" : "border-line text-bone/80"}`}>
                    {s.evidence}
                  </span>
                ))}
            </div>
            {h.deadlineMultiplier > 1 && (
              <div className="mt-5 font-mono text-[11px] text-ash">× {h.deadlineMultiplier} deadline pressure (notice window in {h.daysToNotice}d)</div>
            )}
          </Panel>
          {v.exceptions.length > 0 && (
            <Panel title={`Policy exceptions · ${v.exceptions.length}`} right={<Link href="/app/policies" className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash hover:text-bone">Policies →</Link>}>
              <ul className="space-y-3">
                {v.exceptions.map((e) => (
                  <li key={e.key} className={`border-l-2 pl-3 ${e.severity === "critical" || e.severity === "high" ? "border-signal" : "border-line"}`}>
                    <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash">
                      {e.ruleId} · {e.severity}
                      {e.status === "new" && <span className="rounded-full bg-signal px-1.5 text-ink">new</span>}
                    </div>
                    <div className="text-[13px]">{e.ruleName}</div>
                    <div className="text-[12px] text-ash">{e.message}</div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Deal desk · private">
            <dl className="space-y-2.5 text-[13px]">
              {[
                ["List (renewal)", inr(v.listPrice)],
                ["Walk-away", inr(v.leverage.walkAway)],
                ["Switching cost for them", inr(v.leverage.migrationCost)],
                ["Hours saved (90d)", `${v.leverage.hoursSaved} hrs`],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ash">{k}</dt>
                  <dd className="font-mono tabular-nums">{val}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 border-t border-line pt-3 font-mono text-[10.5px] leading-relaxed text-ash">
              max discount {v.policy.maxDiscount * 100}% · approval above {v.policy.approvalAbove * 100}% · enforced in code · plus{" "}
              <Link href="/app/policies" className="underline-offset-2 hover:text-bone hover:underline">
                your deal policies
              </Link>
            </div>
          </Panel>
          <Panel title="People">
            <ul className="space-y-3.5">
              {a.contacts.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px]">
                      {c.name}
                      {c.isChampion && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-signal">champion</span>}
                      {c.isExecSponsor && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ash">exec</span>}
                    </div>
                    <div className="text-[12px] text-ash">{c.role}</div>
                  </div>
                  <span className={`font-mono text-[11px] ${c.bounced ? "text-signal" : c.lastActiveDaysAgo > 14 ? "text-bone" : "text-ash"}`}>
                    {c.bounced ? "email bouncing" : c.lastActiveDaysAgo === 0 ? "active today" : `${c.lastActiveDaysAgo}d ago`}
                  </span>
                </li>
              ))}
            </ul>
            {champ?.bounced && <p className="mt-4 text-[12.5px] text-ash">Champion has likely left. Clutch will re-thread through the most active remaining user.</p>}
          </Panel>
            </div>
            <div className="min-w-0 space-y-5">
          <Panel
            title="Weekday active users · 26 weeks"
            right={<Mono className={usageAlarm ? "text-signal" : "text-volt"}>last 6 weeks {usageAlarm ? "· declining" : "· steady"}</Mono>}
          >
            <UsageChart weeks={v.weeks} seats={a.seats} alarm={usageAlarm} />
          </Panel>

          <Panel title="Contract · read by Clutch" right={<Mono>msa.pdf · 4 pages</Mono>}>
            <div>
              <div className="flex items-baseline justify-between">
                <Mono>Notice window</Mono>
                <span className={`font-mono text-[12px] ${h.daysToNotice < 15 ? "text-signal" : "text-bone"}`}>
                  {h.daysToNotice < 0 ? "closed" : `closes in ${h.daysToNotice} days`}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-line">
                <motion.div className="h-full rounded-full bg-signal" initial={{ width: 0 }} animate={{ width: `${noticePct * 100}%` }} transition={{ duration: 1.2 }} />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {a.contract.clauses.map((c) => (
                <button key={c.key} onClick={() => setClause(c.key)} className={`bg-carbon p-3 text-left transition ${clause === c.key ? "bg-ink" : "hover:bg-ink/50"}`}>
                  <Mono className={clause === c.key ? "text-signal" : "text-ash"}>{c.label}</Mono>
                  <div className="mt-1 text-[14px]">{c.value}</div>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {activeClause && (
                <motion.blockquote
                  key={activeClause.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 border-l-2 border-signal pl-4 font-serif text-[17px] italic leading-snug text-bone/90"
                >
                  “{activeClause.quote}”
                  <footer className="mt-1 font-mono text-[10.5px] not-italic text-ash">page {activeClause.page}</footer>
                </motion.blockquote>
              )}
            </AnimatePresence>
          </Panel>

          <Panel title="Conversations" pad={false}>
            <ul>
              {[
                ...a.tickets.map((t) => ({ id: t.id, at: t.openedDaysAgo, head: `#${t.number} · ${t.priority} · ${t.status}`, title: t.subject, body: t.body, s: t.sentiment, comp: t.competitor })),
                ...a.emails.map((e) => ({ id: e.id, at: e.daysAgo, head: `email · ${e.from}`, title: e.subject, body: e.body, s: e.sentiment, comp: undefined as string | undefined })),
              ]
                .sort((x, y) => x.at - y.at)
                .map((c) => (
                  <li key={c.id} className="border-b border-line px-5 py-4 last:border-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <Mono>{c.head}</Mono>
                      <span className="font-mono text-[10.5px] text-ash">{c.at}d ago</span>
                    </div>
                    <div className="mt-1 text-[14px]">{c.title}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ash">
                      {c.comp ? (
                        <>
                          {c.body.split(c.comp)[0]}
                          <mark className="rounded bg-signal/20 px-1 text-signal">{c.comp}</mark>
                          {c.body.split(c.comp)[1]}
                        </>
                      ) : (
                        c.body
                      )}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1 w-16 rounded-full bg-line">
                        <div className="h-full rounded-full" style={{ width: `${((c.s + 1) / 2) * 100}%`, background: c.s < -0.3 ? "#ff5a1f" : c.s > 0.3 ? "#d7ff3d" : "#8c877d" }} />
                      </div>
                      <span className="font-mono text-[10px] text-ash">sentiment {c.s > 0 ? "+" : ""}{c.s.toFixed(2)}</span>
                    </div>
                  </li>
                ))}
            </ul>
          </Panel>
            </div>
          </div>
        </div>
        <div className="min-w-0 space-y-5 xl:col-span-4">
          {run && (
            <div id="live-run" className="scroll-mt-20">
              <Panel
                title={run.status === "running" || run.status === "waiting" ? "● Live pipeline · agent working" : "Play run"}
                right={<span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash">{run.steps.filter((x) => x.status === "done").length}/{run.steps.length} steps · {v.artifacts.filter((x) => x.runId === run.id && x.sent).length} emails sent</span>}
                className={run.status === "running" || run.status === "waiting" ? "border-signal/50 shadow-[0_0_40px_-12px_rgba(255,90,31,0.5)]" : ""}
              >
                <RunTimeline run={run} artifacts={v.artifacts} />
              </Panel>
            </div>
          )}
          <Panel title="Next move">
            <PlayPicker v={v} />
          </Panel>
          <SentPanel items={v.artifacts} />
          <Panel title="Activity" pad={false}>
            <Feed events={events} accountFilter={a.id} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
