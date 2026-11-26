"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import type { callsView } from "@/lib/copilot";
import { inrCompact } from "@/lib/format";
import { Loading, type State } from "./CommandCenter";
import { usePublicUrl, useApi } from "./live";
import { Mono, page, PageHeader, Panel, Stat, timeAgo } from "./ui";

type Call = ReturnType<typeof callsView>[number];

export function Calls() {
  const publicUrl = usePublicUrl();
  const { data } = useApi<{ calls: Call[] }>("/api/calls");
  const { data: state } = useApi<State>("/api/state");
  const [sel, setSel] = useState<string | null>(null);
  const [acct, setAcct] = useState("northwind-logistics");
  if (!data || !state) return <Loading />;
  const calls = data.calls;
  const current = calls.find((c) => c.accountId === sel) ?? calls[0];
  const atRisk = state.accounts.filter((a) => a.health.tier !== "healthy" && !a.renewed).sort((x, y) => y.health.risk - x.health.risk);
  const voice = calls.filter((c) => c.channel === "voice");
  const agreed = calls.filter((c) => c.stage === "agreed").length;

  return (
    <div className={page}>
      <PageHeader eyebrow="Engage" title="Calls & conversations" subtitle="Every voice call and deal-desk chat Clutch has had, with live transcripts. Start a call to any account — your phone rings." />
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Conversations" value={String(calls.length)} sub={`${voice.length} voice · ${calls.length - voice.length} chat`} />
        <Stat label="Deals agreed" value={String(agreed)} sub="order form sent" tone={agreed ? "good" : undefined} />
        <Stat label="Hinglish" value={String(calls.filter((c) => c.lang === "hi").length)} sub="switched language mid-call" />
        <Stat label="Avg turns" value={calls.length ? (calls.reduce((t, c) => t + c.turns, 0) / calls.length).toFixed(1) : "—"} sub="customer replies per call" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-4">
          <Panel title="Start a call">
            <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash" htmlFor="acct">
              Account
            </label>
            <select id="acct" value={acct} onChange={(e) => setAcct(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13.5px] outline-none">
              {atRisk.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · risk {a.health.risk} · {inrCompact(a.arr)}
                </option>
              ))}
            </select>
            <div className="mt-4 flex items-center gap-4">
              <div className="rounded-xl bg-bone p-2">
                <QRCodeSVG value={publicUrl(`/call/${acct}`)} size={104} bgColor="#eee9df" fgColor="#0b0b0a" />
              </div>
              <div className="space-y-2 text-[12.5px] text-ash">
                <p>Scan with a phone to take the call as the customer.</p>
                <Link href={`/app/call/${acct}`} className="inline-block rounded-full bg-signal px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink">
                  Open live view →
                </Link>
              </div>
            </div>
          </Panel>
          <Panel title="History" pad={false}>
            <ul>
              {calls.map((c) => (
                <li key={c.accountId}>
                  <button onClick={() => setSel(c.accountId)} className={`w-full border-b border-line px-5 py-3 text-left last:border-0 ${current?.accountId === c.accountId ? "bg-ink/60" : "hover:bg-ink/30"}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13.5px]">{c.account}</span>
                      <span className="font-mono text-[10px] text-ash">{timeAgo(c.lastAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ash">
                      <span className={c.channel === "voice" ? "text-signal" : ""}>{c.channel}</span>·<span>{c.turns} turns</span>·<span className={c.stage === "agreed" ? "text-volt" : ""}>{c.stage}</span>
                      {c.lang === "hi" && <span className="text-signal">· हिं</span>}
                    </div>
                  </button>
                </li>
              ))}
              {!calls.length && <li className="px-5 py-8 text-center text-[13px] text-ash">No conversations yet — start a call or open the deal desk.</li>}
            </ul>
          </Panel>
        </div>

        <div className="min-w-0 xl:col-span-8">
          <Panel
            title={current ? `Transcript · ${current.account} · ${current.contact}` : "Transcript"}
            right={current && <Mono>{current.offer ? `on the table: ${current.offer}` : "no offer yet"}</Mono>}
          >
            {current ? (
              <div className="space-y-4">
                {current.messages.map((m) => (
                  <div key={m.id}>
                    {m.who === "system" ? (
                      <div className="rounded-lg border border-volt/40 px-3 py-2 font-mono text-[11.5px] text-volt">{m.text}</div>
                    ) : (
                      <>
                        <div className={`font-mono text-[10px] uppercase tracking-[0.14em] ${m.who === "clutch" ? "text-signal" : "text-ash"}`}>
                          {m.who === "clutch" ? "Clutch" : current.contact} · {new Date(m.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                        <p className={`mt-1 text-[14.5px] leading-relaxed ${m.who === "clutch" ? "text-bone" : "text-bone/70"}`}>{m.text}</p>
                      </>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Link href={`/app/call/${current.accountId}`} className="rounded-full border border-line px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] hover:border-ash">
                    Live view
                  </Link>
                  <Link href={`/app/accounts/${current.accountId}`} className="rounded-full border border-line px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] hover:border-ash">
                    Account
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <Mono>How a Clutch call works</Mono>
                <ol className="mt-4 space-y-4">
                  {[
                    ["Their phone rings", "Scan the QR (or a play reaches the call step). The customer taps Accept — no app, any browser."],
                    ["Sarvam Saaras hears them", "Speech to text in English, Hindi or Hinglish, with product terms like SSO and CSV export boosted."],
                    ["The agent thinks with tools", "sarvam-105b answers from the account's real contract, tickets and usage, and can file a P0, compare competitors or make an offer."],
                    ["Guardrails decide the price", "Offers climb one ladder step per turn: 5% → 8% → 10%. 12–15% pings you for approval. Nothing above 15%, ever."],
                    ["Bulbul speaks back", "Replies are voiced in about 2.5 seconds end to end. You can listen live and approve from the laptop."],
                    ["“Send it” closes the deal", "The order form goes out the moment they agree, and the renewal play takes it to signature and billing."],
                  ].map(([t, d], i) => (
                    <li key={t} className="grid grid-cols-[28px_1fr] gap-3">
                      <span className="grid h-7 w-7 place-items-center rounded-full border border-line font-mono text-[11px] text-signal">{i + 1}</span>
                      <div>
                        <div className="text-[14px] font-medium">{t}</div>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ash">{d}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
