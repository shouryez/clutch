"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { inr, inrCompact } from "@/lib/format";
import type { inboxView } from "@/lib/inbox";
import type { Intent } from "@/lib/replies-seed";
import { Loading, type State } from "./CommandCenter";
import { post, useApi } from "./live";
import { Btn, Mono, page, PageHeader, Panel, timeAgo } from "./ui";

type View = ReturnType<typeof inboxView>;
type Reply = View["replies"][number];

const INTENT: Record<Intent, { label: string; tone: string }> = {
  change_request: { label: "Change request", tone: "text-bone border-bone/40" },
  billing: { label: "Billing", tone: "text-bone border-bone/40" },
  churn_risk: { label: "Churn risk", tone: "text-signal border-signal/50" },
  info_request: { label: "Documents", tone: "text-bone border-bone/40" },
  contact_change: { label: "Contact change", tone: "text-volt border-volt/40" },
  ready_to_sign: { label: "Ready to sign", tone: "text-volt border-volt/40" },
  other: { label: "Other", tone: "text-ash border-line" },
};

function linkify(t: string) {
  return t.split(/(\s)/).map((w, i) =>
    /^(\/(sign|value)\/\S+|https?:\/\/\S+)$/.test(w) ? (
      <a key={i} href={w.replace(/[).,]+$/, "")} target="_blank" className="text-signal underline underline-offset-4">
        {w}
      </a>
    ) : (
      w
    ),
  );
}

