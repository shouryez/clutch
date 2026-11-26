"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import type { contractsView, Extracted } from "@/lib/contracts";
import { inr, inrCompact } from "@/lib/format";
import { Loading } from "./CommandCenter";
import { post, useApi } from "./live";
import { Btn, Mono, page, PageHeader, Panel, Stat, TierBadge } from "./ui";

type Row = ReturnType<typeof contractsView>[number];
type Result = { extracted: Extracted; risks: string[]; model: string; ms: number; noticeBy: string; daysToRenewal: number };

const FILTERS = [
  ["all", "All"],
  ["notice30", "Notice ≤ 30 days"],
  ["auto", "Auto-renews"],
  ["manual", "Needs a signature"],
] as const;

function highlight(text: string, quotes: string[]) {
  const spans: [number, number][] = [];
  for (const q of quotes) {
    const i = q ? text.indexOf(q) : -1;
    if (i >= 0) spans.push([i, i + q.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let at = 0;
  spans.forEach(([s, e], k) => {
    if (s < at) return;
    out.push(<Fragment key={`t${k}`}>{text.slice(at, s)}</Fragment>);
    out.push(
      <mark key={`m${k}`} className="rounded bg-signal/20 px-0.5 text-bone">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return out;
}

function Reader({ sample, onImported }: { sample: string; onImported: (id: string) => void }) {
  const [text, setText] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState<"" | "read" | "import">("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: string; created: boolean } | null>(null);
  const x = res?.extracted;
  const fields: [string, string, keyof Extracted["evidence"]][] = x
    ? [
        ["Customer", x.customer, "customer"],
        ["Effective date", x.effectiveDate, "effectiveDate"],
        ["Term", `${x.termMonths} months → renews ${x.endDate}`, "termMonths"],
        ["Notice period", `${x.noticeDays} days → notice by ${res!.noticeBy}`, "noticeDays"],
        ["Auto-renew", x.autoRenew ? "Yes" : "No — needs a signature", "autoRenew"],
        ["Renewal uplift", `up to ${x.upliftPct}%`, "upliftPct"],
        ["Seats · plan", `${x.seats} × ${x.plan}`, "seats"],
        ["Price", `${inr(x.pricePerSeatMonth)}/seat/mo · ${inrCompact(x.seats * x.pricePerSeatMonth * 12)} ARR`, "price"],
        ["Payment", x.paymentTerms, "paymentTerms"],
      ]
    : [];
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel
        title="Contract text"
        right={
          <button onClick={() => (setText(sample), setRes(null), setDone(null))} className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-signal hover:underline">
            use a sample MSA
          </button>
        }
      >
        {res ? (
          <pre className="max-h-[440px] overflow-y-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-bone/75">{highlight(text, Object.values(x!.evidence).filter(Boolean) as string[])}</pre>
        ) : (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} placeholder="Paste an MSA, order form or renewal letter…" className="w-full resize-none rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-[12px] leading-relaxed outline-none placeholder:text-ash focus:border-ash" />
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[12px] text-signal">{err}</span>
          {res ? (
            <Btn onClick={() => (setRes(null), setDone(null))}>Edit text</Btn>
          ) : (
            <Btn
              tone="primary"
              disabled={busy !== "" || text.trim().length < 80}
              onClick={async () => {
                setBusy("read");
                setErr("");
                try {
                  setRes(await post<Result>("/api/contracts/extract", { text }));
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy("");
                }
              }}
            >
              {busy === "read" ? "Reading…" : "Read contract →"}
            </Btn>
          )}
        </div>
      </Panel>

      <Panel title="What Clutch extracted" right={res ? <Mono>{res.model} · {(res.ms / 1000).toFixed(1)}s</Mono> : undefined} pad={false}>
        {!res ? (
          <div className="px-6 py-14 text-center text-[13px] leading-relaxed text-ash">
            Renewal date, notice deadline, auto-renew, uplift cap, seats and price — each with the sentence it came from,
            <br />
            highlighted in the text so you can check it.
          </div>
        ) : (
          <div>
            <dl>
              {fields.map(([k, v, ev], i) => (
                <motion.div key={k} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="grid grid-cols-[120px_1fr] gap-3 border-b border-line px-5 py-2.5">
                  <dt className="text-[12px] text-ash">{k}</dt>
                  <dd>
                    <div className="text-[13.5px]">{v}</div>
                    {x!.evidence[ev] && <div className="mt-0.5 line-clamp-2 font-serif text-[13px] italic text-bone/55">“{x!.evidence[ev]}”</div>}
                  </dd>
                </motion.div>
              ))}
            </dl>
            {res.risks.length > 0 && (
              <div className="border-b border-line px-5 py-3.5">
                <Mono className="text-signal">Clauses that matter at renewal</Mono>
                <ul className="mt-2 space-y-1">
                  {res.risks.map((r) => (
                    <li key={r} className="flex gap-2 text-[12.5px] text-bone/85">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              {done ? (
                <>
                  <span className="text-[13px] text-volt">{done.created ? "Added as a new account." : "Contract updated on the account."} Risk scored.</span>
                  <Link href={`/app/accounts/${done.id}`} className="rounded-full bg-bone px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
                    Open account →
                  </Link>
                </>
              ) : (
                <>
                  <span className="text-[12px] text-ash">Adds the renewal and notice deadline to the pipeline and starts watching the account.</span>
                  <Btn
                    tone="volt"
                    disabled={busy !== ""}
                    onClick={async () => {
                      setBusy("import");
                      try {
                        const r = await post<{ id: string; created: boolean }>("/api/contracts/import", { extracted: x });
                        setDone(r);
                        onImported(r.id);
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    {busy === "import" ? "Adding…" : "Add to Clutch"}
                  </Btn>
                </>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function Contracts() {
  const { data, refresh } = useApi<{ contracts: Row[]; sample: string }>("/api/contracts");
  const [f, setF] = useState<(typeof FILTERS)[number][0]>("all");
  const [open, setOpen] = useState(false);
  if (!data) return <Loading />;
  const all = data.contracts;
  const list = all
    .filter((c) => (f === "notice30" ? c.daysToNotice >= 0 && c.daysToNotice <= 30 : f === "auto" ? c.autoRenew : f === "manual" ? !c.autoRenew : true))
    .sort((x, y) => (x.daysToNotice < 0 ? 999 : x.daysToNotice) - (y.daysToNotice < 0 ? 999 : y.daysToNotice));
  const closing = all.filter((c) => c.daysToNotice >= 0 && c.daysToNotice <= 30);
  return (
    <div className={page}>
      <PageHeader
        eyebrow="Overview"
        title="Contracts"
        subtitle="Every contract's renewal mechanics — renewal date, notice deadline, auto-renew and uplift — read from the paper, not typed into a CRM. Paste a new one and Clutch reads it."
        actions={
          <Btn tone="primary" onClick={() => setOpen((x) => !x)}>
            {open ? "Close reader" : "+ Read a contract"}
          </Btn>
        }
      />
      <AnimatePresence>
        {open && (
          <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="pt-5">
              <Reader sample={data.sample} onImported={() => refresh()} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contracts" value={String(all.length)} sub={`${inrCompact(all.reduce((t, c) => t + c.arr, 0))} ARR under contract`} />
        <Stat label="Notice closing ≤ 30d" value={String(closing.length)} sub={inrCompact(closing.reduce((t, c) => t + c.arr, 0))} tone="risk" />
        <Stat label="Auto-renewing" value={String(all.filter((c) => c.autoRenew).length)} sub={`${all.filter((c) => !c.autoRenew).length} need a signature`} />
        <Stat label="Avg uplift clause" value={`${(all.reduce((t, c) => t + c.upliftPct, 0) / all.length).toFixed(1)}%`} sub="price increase allowed at renewal" tone="good" />
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setF(k)} className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition ${f === k ? "bg-bone text-ink" : "border border-line text-ash hover:text-bone"}`}>
            {l}
          </button>
        ))}
      </div>

      <Panel className="mt-4" pad={false} title={`${list.length} contracts · sorted by notice deadline`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {["Customer", "ARR", "Renews", "Notice by", "Auto-renew", "Uplift", "Term", "Payment"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[9.5px] font-normal uppercase tracking-[0.16em] text-ash">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="group border-b border-line/70 last:border-0 hover:bg-ink/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/app/accounts/${c.id}`} className="group-hover:text-signal">
                      <span className="block font-medium">{c.name}</span>
                    </Link>
                    <span className="flex items-center gap-2">
                      <TierBadge tier={c.tier} />
                      {c.imported && <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-volt">imported</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">{inrCompact(c.arr)}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] tabular-nums">
                    {c.end}
                    <span className="block text-[10.5px] text-ash">{c.renewed ? "renewed" : `in ${c.daysToRenewal}d`}</span>
                  </td>
                  <td className={`px-4 py-2.5 font-mono text-[12px] tabular-nums ${c.daysToNotice >= 0 && c.daysToNotice <= 30 ? "text-signal" : ""}`}>
                    {c.noticeBy}
                    <span className="block text-[10.5px] text-ash">{c.daysToNotice < 0 ? "passed" : `${c.daysToNotice}d left · ${c.noticeDays}d clause`}</span>
                  </td>
                  <td className="px-4 py-2.5">{c.autoRenew ? <span className="text-volt">Yes</span> : <span className="text-ash">No</span>}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">{c.upliftPct}%</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">{c.termMonths} mo</td>
                  <td className="px-4 py-2.5 text-ash">{c.paymentTerms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
