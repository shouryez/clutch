"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { VoiceField } from "@/components/fx/VoiceField";
import { inrCompact } from "@/lib/format";
import { Loading } from "./CommandCenter";
import { Approval, GuardLog, Ladder, SignCard, type Deal } from "./DealRoom";
import { post, usePublicUrl, useApi, useLive } from "./live";
import { Btn, Mono, Panel, useNow } from "./ui";

const OBJECTIONS: [RegExp, string][] = [
  [/price|discount|expensive|budget|mehenga|kam karo|%|percent/i, "Price"],
  [/freshdesk|zendesk|competitor|switch|dusra tool/i, "Competitor"],
  [/export|bug|broken|fail|crash|slow/i, "Product issue"],
  [/sso|saml|feature|integration/i, "Missing feature"],
  [/later|next quarter|not now|baad mein|time/i, "Timing"],
];

export function Objections({ texts }: { texts: string[] }) {
  const all = texts.join(" ");
  const hit = OBJECTIONS.filter(([re]) => re.test(all)).map(([, l]) => l);
  return (
    <div className="flex flex-wrap gap-1.5">
      {hit.length ? (
        hit.map((h) => (
          <motion.span key={h} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-full border border-signal/50 bg-signal/10 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-signal">
            {h}
          </motion.span>
        ))
      ) : (
        <span className="text-[12px] text-ash">none yet</span>
      )}
    </div>
  );
}