function ReplyDetail({ r, onDone }: { r: Reply; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const t = r.triage;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-carbon">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-[16px] font-medium tracking-[-0.01em]">{r.subject}</div>
            <div className="mt-0.5 text-[12.5px] text-ash">
              {r.fromName} &lt;{r.fromEmail}&gt; ·{" "}
              <Link href={`/app/accounts/${r.accountId}`} className="text-bone hover:text-signal">
                {r.accountName}
              </Link>
            </div>
          </div>
          <span className="font-mono text-[10.5px] text-ash">{timeAgo(r.at)} ago</span>
        </div>
        <p className="whitespace-pre-wrap px-5 py-4 text-[14px] leading-relaxed text-bone/90">{r.body}</p>
        {r.status !== "handled" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
            <span className="text-[12px] text-ash">Clutch reads it, works out the intent, acts inside your guardrails and replies.</span>
            <Btn
              tone="primary"
              disabled={busy || r.status === "handling"}
              onClick={async () => {
                setBusy(true);
                try {
                  await post(`/api/inbox/replies/${r.id}`);
                  onDone();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy || r.status === "handling" ? "Reading…" : "Let Clutch handle it →"}
            </Btn>
          </div>
        )}
      </div>

      <AnimatePresence>
        {t && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-line bg-carbon p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Mono>Understood</Mono>
                <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] ${INTENT[t.intent].tone}`}>{INTENT[t.intent].label}</span>
                <span className="font-mono text-[10.5px] text-ash">
                  {Math.round(t.confidence * 100)}% · {t.model} · {(t.ms / 1000).toFixed(1)}s end to end
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-snug">{t.summary}</p>
              <div className="mt-4">
                <Mono>What Clutch did</Mono>
                <ul className="mt-2 space-y-1.5">
                  {t.actions.map((x, i) => (
                    <motion.li key={x} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.12 }} className="flex gap-2.5 text-[13px]">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-volt text-[9px] text-ink">✓</span>
                      {x}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-ink/60">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <Mono className="text-bone">Reply sent</Mono>
                <span className="font-mono text-[10.5px] text-ash">to {r.fromName}</span>
              </div>
              <pre className="whitespace-pre-wrap px-5 py-4 font-sans text-[13px] leading-relaxed text-bone/85">{linkify(t.reply)}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Composer({ accounts, onSent }: { accounts: State["accounts"]; onSent: (id: string) => void }) {
  const [acct, setAcct] = useState("orbit-fintech");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ideas = ["We only use about 25 seats now. Can we drop to that?", "Our new CFO wants a W-9 and GST certificate before signing.", "Freshdesk quoted us 30% less. Can you match it?", "All good, send the order form and we'll sign."];
  return (
    <Panel title="Try it · write as a customer">
      <div className="space-y-3">
        <select value={acct} onChange={(e) => setAcct(e.target.value)} className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none">
          {[...accounts].sort((x, y) => x.name.localeCompare(y.name)).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Type an email reply, in English or Hinglish…" className="w-full resize-none rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none placeholder:text-ash focus:border-ash" />
        <div className="flex flex-wrap gap-1.5">
          {ideas.map((i) => (
            <button key={i} onClick={() => setText(i)} className="rounded-full border border-line px-2.5 py-1 text-left text-[11.5px] text-ash hover:border-ash hover:text-bone">
              {i}
            </button>
          ))}
        </div>
        <Btn
          tone="primary"
          disabled={busy || text.trim().length < 5}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await post<{ reply: { id: string } }>("/api/inbox/replies", { accountId: acct, body: text });
              setText("");
              onSent(r.reply.id);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Sending…" : "Send to inbox"}
        </Btn>
      </div>
    </Panel>
  );
}

export function Inbox() {
  const { data, refresh } = useApi<View>("/api/inbox");
  const { data: st } = useApi<State>("/api/state");
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!data || !st) return <Loading />;
  const cur = data.replies.find((r) => r.id === sel) ?? data.replies[0];
  const needsYou = data.approvals.length + data.suggestions.length + data.steps.filter((s) => s.who === "you").length;
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={page}>
      <PageHeader
        eyebrow="Engage"
        title="Inbox"
        subtitle="Customer replies, approvals and anything waiting on a person — in one place. Clutch reads each reply, works out what the customer wants and does it inside your guardrails."
        actions={
          <button
            onClick={() => act("auto", () => post("/api/settings", { autoReplies: !data.autoReplies }))}
            className={`flex items-center gap-2.5 rounded-full border px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] transition ${data.autoReplies ? "border-volt/50 text-volt" : "border-line text-ash hover:text-bone"}`}
          >
            <span className={`relative h-4 w-7 rounded-full transition ${data.autoReplies ? "bg-volt" : "bg-line"}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-ink transition-all ${data.autoReplies ? "left-3.5" : "left-0.5"}`} />
            </span>
            Auto-handle new replies
          </button>
        }
      />

      {needsYou > 0 && (
        <section className="mt-5">
          <Mono>Needs you · {needsYou}</Mono>
          <div className="mt-2.5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.approvals.map((x) => (
              <div key={x.accountId} className="rounded-2xl border border-signal/40 bg-signal/[0.06] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <Mono className="text-signal">Discount approval</Mono>
                  <span className="font-mono text-[10.5px] text-ash">{x.channel === "voice" ? "live call" : "deal room"}</span>
                </div>
                <div className="mt-1.5 text-[15px] font-medium">{x.accountName}</div>
                <p className="text-[12.5px] text-bone/80">
                  {Math.round(x.discount * 100)}% for {x.term} months{x.extras.length ? ` + ${x.extras.join(", ")}` : ""} · {inr(x.price)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Btn tone="volt" className="px-3 py-1.5" disabled={busy === x.accountId} onClick={() => act(x.accountId, () => post(`/api/deal/${x.accountId}/approve`, { approve: true }))}>
                    Approve
                  </Btn>
                  <Btn className="px-3 py-1.5" disabled={busy === x.accountId} onClick={() => act(x.accountId, () => post(`/api/deal/${x.accountId}/approve`, { approve: false }))}>
                    Decline
                  </Btn>
                </div>
              </div>
            ))}
            {data.suggestions.map((x) => (
              <div key={x.id} className="rounded-2xl border border-line bg-carbon p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <Mono>Play waiting for a go</Mono>
                  <span className="font-mono text-[10.5px] text-ash">{inrCompact(x.arr)}</span>
                </div>
                <div className="mt-1.5 text-[15px] font-medium">
                  {x.title} · {x.accountName}
                </div>
                <p className="line-clamp-2 text-[12.5px] text-ash">{x.reason}</p>
                <div className="mt-3 flex gap-2">
                  <Btn tone="primary" className="px-3 py-1.5" disabled={busy === x.id} onClick={() => act(x.id, () => post(`/api/inbox/suggestions/${x.id}`, { approve: true }))}>
                    Run it
                  </Btn>
                  <Btn className="px-3 py-1.5" disabled={busy === x.id} onClick={() => act(x.id, () => post(`/api/inbox/suggestions/${x.id}`, { approve: false }))}>
                    Dismiss
                  </Btn>
                </div>
              </div>
            ))}
            {data.steps
              .filter((s) => s.who === "you")
              .map((x) => (
                <div key={x.runId} className="rounded-2xl border border-line bg-carbon p-4">
                  <Mono>{x.play}</Mono>
                  <div className="mt-1.5 text-[15px] font-medium">
                    {x.step} · {x.accountName}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {x.key === "call" && (
                      <Link href={`/app/call/${x.accountId}`} className="rounded-full bg-signal px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
                        Open call
                      </Link>
                    )}
                    <Btn className="px-3 py-1.5" disabled={busy === x.runId} onClick={() => act(x.runId, () => post(`/api/runs/${x.runId}/advance`, { note: "confirmed by Meera" }))}>
                      Mark done
                    </Btn>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-4">
          <Panel title={`Customer replies · ${data.counts.replies} new`} pad={false}>
            <ul className="max-h-[56vh] overflow-y-auto">
              {data.replies.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setSel(r.id)} className={`w-full border-b border-line px-4 py-3 text-left transition ${cur?.id === r.id ? "bg-ink/70" : "hover:bg-ink/40"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        {r.status === "new" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />}
                        <span className={`truncate text-[13.5px] ${r.status === "new" ? "font-medium" : "text-bone/80"}`}>{r.fromName}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-ash">{timeAgo(r.at)}</span>
                    </div>
                    <div className="truncate text-[12px] text-ash">
                      {r.accountName} · {r.subject}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {r.triage ? (
                        <span className={`rounded-full border px-2 py-px font-mono text-[9.5px] uppercase tracking-[0.1em] ${INTENT[r.triage.intent].tone}`}>{INTENT[r.triage.intent].label}</span>
                      ) : (
                        <span className="line-clamp-1 text-[12px] text-bone/60">{r.body}</span>
                      )}
                      {r.status === "handled" && <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-volt">handled ✓</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <Composer accounts={st.accounts} onSent={(id) => setSel(id)} />
        </div>
        <div className="min-w-0 xl:col-span-8">{cur ? <ReplyDetail key={cur.id} r={cur} onDone={refresh} /> : <div className="rounded-2xl border border-line bg-carbon p-10 text-center text-ash">No replies.</div>}</div>
      </div>
    </div>
  );
}
