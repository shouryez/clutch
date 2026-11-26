"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import type { clusters, resolvedIssues } from "@/lib/bugs";
import { inrCompact } from "@/lib/format";
import { ArtifactView } from "./Artifact";
import { Loading } from "./CommandCenter";
import { post, useApi } from "./live";
import { Btn, Mono, page, PageHeader, Panel, tierColor } from "./ui";

type Cluster = ReturnType<typeof clusters>[number];
type Resolved = ReturnType<typeof resolvedIssues>[number];

const HOW = [
  { n: "1", t: "Cluster", d: "Every open ticket, email and cancellation reason is grouped by root cause — seven tickets that say “export keeps failing” become one bug." },
  { n: "2", t: "Price it", d: "Each bug is priced by the ARR of the accounts reporting it, and by how many of them renew in the next 90 days." },
  { n: "3", t: "File it", d: "One click files a P0 with the money, the accounts and the customers' own words attached — so engineering sorts by revenue, not by noise." },
  { n: "4", t: "Close the loop", d: "When the issue closes, Clutch emails every affected customer that it's fixed, closes their tickets and re-scores their renewal risk." },
];

function Draft({ c }: { c: Cluster }) {
  return (
    <ArtifactView
      a={{ id: "draft", at: 0, kind: "issue", mode: "live", title: `[draft] ${c.draft.title}`, to: "helpdeck/core", body: c.draft.body, meta: [["Labels", c.draft.labels.join(", ")], ["Assignee", "eng-oncall"]] }}
    />
  );
}

