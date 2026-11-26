"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { I } from "./icons";
import { Btn, Mono, timeAgo, useNow } from "./ui";

type Draft = { subject: string; html: string; originalTo: string; scenario: string };
type Result = { ok: boolean; id?: string; to?: string; note?: string; error?: string; subject?: string };

const ENVELOPE = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </svg>
);

function SentLine({ r }: { r: Result }) {
  return (
    <div data-testid="mail-result" className={`rounded-lg px-3 py-2 text-[12.5px] ${r.ok ? "bg-volt/10 text-volt" : "bg-signal/10 text-signal"}`}>
      {r.ok ? (
        <>
          ✓ Sent to <b>{r.to}</b> · Resend id <span className="font-mono text-[11px]">{r.id}</span>
          {r.note && <div className="mt-1 text-[11.5px] text-ash">{r.note}</div>}
        </>
      ) : (
        <>✕ {r.error}</>
      )}
    </div>
  );
}

/** Email any step's artifact for real: preview the drafted email, then send. */
export function MailButton({ artifactId, sent, label = "Email", small }: { artifactId: string; sent?: { at: number; to: string } | null; label?: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const now = useNow();
  const show = async () => {
    setOpen(true);
    setRes(null);
    const j = (await (await fetch(`/api/mail/artifact/${artifactId}`)).json()) as { draft: Draft; to: string | null };
    setDraft(j.draft);
    setTo(j.to);
  };
  const send = async () => {
    setBusy(true);
    try {
      const r = (await (await fetch(`/api/mail/artifact/${artifactId}`, { method: "POST" })).json()) as Result;
      setRes(r);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        data-testid="mail-button"
        onClick={show}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] transition ${sent || res?.ok ? "border-volt/40 text-volt" : "border-line text-ash hover:border-signal/60 hover:text-bone"} ${small ? "" : ""}`}
      >
        {ENVELOPE}
        {res?.ok || sent ? `✓ Email sent${sent && now ? ` · ${timeAgo(sent.at)}` : ""}` : label}
      </button>
      {open &&
        createPortal(
          <AnimatePresence>
            <motion.div key="bg" className="fixed inset-0 z-[90] bg-ink/70 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setOpen(false)} />
            <motion.div
              key="dlg"
              role="dialog"
              aria-label="Email preview"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="fixed left-1/2 top-1/2 z-[91] flex max-h-[92vh] w-[min(760px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-line bg-[#10100f] shadow-2xl"
            >
              <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <Mono>{draft ? `Email · ${draft.scenario}` : "Drafting…"}</Mono>
                  <div className="mt-1 truncate text-[17px] font-medium">{draft?.subject ?? "…"}</div>
                  <div className="mt-1 text-[12px] text-ash">
                    Would go to <span className="text-bone">{draft?.originalTo || "—"}</span> · demo delivery to <span className="text-volt">{to ?? "—"}</span>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-lg border border-line p-1.5 text-ash hover:text-bone" aria-label="Close">
                  <I.close width={15} height={15} />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-hidden bg-[#efebe3]">{draft ? <iframe title="Email preview" srcDoc={draft.html} className="h-[56vh] w-full border-0" sandbox="" /> : <div className="p-10 text-center text-[13px] text-[#6e6a61]">Drafting the email…</div>}</div>
              <footer className="space-y-2 border-t border-line px-5 py-3.5">
                {res && <SentLine r={res} />}
                <div className="flex items-center justify-end gap-2">
                  <Btn onClick={() => setOpen(false)}>Close</Btn>
                  <Btn tone="primary" onClick={send} disabled={busy || !draft}>
                    {ENVELOPE} {busy ? "Sending…" : res?.ok ? "Send again" : "Send real email"}
                  </Btn>
                </div>
              </footer>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** One-shot senders for the brief and the audit digest. */
export function MailAction({ endpoint, label, testId }: { endpoint: string; label: string; testId?: string }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  return (
    <div className="relative">
      <Btn
        onClick={async () => {
          setBusy(true);
          setRes(null);
          try {
            setRes((await (await fetch(endpoint, { method: "POST" })).json()) as Result);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
      >
        <span data-testid={testId} className="inline-flex items-center gap-2">
          {ENVELOPE} {busy ? "Sending…" : res?.ok ? "Sent ✓" : label}
        </span>
      </Btn>
      {res && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80">
          <SentLine r={res} />
        </div>
      )}
    </div>
  );
}