export function SummaryCard({ d, onDone }: { d: Deal; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const sm = d.session.summary;
  const said = d.session.messages.some((m) => m.who === "customer");
  return (
    <Panel title="After-call summary · auto-logged to CRM" right={sm ? <Mono className={sm.sentiment === "negative" ? "text-signal" : sm.sentiment === "positive" ? "text-volt" : ""}>{sm.sentiment}</Mono> : undefined}>
      {sm ? (
        <div className="space-y-3 text-[13px]">
          <div className="text-[15px] font-medium">{sm.outcome}</div>
          <p className="leading-relaxed text-bone/80">{sm.summary}</p>
          {(
            [
              ["Objections", sm.objections],
              ["We committed to", sm.commitments],
              ["Next steps", sm.nextSteps],
            ] as const
          ).map(([k, xs]) => (
            <div key={k}>
              <Mono>{k}</Mono>
              <ul className="mt-1 space-y-0.5">
                {xs.map((x) => (
                  <li key={x} className="flex gap-2 text-[12.5px] text-bone/85">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ash" />
                    {x}
                  </li>
                ))}
                {!xs.length && <li className="text-[12px] text-ash">—</li>}
              </ul>
            </div>
          ))}
          <div className="font-mono text-[10px] text-ash">written by {sm.model} · amounts from the deal desk log</div>
        </div>
      ) : (
        <div>
          <p className="text-[12.5px] leading-relaxed text-ash">When the call ends Clutch writes the CRM note itself: outcome, objections, what was promised and next steps. No more after-call admin.</p>
          <Btn
            className="mt-3"
            disabled={!said || busy}
            onClick={async () => {
              setBusy(true);
              setErr("");
              try {
                await post(`/api/deal/${d.account.id}/summary`);
                onDone?.();
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Writing…" : "Write summary now"}
          </Btn>
          {err && <div className="mt-2 text-[12px] text-signal">{err}</div>}
        </div>
      )}
    </Panel>
  );
}

function Meter({ label, value, min, max, color, fmt }: { label: string; value: number; min: number; max: number; color: string; fmt: (v: number) => string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Mono>{label}</Mono>
        <motion.span key={fmt(value)} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="font-mono text-[15px] tabular-nums">
          {fmt(value)}
        </motion.span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-line">
        <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${((value - min) / (max - min)) * 100}%` }} transition={{ type: "spring", stiffness: 70, damping: 16 }} />
      </div>
    </div>
  );
}

export function CallMirror({ id }: { id: string }) {
  const publicUrl = usePublicUrl();
  const { data: d, refresh } = useApi<Deal>(`/api/deal/${id}`);
  const { last } = useLive();
  const now = useNow();
  const scroller = useRef<HTMLDivElement>(null);
  const n = d?.session.messages.length ?? 0;
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [n]);
  if (!d) return <Loading />;
  const s = d.session;
  const live = s.channel === "voice" && last?.kind === "call" && last.accountId === id && now - last.at < 60_000;
  const callUrl = publicUrl(`/call/${id}`);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <VoiceField className="h-full w-full" centerX={0.5} centerY={0.42} />
      </div>
      <div className="relative mx-auto w-full max-w-[1500px] px-5 py-6 md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={`/app/accounts/${id}`} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ash hover:text-bone">
            ← {d.account.name}
          </Link>
          <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em]">
            <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-signal" : "bg-ash"}`} />
            {live ? "live call" : s.channel === "voice" ? "call idle" : "waiting for pickup"}
          </span>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-12">
          {/* left: join + meters */}
          <div className="space-y-6 xl:col-span-3">
            <Panel title="Take the call">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-2xl bg-bone p-3">
                  <QRCodeSVG value={callUrl} size={150} bgColor="#eee9df" fgColor="#0b0b0a" />
                </div>
                <p className="mt-4 text-[13px] text-ash">Scan — your phone rings. You are {s.contact.name}, {s.contact.role} at {d.account.name}.</p>
                <a href={`/call/${id}`} target="_blank" className="mt-2 font-mono text-[11px] text-bone underline underline-offset-4">
                  or open on this device
                </a>
              </div>
            </Panel>
            <Panel title="Live read">
              <div className="space-y-5">
                <Meter label="Sentiment" value={s.sentiment} min={-1} max={1} color="#d7ff3d" fmt={(v) => (v > 0 ? "+" : "") + v.toFixed(2)} />
                <Meter label="Churn risk" value={s.risk} min={0} max={100} color="#ff5a1f" fmt={(v) => String(Math.round(v))} />
              </div>
              <div className="mt-6 flex items-baseline justify-between">
                <Mono>Language</Mono>
                <div className="relative h-14 overflow-hidden">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={s.lang}
                      initial={{ y: "100%" }}
                      animate={{ y: "0%" }}
                      exit={{ y: "-100%" }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className={`text-5xl font-medium tracking-[-0.05em] ${s.lang === "hi" ? "text-signal" : ""}`}
                    >
                      {s.lang === "hi" ? "हिं" : "EN"}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="mt-5">
                <Mono>Objections heard</Mono>
                <div className="mt-2">
                  <Objections texts={s.messages.filter((m) => m.who === "customer").map((m) => m.text)} />
                </div>
              </div>
            </Panel>
          </div>

          {/* centre: transcript */}
          <section className="flex h-[calc(100vh-9rem)] min-h-[520px] flex-col rounded-[20px] border border-line bg-carbon/80 backdrop-blur xl:col-span-5">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <Mono>Transcript · {d.account.name}</Mono>
              <Mono>{inrCompact(d.account.arr)} ARR · {s.stage.replace("-", " ")}</Mono>
            </div>
            <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <AnimatePresence initial={false}>
                {s.messages.map((m) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 18, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.5 }}>
                    {m.who === "system" ? (
                      <div className="rounded-xl border border-volt/40 px-4 py-3 font-mono text-[12.5px] text-volt">{m.text}</div>
                    ) : (
                      <div>
                        <div className={`font-mono text-[10.5px] uppercase tracking-[0.16em] ${m.who === "clutch" ? "text-signal" : "text-ash"}`}>
                          {m.who === "clutch" ? "Clutch" : s.contact.name}
                          {m.lang === "hi" && <span className="ml-2 text-signal">· hinglish</span>}
                        </div>
                        <p className={`mt-1.5 text-[clamp(1.05rem,1.35vw,1.4rem)] leading-snug tracking-[-0.01em] ${m.who === "clutch" ? "text-bone" : "text-bone/70"}`}>{m.text}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          {/* right: deal */}
          <div className="space-y-6 xl:col-span-4">
            <Approval d={d} />
            <SignCard d={d} />
            <SummaryCard d={d} onDone={refresh} />
            <Panel title="Offer ladder · private">
              <Ladder d={d} />
            </Panel>
            <GuardLog d={d} />
          </div>
        </div>
      </div>
    </div>
  );
}
