"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Plan } from "@/lib/explain";
import { inr, inrCompact } from "@/lib/format";
import { PLAYBOOK } from "@/lib/playbook";
import type { AccountSummary, PlayKey } from "@/lib/types";
import { I } from "./icons";
import { post } from "./live";
import { Btn, Mono } from "./ui";

export const PLAY_LABEL = Object.fromEntries(Object.entries(PLAYBOOK).map(([k, d]) => [k, d.label])) as Record<PlayKey, string>;

/** expected loss with urgency: risk² × ARR, ×1.5 when the notice window closes within 15 days */
export function stake(a: AccountSummary) {
  const r = a.health.risk / 100;
  return r * r * a.arr * (a.health.daysToNotice >= 0 && a.health.daysToNotice <= 15 ? 1.5 : 1);
}

const CLOSES: PlayKey[] = ["touchless", "competitor", "expansion", "rightsize", "negotiated"];

export const playTone = (p: PlayKey) => (p === "touchless" || p === "expansion" ? "volt" : "primary") as "volt" | "primary";

/* ---------------- Play preview drawer ---------------- */

export function PlayPreview({ accountId, play, onClose }: { accountId: string; play: PlayKey; onClose: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "started" | "error">("idle");
  const [err, setErr] = useState("");
  const router = useRouter();

  useEffect(() => {
    let live = true;
    fetch(`/api/plays/preview?accountId=${accountId}&play=${play}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => live && setPlan(j as Plan));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      live = false;
      window.removeEventListener("keydown", esc);
    };
  }, [accountId, play, onClose]);

  const run = async () => {
    setState("starting");
    try {
      await post("/api/plays", { accountId, play });
      setState("started");
      // open the account on its live pipeline
      onClose();
      router.push(`/app/accounts/${accountId}?watch=run`);
      setTimeout(() => document.getElementById("live-run")?.scrollIntoView({ behavior: "smooth", block: "start" }), 700);
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div key="bg" className="fixed inset-0 z-[80] bg-ink/70 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        key="panel"
        role="dialog"
        aria-label="Play preview"
        className="fixed inset-y-0 right-0 z-[81] flex w-full max-w-[560px] flex-col border-l border-line bg-[#10100f] shadow-2xl"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <Mono>Play preview · {plan?.accountName ?? "…"}</Mono>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <h2 className="text-[24px] font-medium leading-tight tracking-[-0.035em]">{PLAYBOOK[play].title}</h2>
              {plan?.recommended && <span className="rounded-full bg-signal/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-signal">recommended</span>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-line p-1.5 text-ash hover:text-bone" aria-label="Close">
            <I.close width={16} height={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!plan ? (
            <div className="py-20 text-center text-[13px] text-ash">Working out what this play would do…</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line p-3.5">
                  <Mono>Problem it solves</Mono>
                  <p className="mt-1.5 text-[13px] leading-snug text-bone/85">{plan.problem}</p>
                </div>
                <div className="rounded-xl border border-line p-3.5">
                  <Mono>Why this account · risk {plan.risk}</Mono>
                  <p className="mt-1.5 text-[13px] leading-snug text-bone/85">{plan.why}</p>
                </div>
              </div>

              <div className="mt-6 flex items-baseline justify-between">
                <Mono>What Clutch will do</Mono>
                <span className="font-mono text-[10.5px] text-ash">{plan.steps.length} steps · {plan.steps.length - plan.humans.length} automatic</span>
              </div>
              <ol className="mt-3">
                {plan.steps.map((s, i) => (
                  <motion.li
                    key={s.key + i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className="relative grid grid-cols-[28px_1fr] gap-x-3 pb-4 last:pb-0"
                  >
                    {i < plan.steps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-22px)] w-px bg-line" />}
                    <span className={`grid h-7 w-7 place-items-center rounded-full font-mono text-[11px] ${s.human ? "bg-bone text-ink" : "border border-line text-ash"}`}>{i + 1}</span>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-medium">{s.label}</span>
                        <span className="rounded-full border border-line px-2 py-px font-mono text-[9.5px] uppercase tracking-[0.1em] text-ash">{s.system}</span>
                        {s.human && <span className="rounded-full bg-bone/10 px-2 py-px font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone">waits for a person</span>}
                      </div>
                      {s.detail && <p className="mt-1 text-[13px] leading-snug text-bone/90">{s.detail}</p>}
                      <p className="mt-0.5 text-[12px] leading-snug text-ash">{s.does}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>

              {plan.deal && (
                <div className="mt-6 rounded-xl border border-line bg-ink/50 p-4">
                  <Mono>If they sign</Mono>
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div>
                      <div className="text-[11px] text-ash">Today</div>
                      <div className="font-mono text-[18px] tabular-nums">{inrCompact(plan.deal.now.arr)}/yr</div>
                      <div className="text-[11.5px] text-ash">{plan.deal.now.seats} seats</div>
                    </div>
                    <I.arrow width={16} height={16} className="text-ash" />
                    <div>
                      <div className="text-[11px] text-ash">After renewal</div>
                      <div className="font-mono text-[18px] tabular-nums text-volt">{inrCompact(plan.deal.after.arr)}/yr</div>
                      <div className="text-[11.5px] text-ash">
                        {plan.deal.after.seats} seats · {plan.deal.after.termMonths} mo · {inr(plan.deal.after.price)} total
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-2.5 font-mono text-[10.5px] text-ash">
                    guardrails: max {plan.policy.max * 100}% · approval above {plan.policy.approvalAbove * 100}% · enforced in code, not the prompt
                  </div>
                </div>
              )}
              <p className="mt-5 text-[12px] leading-relaxed text-ash">
                Outcome: <span className="text-bone/85">{plan.outcome}</span> Every email, quote and change it makes is saved to the account and the{" "}
                <Link href="/app/outbox" className="underline underline-offset-4 hover:text-bone">outbox</Link>.
              </p>
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          {state === "started" ? (
            <>
              <span className="text-[13px] text-volt">Started. Clutch is on it.</span>
              <Link href={`/app/accounts/${accountId}`} onClick={onClose} className="rounded-full bg-bone px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
                Watch it run →
              </Link>
            </>
          ) : (
            <>
              <span className="text-[12px] text-signal">{state === "error" ? err : ""}</span>
              <div className="flex gap-2">
                <Btn onClick={onClose}>Cancel</Btn>
                <Btn tone={playTone(play)} disabled={!plan || state === "starting"} onClick={run}>
                  {state === "starting" ? "Starting…" : `Run ${PLAYBOOK[play].label.toLowerCase()} →`}
                </Btn>
              </div>
            </>
          )}
        </footer>
      </motion.aside>
    </AnimatePresence>,
    document.body,
  );
}

/** The one-click play button — opens the preview first so nobody runs a play blind. */
export function PlayButton({ a, compact, play }: { a: AccountSummary; compact?: boolean; play?: PlayKey }) {
  const [open, setOpen] = useState(false);
  if (a.renewed) return <Mono className="text-volt">renewed ✓</Mono>;
  if (a.activeRun && (a.activeRun.status === "running" || a.activeRun.status === "waiting")) {
    return (
      <Link href={`/app/accounts/${a.id}`} className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-bone">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
        {a.activeRun.status === "waiting" ? "waiting" : "running"}
      </Link>
    );
  }
  const last = a.activeRun;
  const p = play ?? (last?.status === "done" && !CLOSES.includes(last.play) ? "touchless" : a.health.cause);
  return (
    <>
      <Btn tone={playTone(p)} className={compact ? "px-3 py-1.5" : ""} onClick={() => setOpen(true)} title={PLAYBOOK[p].outcome}>
        {PLAY_LABEL[p]} →
      </Btn>
      {open && <PlayPreview accountId={a.id} play={p} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Same preview, any trigger element. */
export function PreviewTrigger({ accountId, play, children, className, disabled }: { accountId: string; play: PlayKey; children: React.ReactNode; className?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button disabled={disabled} className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <PlayPreview accountId={accountId} play={play} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ---------------- Pipeline stage of an account ---------------- */

export type Stage = "flagged" | "ready" | "working" | "waiting" | "renewed" | "later";

export function stageOf(a: AccountSummary): Stage {
  if (a.renewed) return "renewed";
  const r = a.activeRun;
  if (r?.status === "waiting") return "waiting";
  if (r?.status === "running") return "working";
  if (a.health.daysToRenewal < 0 || a.health.daysToRenewal > 120) return "later";
  return a.health.tier === "healthy" ? "ready" : "flagged";
}

export const STAGES: { key: Exclude<Stage, "later">; title: string; hint: string; dot: string }[] = [
  { key: "flagged", title: "At risk", hint: "Risk signals found. Clutch has picked a play; it needs a go.", dot: "bg-signal" },
  { key: "ready", title: "Auto-renew ready", hint: "Healthy. Autopilot renews these with zero human touches.", dot: "bg-volt" },
  { key: "working", title: "Clutch working", hint: "A play is running: emails, quotes, escalations.", dot: "bg-bone" },
  { key: "waiting", title: "Waiting on customer", hint: "Order form sent or call queued. Moves on the signature.", dot: "bg-bone" },
  { key: "renewed", title: "Renewed", hint: "Signed, billed, contract updated.", dot: "bg-volt" },
];