export function RadarView() {
  const { data, refresh } = useApi<{ clusters: Cluster[]; resolved: Resolved[] }>("/api/radar");
  const [busy, setBusy] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  if (!data) return <Loading />;
  const list = data.clusters;
  const c = list.find((x) => x.topic === sel) ?? list[0];
  const max = Math.max(...list.map((x) => x.arr), 1);
  const totalArr = list.reduce((t, x) => t + x.arr, 0);

  const act = async (topic: string, action: "file" | "ship") => {
    setBusy(topic + action);
    try {
      await post("/api/radar", { topic, action });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={page}>
      <PageHeader
        eyebrow="Intelligence"
        title="Revenue bug radar"
        subtitle="Which bugs are costing renewals, priced in ARR — filed to engineering with the money attached, and closed out with every customer who reported them."
        actions={<Mono>{list.length} open clusters · {inrCompact(totalArr)} blocked</Mono>}
      />

      <section className="mt-5 grid gap-3 md:grid-cols-4">
        {HOW.map((h) => (
          <div key={h.n} className="rounded-2xl border border-line bg-carbon p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-line font-mono text-[10.5px] text-signal">{h.n}</span>
              <span className="text-[14px] font-medium">{h.t}</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ash">{h.d}</p>
          </div>
        ))}
      </section>

      {c && (
        <section className="mt-5 grid gap-5 xl:grid-cols-12">
          <div className="min-w-0 space-y-5 xl:col-span-7">
            <Panel title="Bugs ranked by ARR they block" pad={false}>
              <ul>
                {list.map((x) => (
                  <li key={x.topic}>
                    <button
                      onClick={() => {
                        setSel(x.topic);
                        setPreview(false);
                      }}
                      className={`grid w-full items-center gap-x-4 gap-y-1.5 border-b border-line px-5 py-3.5 text-left transition last:border-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_76px_92px] ${x.topic === c.topic ? "bg-ink/70" : "hover:bg-ink/40"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px]">{x.title}</span>
                        <span className="block text-[11.5px] text-ash">
                          {x.accounts.length} accounts · {x.renewalsIn90} renew ≤ 90d
                        </span>
                      </span>
                      <span className="h-2 rounded-full bg-line">
                        <motion.span
                          className="block h-full rounded-full"
                          style={{ background: x === list[0] ? "#ff5a1f" : "#eee9df" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(x.arr / max) * 100}%` }}
                          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </span>
                      <span className="text-right font-mono text-[13px] tabular-nums">{inrCompact(x.arr)}</span>
                      <span className="text-right font-mono text-[10.5px] uppercase tracking-[0.1em]">
                        {x.issue ? <span className="text-volt">#{x.issue.number} filed</span> : <span className="text-ash">not filed</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title={`Who reported it · ${c.title}`} pad={false}>
              <ul>
                {c.accounts.map((a, i) => (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 border-b border-line px-5 py-3 last:border-0"
                  >
                    <Link href={`/app/accounts/${a.id}`} className="flex items-center gap-2 text-[14px] hover:text-signal">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tierColor(a.tier as "critical") }} />
                      {a.name}
                    </Link>
                    <span className="font-mono text-[13px] tabular-nums">{inrCompact(a.arr)}</span>
                    <span className="text-[12.5px] text-ash">
                      #{a.ticket} · “{a.quote}”
                    </span>
                    <span className={`text-right font-mono text-[11px] ${a.daysToRenewal <= 90 ? "text-signal" : "text-ash"}`}>renews {a.daysToRenewal}d · risk {a.risk}</span>
                  </motion.li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="min-w-0 space-y-5 xl:col-span-5">
            <div className="rounded-[20px] border border-line bg-carbon p-6">
              <Mono>{c.issue ? `Filed as #${c.issue.number}` : "Not filed yet"}</Mono>
              <div className="mt-3 text-[clamp(2.6rem,4.6vw,4rem)] font-medium leading-[0.9] tracking-[-0.06em] text-signal">{inrCompact(c.arr)}</div>
              <p className="mt-2 text-[15px] leading-snug">
                of ARR is reporting <span className="serif-i">one</span> bug: {c.title.toLowerCase()}.
              </p>
              <p className="mt-1 text-[12.5px] text-ash">
                {c.accounts.length} accounts · {c.renewalsIn90} renew within 90 days · avg risk {Math.round(c.accounts.reduce((t, a) => t + a.risk, 0) / c.accounts.length)}
              </p>

              {!c.issue ? (
                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Btn tone="primary" disabled={busy === c.topic + "file"} onClick={() => act(c.topic, "file")}>
                      {busy === c.topic + "file" ? "Filing…" : "File P0 with ₹ attached →"}
                    </Btn>
                    <Btn onClick={() => setPreview((x) => !x)}>{preview ? "Hide draft" : "Preview the issue"}</Btn>
                  </div>
                  <p className="text-[12px] leading-relaxed text-ash">Files to GitHub with labels P0 · revenue-at-risk, the ARR table and the customers’ words. Plays and the voice agent link to it automatically.</p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-signal" />
                    Open · Clutch is watching for it to close
                  </div>
                  <Btn tone="volt" disabled={busy === c.topic + "ship"} onClick={() => act(c.topic, "ship")}>
                    {busy === c.topic + "ship" ? "Telling customers…" : "Fix shipped → close the loop"}
                  </Btn>
                  <p className="text-[12px] leading-relaxed text-ash">
                    This is the GitHub “issue closed” webhook. Clutch will email all {c.accounts.length} customers that it’s fixed, close their tickets and re-score their risk.
                  </p>
                </div>
              )}
            </div>
            <AnimatePresence>
              {(preview || c.issue) && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {c.issue ? (
                    <ArtifactView a={{ id: "iss", at: c.issue.at, kind: "issue", mode: c.issue.mode, title: `#${c.issue.number} ${c.issue.title}`, to: "helpdeck/core", body: c.issue.body, meta: [["Labels", "P0, revenue-at-risk, customer-reported"]] }} />
                  ) : (
                    <Draft c={c} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      )}

      {!list.length && <div className="mt-8 rounded-2xl border border-line bg-carbon p-8 text-center text-[14px] text-ash">No open revenue bugs. Every reported issue has been fixed and its customers told.</div>}

      {data.resolved.length > 0 && (
        <Panel className="mt-5" title="Loop closed · fixed and customers told" pad={false}>
          {data.resolved.map((r) => (
            <div key={r.number} className="border-b border-line px-5 py-4 last:border-0">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-[14px]">
                  <span className="font-mono text-volt">#{r.number}</span> {r.title}
                </span>
                <span className="font-mono text-[11px] text-ash">
                  {r.notified?.length} customers emailed · risk −{(r.notified ?? []).reduce((t, n) => t + n.before - n.after, 0)} pts total
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(r.notified ?? []).map((n) => (
                  <Link key={n.id} href={`/app/accounts/${n.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 hover:border-ash">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">{n.name}</span>
                      <span className="block truncate text-[11px] text-ash">told {n.contact}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[12px] tabular-nums">
                      <span className="text-ash">{n.before}</span> → <span className="text-volt">{n.after}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
