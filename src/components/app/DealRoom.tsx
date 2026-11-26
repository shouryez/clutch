"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { inr, inrCompact } from "@/lib/format";
import type { dealView } from "@/lib/negotiator";
import { Loading } from "./CommandCenter";
import { post, usePublicUrl, useApi } from "./live";
import { Btn, Mono, page, Panel } from "./ui";

export type Deal = ReturnType<typeof dealView>;

const SUGGEST = ["We're looking at Freshdesk.", "Exports keep failing.", "Give us 25% off or we leave.", "12% and we sign today.", "15 percent karo na.", "Ok, send it."];

export function Ladder({ d }: { d: Deal }) {
  const s = d.session;
  return (
    <div className="space-y-1.5">
      {d.strategy.ladder.map((r, i) => {
        const cur = s.rung === i;
        const pending = s.pendingApproval && Math.abs(s.pendingApproval.discountPct - r.discountPct) < 1e-9;
        const passed = s.rung > i;
        const wasOffered = s.offered.includes(i);
        return (
          <div key={i} className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-lg px-3 py-2 ${cur ? "bg-bone text-ink" : pending ? "border border-signal/60" : ""}`}>
            <span className="font-mono text-[13px] tabular-nums">{Math.round(r.discountPct * 100)}%</span>
            <span className={`text-[12.5px] ${cur ? "" : passed ? "text-ash line-through" : "text-bone/80"}`}>
              {r.termMonths} mo{r.extras.length ? ` · ${r.extras.join(" + ")}` : ""}
            </span>
            <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${cur ? "text-ink/70" : r.needsApproval ? "text-signal" : "text-ash"}`}>
              {cur ? "on the table" : pending ? "awaiting approval" : passed ? (wasOffered ? "conceded" : "skipped") : r.needsApproval ? "needs approval" : ""}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-3 px-3 pt-1 font-mono text-[10.5px] text-signal">
        <span className="h-px flex-1 bg-signal/50" /> hard limit {Math.round(d.strategy.policy.maxDiscount * 100)}% · never crossed
      </div>
    </div>
  );
}

export function GuardLog({ d }: { d: Deal }) {
  const log = d.session.log;
  return (
    <div className="rounded-xl bg-[#0f0f0d] p-4 font-mono text-[11.5px] leading-[1.85]">
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-ash">dealdesk.ts — every offer passes here</div>
      {!log.length && <div className="text-ash">no offers yet</div>}
      <AnimatePresence initial={false}>
        {log.map((l, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap gap-x-2">
            <span className="text-ash">{l.fn}(</span>
            <span className="text-bone/80">{l.args}</span>
            <span className="text-ash">)</span>
            <span className={l.tone === "bad" ? "text-signal" : l.tone === "ok" ? "text-volt" : "text-bone"}>{l.result}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Approval({ d, onDone }: { d: Deal; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const p = d.session.pendingApproval;
  if (!p) return null;
  const act = async (approve: boolean) => {
    setBusy(true);
    await post(`/api/deal/${d.account.id}/approve`, { approve });
    setBusy(false);
    onDone?.();
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="rounded-2xl border border-volt/40 bg-volt/[0.06] p-4">
      <Mono className="text-volt">Slack · #deal-desk · for Meera (manager)</Mono>
      <div className="mt-1.5 text-[15px]">
        Approve {Math.round(p.discountPct * 100)}% for {d.account.name}? {inr(p.price)} · {p.termMonths} months
      </div>
      <div className="mt-3 flex gap-2">
        <Btn tone="volt" disabled={busy} onClick={() => act(true)}>Approve</Btn>
        <Btn disabled={busy} onClick={() => act(false)}>Deny</Btn>
      </div>
    </motion.div>
  );
}

export function SignCard({ d }: { d: Deal }) {
  const publicUrl = usePublicUrl();
  if (!d.offer) return null;
  const signed = d.offer.status === "signed";
  return (
    <div className={`flex items-center gap-4 rounded-2xl p-4 ${signed ? "bg-volt text-ink" : "border border-line bg-ink/60"}`}>
      {!signed && (
        <div className="rounded-lg bg-bone p-1.5">
          <QRCodeSVG value={publicUrl(`/sign/${d.offer.id}`)} size={76} bgColor="#eee9df" fgColor="#0b0b0a" />
        </div>
      )}
      <div>
        <Mono className={signed ? "text-ink/70" : "text-ash"}>{signed ? `Signed by ${d.offer.signedBy}` : "Order form sent"}</Mono>
        <div className="mt-1 text-lg font-medium tracking-[-0.03em]">
          {inr(d.offer.price)} · {d.offer.termMonths} mo
        </div>
        {!signed && (
          <a href={`/sign/${d.offer.id}`} target="_blank" className="text-[12.5px] text-ash underline underline-offset-4">
            open order form
          </a>
        )}
      </div>
    </div>
  );
}

export function DealRoom({ id }: { id: string }) {
  const { data: d, refresh } = useApi<Deal>(`/api/deal/${id}`);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const count = d?.session.messages.length ?? 0;
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [count]);

  if (!d) return <Loading />;
  const s = d.session;
  const send = async (t: string) => {
    if (!t.trim() || busy) return;
    setBusy(true);
    setText("");
    try {
      await post(`/api/deal/${id}`, { text: t, channel: "chat" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={page}>
      <Link href={`/app/accounts/${id}`} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash hover:text-bone">
        ← {d.account.name}
      </Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Mono>Deal room · {d.account.name} · {inrCompact(d.account.arr)} ARR</Mono>
          <h1 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.035em]">
            Try to <span className="serif-i text-signal">beat it.</span>
          </h1>
          <p className="mt-3 max-w-xl text-[14px] text-ash">
            You are {d.account.name}&apos;s buyer. Push for a discount, threaten to leave, switch to Hinglish. Clutch negotiates —
            inside lines written in code.
          </p>
        </div>
        <Btn onClick={async () => { await post(`/api/deal/${id}/reset`, { channel: "chat" }); await refresh(); }}>Restart negotiation</Btn>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-12">
        <section className="flex h-[calc(100vh-14rem)] min-h-[520px] flex-col rounded-[20px] border border-line bg-carbon xl:col-span-7">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <Mono>Thread · {s.contact.name} ↔ Clutch</Mono>
            <span className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em]">
              <span className={s.lang === "hi" ? "text-signal" : "text-ash"}>{s.lang === "hi" ? "Hinglish" : "English"}</span>
              <span className="text-ash">·</span>
              <span className="text-bone">{s.stage.replace("-", " ")}</span>
            </span>
          </div>
          <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
            <AnimatePresence initial={false}>
              {s.messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className={m.who === "system" ? "mx-auto max-w-[90%]" : `max-w-[78%] ${m.who === "clutch" ? "" : "ml-auto"}`}
                >
                  {m.who === "system" ? (
                    <div className="rounded-xl border border-volt/40 px-4 py-2.5 text-center font-mono text-[11.5px] text-volt">{m.text}</div>
                  ) : (
                    <>
                      <div className={`mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${m.who === "clutch" ? "text-signal" : "text-right text-ash"}`}>
                        {m.who === "clutch" ? "Clutch" : `${s.contact.name.split(" ")[0]} (you)`}
                      </div>
                      <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${m.who === "clutch" ? "bg-bone text-ink" : "border border-line"}`}>{m.text}</div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {busy && <div className="font-mono text-[11px] text-ash">Clutch is typing…</div>}
          </div>
          <div className="border-t border-line p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGEST.map((x) => (
                <button key={x} onClick={() => send(x)} disabled={busy || s.stage === "agreed"} className="rounded-full border border-line px-3 py-1 text-[12px] text-ash transition hover:border-ash hover:text-bone disabled:opacity-30">
                  {x}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
              className="flex gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={s.stage === "agreed" ? "Deal agreed — order form sent" : "Type as the customer… (English or Hinglish)"}
                className="flex-1 rounded-full border border-line bg-ink px-5 py-3 text-[14.5px] outline-none placeholder:text-ash focus:border-ash"
              />
              <Btn tone="primary" disabled={busy || !text.trim()}>Send</Btn>
            </form>
          </div>
        </section>

        <aside className="space-y-6 xl:col-span-5">
          <Approval d={d} onDone={refresh} />
          <SignCard d={d} />
          <Panel title="Strategy · private" right={<Mono className="text-signal">never shown to customer</Mono>}>
            <dl className="grid grid-cols-3 gap-4">
              {[
                ["List · per yr", inrCompact(d.strategy.listPrice)],
                ["Target · per yr", inrCompact(d.strategy.target / 2)],
                ["Floor · per yr", inrCompact(d.strategy.walkAway)],
              ].map(([k, v]) => (
                <div key={k}>
                  <Mono>{k}</Mono>
                  <dd className="mt-1 text-2xl font-medium tracking-[-0.04em] tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6">
              <Mono>Offer ladder</Mono>
              <div className="mt-3">
                <Ladder d={d} />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 font-mono text-[11.5px]">
              <div>
                <Mono>Gave</Mono>
                {(s.gave.length ? s.gave : ["—"]).map((g) => (
                  <div key={g} className="mt-1.5 text-bone">{g}</div>
                ))}
              </div>
              <div>
                <Mono>Got</Mono>
                {(s.got.length ? s.got : ["—"]).map((g) => (
                  <div key={g} className="mt-1.5 text-volt">{g}</div>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-2.5">
              <Mono>Leverage</Mono>
              {[
                ["Usage growth", d.strategy.leverage.usageGrowth],
                ["Switching cost", d.strategy.leverage.switchingCost],
                ["Competitor gap", d.strategy.leverage.competitorGap],
              ].map(([k, v]) => (
                <div key={k as string} className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <span className="text-[12.5px] text-ash">{k}</span>
                  <div className="h-1.5 rounded-full bg-line">
                    <motion.div className="h-full rounded-full bg-bone" initial={{ width: 0 }} animate={{ width: `${Math.max(4, (v as number) * 100)}%` }} transition={{ duration: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <GuardLog d={d} />
        </aside>
      </div>
    </div>
  );
}
