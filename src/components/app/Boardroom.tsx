"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import type { Brief, Citation } from "@/lib/boardroom";
import { inr, inrCompact } from "@/lib/format";
import { Loading } from "./CommandCenter";
import { I } from "./icons";
import { useApi } from "./live";
import { MailAction } from "./MailButton";
import { Btn, Mono, page, PageHeader, Panel } from "./ui";

const KIND: Record<Citation["kind"], { label: string; tone: string }> = {
  clause: { label: "Contract clause", tone: "bg-[#efe6d4] text-[#6b5320]" },
  ticket: { label: "Support ticket", tone: "bg-[#ffe3d8] text-[#a8360c]" },
  email: { label: "Email", tone: "bg-[#e6e9f5] text-[#34437a]" },
  invoice: { label: "Invoice", tone: "bg-[#ffe3d8] text-[#a8360c]" },
  metric: { label: "Metric", tone: "bg-[#e3efe2] text-[#2f5d2a]" },
  contact: { label: "CRM record", tone: "bg-[#ece6f3] text-[#5a3d80]" },
  rule: { label: "Policy rule", tone: "bg-[#ebeae6] text-[#3a3833]" },
  log: { label: "Log entry", tone: "bg-[#ebeae6] text-[#3a3833]" },
};

/** Download through fetch so the button can show progress and the file name the server picked. */
async function download(format: "pdf" | "md" | "csv") {
  const r = await fetch(`/api/boardroom/export?format=${format}&fresh=1`);
  const blob = await r.blob();
  const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? `boardroom-brief.${format}`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** The one-click button, reused on the command center and the policies page. */
export function ExportBrief({ compact }: { compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const go = async (f: "pdf" | "md" | "csv") => {
    setBusy(f);
    setOpen(false);
    try {
      await download(f);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="relative flex">
      <button
        data-testid="export-brief"
        onClick={() => go("pdf")}
        disabled={!!busy}
        className="inline-flex items-center gap-2 rounded-l-full border border-r-0 border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition hover:border-ash disabled:opacity-60"
      >
        <I.doc width={13} height={13} />
        {busy ? `Compiling ${busy.toUpperCase()}…` : compact ? "Board brief" : "Export board brief"}
      </button>
      <button aria-label="More formats" onClick={() => setOpen((o) => !o)} className="rounded-r-full border border-line px-2.5 text-ash transition hover:border-ash hover:text-bone">
        ▾
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-carbon shadow-2xl">
            {(
              [
                ["pdf", "PDF", "designed, print-ready"],
                ["md", "Markdown", "for Notion, GitHub, email"],
                ["csv", "CSV", "every item + citation, for Excel"],
              ] as const
            ).map(([f, l, d]) => (
              <button key={f} onClick={() => go(f)} className="block w-full px-4 py-2.5 text-left hover:bg-line/50">
                <div className="text-[13px]">{l}</div>
                <div className="text-[11.5px] text-ash">{d}</div>
              </button>
            ))}
            <Link href="/app/brief" className="block border-t border-line px-4 py-2.5 text-[12.5px] text-ash hover:bg-line/50 hover:text-bone">
              Preview the brief →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Cite({ id, onPick, cites }: { id: string; onPick: (id: string) => void; cites: Map<string, Citation> }) {
  const c = cites.get(id);
  return (
    <button onClick={() => onPick(id)} title={c ? `${KIND[c.kind].label} — ${c.source}\n${c.detail}` : id} className="mx-0.5 inline-flex items-center rounded-[5px] bg-[#ff5a1f]/12 px-1.5 align-[1px] font-mono text-[10px] font-semibold text-[#c2410c] transition hover:bg-[#ff5a1f] hover:text-white">
      {id}
    </button>
  );
}

export function Boardroom() {
  const { data: b, refresh } = useApi<Brief>("/api/boardroom");
  const [busy, setBusy] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  if (!b) return <Loading />;
  const cites = new Map(b.citations.map((c) => [c.id, c]));
  const pick = (id: string) => {
    setHot(id);
    document.getElementById(`src-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHot((h) => (h === id ? null : h)), 2600);
  };
  const regenerate = async () => {
    setBusy("regen");
    try {
      await fetch("/api/boardroom", { method: "POST" });
      await refresh();
    } finally {
      setBusy(null);
    }
  };
  const dl = async (f: "pdf" | "md" | "csv") => {
    setBusy(f);
    try {
      await download(f);
      await refresh();
    } finally {
      setBusy(null);
    }
  };
  const i = b.impact;
  const byKind = b.citations.reduce<Record<string, number>>((t, c) => ((t[c.kind] = (t[c.kind] ?? 0) + 1), t), {});

  return (
    <div className={page}>
      <PageHeader
        eyebrow="Overview · board reporting"
        title="Boardroom brief"
        subtitle="One click compiles the current run into an executive summary. Every figure and every flag is traced to the exact record that proves it."
        actions={
          <>
            <Btn onClick={regenerate} disabled={!!busy}>
              <I.refresh width={13} height={13} className={busy === "regen" ? "animate-spin" : ""} /> {busy === "regen" ? "Compiling…" : "Recompile"}
            </Btn>
            <MailAction endpoint="/api/mail/brief" label="Email brief + PDF" testId="mail-brief" />
            <Btn onClick={() => dl("md")} disabled={!!busy}>
              {busy === "md" ? "…" : "Markdown"}
            </Btn>
            <Btn onClick={() => dl("csv")} disabled={!!busy}>
              {busy === "csv" ? "…" : "CSV"}
            </Btn>
            <Btn tone="primary" onClick={() => dl("pdf")} disabled={!!busy}>
              <I.doc width={13} height={13} /> {busy === "pdf" ? "Compiling PDF…" : "Export PDF"}
            </Btn>
          </>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------- the paper ---------------- */}
        <article data-testid="brief-paper" className="overflow-hidden rounded-[22px] bg-[#fbfaf7] text-[#1d1c1a] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]">
          <header className="relative bg-[#0b0b0a] px-8 pb-7 pt-7 text-[#eee9df]">
            <div className="flex items-center justify-between">
              <span className="text-[20px] font-semibold tracking-[-0.04em]">
                clutch<span className="text-[#ff5a1f]">.</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8c877d]">Boardroom brief</span>
            </div>
            <h2 className="mt-6 text-[28px] font-semibold leading-tight tracking-[-0.035em]">Renewal risk — executive summary</h2>
            <p className="mt-1.5 text-[13px] text-[#bdb7ac]">
              {b.workspace} · {b.processed.accounts} accounts · generated {b.generatedLabel} IST
            </p>
            <p className="mt-0.5 text-[12px] text-[#8c877d]">
              Current run: audit #{b.run.auditN} · policies v{b.run.rulesVersion} ({b.run.file}) · {b.citations.length} cited sources
            </p>
            <span className="absolute bottom-0 left-0 h-[3px] w-[38%] bg-[#ff5a1f]" />
          </header>

          <div className="space-y-8 px-8 py-7">
            <div className="grid gap-3 sm:grid-cols-4">
              {(
                [
                  ["ARR at risk", inrCompact(i.arrAtRisk), `${i.atRiskCount} accounts, next 120 days`, true],
                  ["Expected loss", inrCompact(i.expectedLoss), "risk × ARR if no action", true],
                  ["Renewing in 120 days", inrCompact(i.arrUpForRenewal), `${i.renewalsIn120} renewals`, false],
                  ["Open exceptions", String(i.exceptionsOpen), `${i.bySeverity.critical} critical · ${i.bySeverity.high} high`, false],
                ] as const
              ).map(([l, v, s, hotTile]) => (
                <div key={l} className={`rounded-xl border p-3.5 ${hotTile ? "border-[#ff5a1f]/50 bg-[#fff1ea]" : "border-[#e2ddd3] bg-[#f4f1ea]"}`}>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#6e6a61]">{l}</div>
                  <div className={`mt-2 text-[26px] font-semibold leading-none tracking-[-0.04em] ${hotTile ? "text-[#e14a12]" : ""}`}>{v}</div>
                  <div className="mt-1.5 text-[11.5px] text-[#6e6a61]">{s}</div>
                </div>
              ))}
            </div>
            <p className="-mt-4 text-[12px] leading-relaxed text-[#6e6a61]">
              <b className="text-[#1d1c1a]">Items processed: {b.processed.total.toLocaleString("en-IN")} records</b> — {b.processed.contracts} contracts ({b.processed.clauses} clauses), {b.processed.usageDays.toLocaleString("en-IN")} usage-days, {b.processed.tickets} tickets, {b.processed.emails} emails, {b.processed.invoices} invoices,{" "}
              {b.processed.contacts} contacts · {b.processed.checks} policy checks ({b.processed.rules} rules × {b.processed.accounts} accounts).
            </p>

            <section>
              <h3 className="border-b border-[#e2ddd3] pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">Executive summary</h3>
              <p className="mt-3 text-[15px] leading-[1.65]">{b.summary.text}</p>
              <p className="mt-2 text-[11.5px] italic text-[#8c877d]">{b.summary.model ? `Narrative by ${b.summary.model}; every number verified against the computed figures.` : "Narrative generated from the computed figures."}</p>
            </section>

            <section>
              <h3 className="border-b border-[#e2ddd3] pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">Top {b.top3.length} urgent exceptions</h3>
              <ol className="mt-4 space-y-6">
                {b.top3.map((t) => (
                  <li key={t.accountId} data-testid="urgent" className="relative pl-10">
                    <span className="absolute left-0 top-0.5 grid h-7 w-7 place-items-center rounded-full bg-[#ff5a1f] text-[13px] font-bold text-white">{t.rank}</span>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/app/accounts/${t.accountId}`} className="text-[18px] font-semibold tracking-[-0.02em] hover:text-[#e14a12]">
                        {t.name}
                      </Link>
                      <span className="text-[13.5px] font-semibold text-[#e14a12]">
                        {inrCompact(t.arr)} ARR · risk {t.risk}/100
                      </span>
                    </div>
                    <div className="text-[12px] text-[#6e6a61]">
                      {t.industry} · renews {t.renewalDate} · notice deadline {t.noticeBy} ({t.daysToNotice >= 0 ? `in ${t.daysToNotice} days` : "passed"}) · expected loss {inr(t.expectedLoss)}
                    </div>
                    <div className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e6a61]">Why it is flagged</div>
                    <ul className="mt-1 space-y-1 text-[13.5px] leading-relaxed">
                      {t.why.map((w, k) => (
                        <li key={k} className="flex gap-2">
                          <span className="text-[#ff5a1f]">•</span>
                          <span>
                            {w.text}
                            {w.cites.map((c) => (
                              <Cite key={c} id={c} onPick={pick} cites={cites} />
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {t.exceptions.length > 0 && (
                      <>
                        <div className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e6a61]">Policy exceptions</div>
                        <ul className="mt-1 space-y-1 text-[13.5px] leading-relaxed">
                          {t.exceptions.map((e) => (
                            <li key={e.ruleId} className="flex gap-2">
                              <span className="text-[#ff5a1f]">•</span>
                              <span>
                                <b className="font-mono text-[12px]">{e.ruleId}</b> {e.ruleName} <span className="text-[#8c877d]">({e.severity})</span> — {e.message}
                                {e.cite.split(",").map((c) => (
                                  <Cite key={c} id={c} onPick={pick} cites={cites} />
                                ))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <div className="mt-3 rounded-lg bg-[#f4f1ea] px-3 py-2 text-[13px]">
                      <b>Recommended:</b> {t.recommended}
                      <div className="text-[12px] text-[#6e6a61]">Status: {t.status}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h3 className="border-b border-[#e2ddd3] pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">All open exceptions ({b.exceptions.length})</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6e6a61]">
                    <tr className="border-b border-[#e2ddd3]">
                      <th className="py-2 pr-3">Severity</th>
                      <th className="py-2 pr-3">Rule</th>
                      <th className="py-2 pr-3">Account</th>
                      <th className="py-2 pr-3">Finding · evidence</th>
                      <th className="py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...b.exceptions]
                      .sort((x, y) => ["critical", "high", "medium", "low"].indexOf(x.severity) - ["critical", "high", "medium", "low"].indexOf(y.severity) || y.arr - x.arr)
                      .map((e) => (
                        <tr key={e.key} className="border-b border-[#eeeae2] align-top">
                          <td className={`py-2 pr-3 font-medium ${e.severity === "critical" || e.severity === "high" ? "text-[#e14a12]" : "text-[#6e6a61]"}`}>{e.severity}</td>
                          <td className="py-2 pr-3 font-mono text-[11.5px]">{e.ruleId}</td>
                          <td className="py-2 pr-3">{e.accountName}</td>
                          <td className="py-2 pr-3">
                            {e.message}
                            <div className="font-mono text-[10.5px] text-[#8c877d]">{e.evidence.map((x) => `${x.field} = ${x.actual}`).join(" · ")}</div>
                          </td>
                          <td className="py-2">
                            <Cite id={e.cite} onPick={pick} cites={cites} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="border-b border-[#e2ddd3] pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">Sources — exact citations</h3>
              <ol className="mt-3 space-y-2.5">
                {b.citations.map((c) => (
                  <li key={c.id} id={`src-${c.id}`} data-testid="source" className={`grid grid-cols-[40px_minmax(0,1fr)] gap-2 rounded-lg px-2 py-1.5 transition-colors duration-500 ${hot === c.id ? "bg-[#ffe3d8]" : ""}`}>
                    <span className="font-mono text-[12px] font-bold text-[#e14a12]">[{c.id}]</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] ${KIND[c.kind].tone}`}>{KIND[c.kind].label}</span>
                        <span className="text-[12.5px] font-semibold">{c.source}</span>
                      </div>
                      <div className="mt-0.5 text-[12.5px]">{c.detail}</div>
                      {c.quote && <div className="mt-0.5 border-l-2 border-[#e2ddd3] pl-2 text-[12px] italic text-[#6e6a61]">“{c.quote}”</div>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <footer className="flex flex-wrap justify-between gap-2 border-t border-[#e2ddd3] px-8 py-3 font-mono text-[10px] text-[#8c877d]">
            <span>
              {b.id} · audit #{b.run.auditN}
            </span>
            <span>fingerprint {b.fingerprint}</span>
          </footer>
        </article>

        {/* ---------------- sidebar ---------------- */}
        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel title="What’s in it">
            <ul className="space-y-2.5 text-[13px]">
              {[
                ["Total items processed", `${b.processed.total.toLocaleString("en-IN")} records · ${b.processed.checks} checks`],
                ["Quantified impact", `${inrCompact(i.arrAtRisk)} at risk · ${inrCompact(i.expectedLoss)} expected loss`],
                ["Top 3 urgent exceptions", b.top3.map((t) => t.name).join(", ")],
                ["Exact source citations", `${b.citations.length} sources, every flag linked`],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-volt text-[9px] text-ink">✓</span>
                  <span>
                    <span className="text-bone">{k}</span>
                    <span className="block text-[12px] text-ash">{v}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Citations by type">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(byKind).map(([k, n]) => (
                <span key={k} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ash">
                  {KIND[k as Citation["kind"]].label} <span className="font-mono text-bone">{n}</span>
                </span>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-ash">Click any orange [S#] in the brief to jump to its source.</p>
          </Panel>
          <Panel title="The run it compiles">
            <dl className="space-y-1.5 text-[12.5px]">
              {[
                ["Audit", `#${b.run.auditN} (${b.run.trigger})`],
                ["Policies", `v${b.run.rulesVersion} · ${b.run.file}`],
                ["Compiled in", `${b.run.ms} ms`],
                ["Narrative", b.summary.model ? `${b.summary.model} · numbers verified` : "template"],
                ["Fingerprint", b.fingerprint],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ash">{k}</dt>
                  <dd className="truncate text-right font-mono text-[11.5px]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ash">
              Change a rule or close a deal, then <button onClick={regenerate} className="text-signal hover:underline">recompile</button> — the brief always reflects the latest run.
            </p>
          </Panel>
          <div className="px-1">
            <Mono>Also: the Export button on the command center and policies pages</Mono>
          </div>
        </aside>
      </div>
    </div>
  );
}
