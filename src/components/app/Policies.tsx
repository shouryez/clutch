"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtValue, type FieldDef } from "@/lib/policy/catalog";
import type {
  AuditRun,
  ChangeEntry,
  FileError,
  PolicyException,
  RuleChange,
} from "@/lib/policy/engine";
import {
  ACTION_LABEL,
  type Category,
  type Rule,
  type Severity,
} from "@/lib/policy/schema";
import type { Template } from "@/lib/policy/templates";
import { ExportBrief } from "./Boardroom";
import { MailAction } from "./MailButton";
import { Loading } from "./CommandCenter";
import { I } from "./icons";
import { post, useApi, useLive } from "./live";
import {
  blankDraft,
  CAT_LABEL,
  draftFrom,
  RuleEditor,
  SEV_STYLE,
  type Draft,
} from "./RuleEditor";
import { Btn, Mono, page, PageHeader, Panel, timeAgo, useNow } from "./ui";

type RuleRow = Rule & { text: string; exceptions: number; changedAt?: number };
type Impact = {
  version: number;
  at: number;
  source: ChangeEntry["source"];
  measured: boolean;
  auditN: number;
  changes: (RuleChange & {
    now: number;
    was: number | null;
    newAccounts: { id: string; name: string; message: string }[];
    resolvedAccounts: { id: string; name: string }[];
  })[];
} | null;
type View = {
  impact: Impact;
  file: string;
  version: number;
  source: ChangeEntry["source"];
  loadedAt: number;
  error: FileError | null;
  stale: boolean;
  rules: RuleRow[];
  changelog: ChangeEntry[];
  audit: AuditRun;
  history: Omit<AuditRun, "exceptions" | "resolved" | "byRule">[];
  fields: FieldDef[];
  templates: Template[];
};

type Tab = "audit" | "rules" | "config" | "history";
const money = (n: number) => fmtValue(n, "money");
const SOURCE_LABEL: Record<ChangeEntry["source"], string> = {
  boot: "startup",
  ui: "Clutch UI",
  file: "file on disk",
  upload: "uploaded file",
  api: "API",
};

function SevChip({ s }: { s: Severity }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] ${SEV_STYLE[s]}`}
    >
      {s}
    </span>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-volt" : "bg-line"}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`absolute top-0.5 h-4 w-4 rounded-full ${on ? "right-0.5 bg-ink" : "left-0.5 bg-ash"}`}
      />
    </button>
  );
}

function FileChip({ v }: { v: View }) {
  const now = useNow();
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] ${v.error ? "border-signal/50 text-signal" : "border-line text-ash"}`}
      title="Rules are read from this file. Edit it anywhere — Clutch reloads it live."
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${v.error ? "bg-signal" : "animate-pulse bg-volt"}`}
      />
      <span className="text-bone/90">{v.file}</span>
      <span>· v{v.version}</span>
      <span className="hidden sm:inline">
        ·{" "}
        {v.error
          ? "has errors"
          : `live${now && v.source !== "boot" ? ` · ${SOURCE_LABEL[v.source]} ${timeAgo(v.loadedAt)} ago` : ""}`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ audit */

function csv(rows: PolicyException[]) {
  const head = [
    "status",
    "severity",
    "rule",
    "rule_name",
    "category",
    "account",
    "offer",
    "message",
    "evidence",
    "arr",
    "action",
  ];
  const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((e) =>
    [
      e.status,
      e.severity,
      e.ruleId,
      e.ruleName,
      e.category,
      e.accountName,
      e.offerLabel ?? "",
      e.message,
      e.evidence.map((x) => `${x.field}=${x.actual}`).join("; "),
      e.arr,
      e.actionTaken ?? ACTION_LABEL[e.action.type],
    ]
      .map(esc)
      .join(","),
  );
  const blob = new Blob([[head.join(","), ...lines].join("\n")], {
    type: "text/csv",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "clutch-audit.csv";
  a.click();
}

function Delta({ audit, prevN }: { audit: AuditRun; prevN?: number }) {
  const c = audit.counts;
  return (
    <div className="grid gap-px overflow-hidden rounded-[20px] border border-line bg-line sm:grid-cols-4">
      <div className="relative bg-carbon p-5">
        {c.new > 0 && (
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(255,90,31,0.22),transparent_60%)]"
          />
        )}
        <div className="relative">
          <Mono className={c.new ? "text-signal" : "text-ash"}>
            Newly flagged
          </Mono>
          <motion.div
            key={audit.id}
            initial={{ scale: 1.25, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            data-testid="audit-new"
            className={`mt-2 origin-left text-[48px] font-medium leading-none tracking-[-0.05em] tabular-nums ${c.new ? "text-signal" : ""}`}
          >
            +{c.new}
          </motion.div>
          <div className="mt-1.5 text-[12px] text-ash">
            {prevN ? `since audit #${prevN}` : "baseline run"}
          </div>
        </div>
      </div>
      <div className="bg-carbon p-5">
        <Mono>Resolved</Mono>
        <div
          className={`mt-2 text-[48px] font-medium leading-none tracking-[-0.05em] tabular-nums ${c.resolved ? "text-volt" : ""}`}
        >
          −{c.resolved}
        </div>
        <div className="mt-1.5 text-[12px] text-ash">
          no longer breaking a rule
        </div>
      </div>
      <div className="bg-carbon p-5">
        <Mono>Open exceptions</Mono>
        <div className="mt-2 text-[48px] font-medium leading-none tracking-[-0.05em] tabular-nums">
          {c.total}
        </div>
        <div className="mt-1.5 flex gap-2 text-[12px] text-ash">
          <span className="text-signal">{c.critical} critical</span>
          <span>{c.high} high</span>
          <span>{c.medium + c.low} other</span>
        </div>
      </div>
      <div className="bg-carbon p-5">
        <Mono>ARR exposed</Mono>
        <div className="mt-2 text-[48px] font-medium leading-none tracking-[-0.05em] tabular-nums">
          {money(audit.exposure)}
        </div>
        <div className="mt-1.5 text-[12px] text-ash">
          audit #{audit.n} · {audit.rulesChecked} rules ×{" "}
          {audit.accountsChecked} accounts
          {audit.offersChecked ? ` + ${audit.offersChecked} offers` : ""} ·{" "}
          {audit.ms} ms
        </div>
      </div>
    </div>
  );
}

function ExceptionRow({ e, fresh }: { e: PolicyException; fresh: boolean }) {
  const isNew = e.status === "new";
  const resolved = e.status === "resolved";
  return (
    <motion.li
      layout
      initial={
        fresh && isNew
          ? { opacity: 0, x: -12, backgroundColor: "rgba(255,90,31,0.28)" }
          : false
      }
      animate={{
        opacity: 1,
        x: 0,
        backgroundColor: isNew ? "rgba(255,90,31,0.06)" : "rgba(0,0,0,0)",
      }}
      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      data-status={e.status}
      className={`relative grid gap-x-4 gap-y-1.5 px-5 py-3.5 lg:grid-cols-[92px_minmax(0,1.05fr)_minmax(0,1.9fr)_96px_minmax(0,0.9fr)] ${resolved ? "opacity-55" : ""}`}
    >
      {isNew && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] bg-signal shadow-[0_0_16px_rgba(255,90,31,0.9)]"
        />
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {isNew ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-signal px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink">
            <span className="h-1 w-1 animate-ping rounded-full bg-ink" /> new
          </span>
        ) : resolved ? (
          <span className="rounded-full bg-volt/15 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-volt">
            resolved
          </span>
        ) : (
          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">
            open
          </span>
        )}
        <SevChip s={e.severity} />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[11px] text-ash">
          {e.ruleId} · {CAT_LABEL[e.category]}
        </div>
        <div className="truncate text-[13.5px]">{e.ruleName}</div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            href={`/app/accounts/${e.accountId}`}
            className="text-[13.5px] font-medium hover:text-signal"
          >
            {e.accountName}
          </Link>
          {e.offerLabel && (
            <span className="font-mono text-[10.5px] text-ash">
              offer {e.offerLabel}
            </span>
          )}
          {isNew && e.why && (
            <span className="font-mono text-[10px] text-signal/80">
              {e.why === "rule"
                ? "caught by a new/edited rule"
                : "account changed"}
            </span>
          )}
        </div>
        <div
          className={`text-[12.5px] text-bone/75 ${resolved ? "line-through" : ""}`}
        >
          {e.message}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {e.evidence.slice(0, 5).map((x) => (
            <span
              key={x.field}
              title={`${x.label} ${x.test}`}
              className="rounded-md bg-line/70 px-1.5 py-0.5 font-mono text-[10.5px] text-bone/80"
            >
              {x.field} <span className="text-ash">=</span> {x.actual}
            </span>
          ))}
        </div>
      </div>
      <div className="font-mono text-[12.5px] tabular-nums lg:text-right">
        {money(e.arr)}
      </div>
      <div className="text-[12px] text-ash">
        {e.actionTaken ?? ACTION_LABEL[e.action.type]}
      </div>
    </motion.li>
  );
}

/** before/after with the changed words lit up: "utilization < 56" -> "utilization < 60" */
function DiffLine({
  label,
  text,
  other,
  tone,
}: {
  label: string;
  text?: string;
  other?: string;
  tone: "before" | "after";
}) {
  const a = (text ?? "").split(" ");
  const b = (other ?? "").split(" ");
  return (
    <div className="flex min-w-0 items-baseline gap-3">
      <span
        className={`w-14 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] ${tone === "after" ? "text-volt" : "text-ash"}`}
      >
        {label}
      </span>
      {text ? (
        <code className="min-w-0 break-words font-mono text-[13px] leading-relaxed">
          {a.map((w, i) => (
            <span
              key={i}
              className={
                w !== b[i]
                  ? tone === "after"
                    ? "rounded bg-volt/20 px-0.5 text-volt"
                    : "text-ash line-through decoration-signal/70"
                  : tone === "before"
                    ? "text-ash"
                    : "text-bone"
              }
            >
              {w}{" "}
            </span>
          ))}
        </code>
      ) : (
        <span className="text-[13px] text-ash">
          {tone === "before" ? "— rule didn’t exist" : "— rule removed"}
        </span>
      )}
    </div>
  );
}

function WhatChanged({
  impact,
  onRun,
  running,
}: {
  impact: NonNullable<Impact>;
  onRun: () => void;
  running: boolean;
}) {
  const now = useNow();
  return (
    <section
      data-testid="what-changed"
      className="relative overflow-hidden rounded-[20px] border border-volt/30 bg-carbon"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(60%_120%_at_100%_0%,rgba(215,255,61,0.08),transparent_60%)]"
      />
      <header className="relative flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Mono className="text-volt">What changed</Mono>
          <span className="rounded-full bg-bone px-2 py-0.5 font-mono text-[10px] text-ink">
            v{impact.version}
          </span>
          <span className="text-[12.5px] text-ash">
            {impact.source === "file"
              ? "edited in config/policies.yaml"
              : impact.source === "upload"
                ? "uploaded config file"
                : impact.source === "api"
                  ? "pushed via API"
                  : "edited in Clutch"}
            {now ? ` · ${timeAgo(impact.at)} ago` : ""}
          </span>
        </div>
        {impact.measured ? (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash">
            measured by audit #{impact.auditN}
          </span>
        ) : (
          <Btn tone="volt" onClick={onRun} disabled={running}>
            {running ? "Auditing…" : "Re-run audit to measure"}
          </Btn>
        )}
      </header>
      <div className="relative divide-y divide-line/70">
        {impact.changes.map((c) => {
          const delta = c.was === null ? null : c.now - c.was;
          return (
            <div
              key={c.id + c.kind}
              className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_240px]"
            >
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-ash">{c.id}</span>
                  <span className="text-[15px]">{c.name}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">
                    {c.kind}
                    {c.what?.length ? ` · ${c.what.join(", ")}` : ""}
                  </span>
                </div>
                <DiffLine
                  label="Before"
                  text={c.kind === "added" ? undefined : c.before}
                  other={c.after}
                  tone="before"
                />
                <DiffLine
                  label="After"
                  text={c.kind === "removed" ? undefined : c.after}
                  other={c.before}
                  tone="after"
                />
                {c.kind === "disabled" && (
                  <div className="pl-[68px] text-[12px] text-ash">
                    switched off
                  </div>
                )}
                {c.newAccounts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal">
                      Newly flagged
                    </span>
                    {c.newAccounts.map((a) => (
                      <Link
                        key={a.id}
                        href={`/app/accounts/${a.id}`}
                        title={a.message}
                        className="rounded-full bg-signal/15 px-2.5 py-0.5 text-[12px] text-signal hover:bg-signal/25"
                      >
                        {a.name}
                      </Link>
                    ))}
                  </div>
                )}
                {c.resolvedAccounts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-volt">
                      No longer flagged
                    </span>
                    {c.resolvedAccounts.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-full bg-volt/10 px-2.5 py-0.5 text-[12px] text-volt"
                      >
                        {a.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-start gap-3 lg:justify-end">
                {c.was === null ? (
                  <span className="text-[12.5px] text-ash">
                    not measured yet
                  </span>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="text-[30px] font-medium leading-none tracking-[-0.04em] text-ash tabular-nums">
                        {c.was}
                      </div>
                      <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">
                        before
                      </div>
                    </div>
                    <span className="text-ash">→</span>
                    <div className="text-center">
                      <div className="text-[30px] font-medium leading-none tracking-[-0.04em] tabular-nums">
                        {c.now}
                      </div>
                      <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">
                        after
                      </div>
                    </div>
                    {delta !== null && delta !== 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[12px] ${delta > 0 ? "bg-signal/15 text-signal" : "bg-volt/15 text-volt"}`}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AuditTab({
  v,
  freshId,
  onRun,
  running,
}: {
  v: View;
  freshId: string | null;
  onRun: () => void;
  running: boolean;
}) {
  const [status, setStatus] = useState<"all" | "new" | "open" | "resolved">(
    "all",
  );
  const [rule, setRule] = useState<string | null>(null);
  const cat = "all" as Category | "all";
  const [qq, setQ] = useState("");
  const a = v.audit;
  const all = useMemo(() => [...a.exceptions, ...a.resolved], [a]);
  const rows = all.filter(
    (e) =>
      (status === "all"
        ? e.status !== "resolved" || a.resolved.length > 0
        : e.status === status) &&
      (!rule || e.ruleId === rule) &&
      (cat === "all" || e.category === cat) &&
      (!qq ||
        `${e.accountName} ${e.ruleName} ${e.message} ${e.ruleId}`
          .toLowerCase()
          .includes(qq.toLowerCase())),
  );
  const prev = v.history[1];

  return (
    <div className="space-y-5">
      {v.impact && (
        <WhatChanged impact={v.impact} onRun={onRun} running={running} />
      )}
      <Delta audit={a} prevN={prev?.n} />

      {/* per rule */}
      <div className="flex flex-wrap gap-1.5">
        {a.byRule
          .filter((r) => r.count > 0 || r.added > 0 || r.removed > 0)
          .map((r) => (
            <button
              key={r.id}
              onClick={() => setRule(rule === r.id ? null : r.id)}
              className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] transition ${rule === r.id ? "border-bone bg-bone text-ink" : r.added ? "border-signal/50 bg-signal/[0.07] text-bone" : "border-line text-ash hover:text-bone"}`}
            >
              <span className="font-mono text-[10.5px] opacity-70">{r.id}</span>
              <span className="max-w-[180px] truncate">{r.name}</span>
              <span className="font-mono tabular-nums">{r.count}</span>
              {r.added > 0 && (
                <span
                  className={`font-mono text-[10.5px] ${rule === r.id ? "" : "text-signal"}`}
                >
                  +{r.added}
                </span>
              )}
              {r.removed > 0 && (
                <span
                  className={`font-mono text-[10.5px] ${rule === r.id ? "" : "text-volt"}`}
                >
                  −{r.removed}
                </span>
              )}
            </button>
          ))}
      </div>

      <Panel
        pad={false}
        title={
          <span className="flex items-center gap-3">
            Exceptions
            {a.counts.new > 0 && (
              <span className="rounded-full bg-signal/15 px-2 py-0.5 text-signal">
                {a.counts.new} new this run
              </span>
            )}
          </span>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-line p-0.5 text-[11.5px]">
              {(["all", "new", "open", "resolved"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-full px-2.5 py-0.5 capitalize transition ${status === s ? "bg-bone text-ink" : "text-ash hover:text-bone"}`}
                >
                  {s}
                  {s !== "all" && (
                    <span className="ml-1 opacity-60">
                      {s === "new"
                        ? a.counts.new
                        : s === "open"
                          ? a.counts.open
                          : a.counts.resolved}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <input
              value={qq}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-32 rounded-full border border-line bg-ink px-3 py-1 text-[12px] outline-none focus:border-ash"
            />
            <button
              onClick={() => csv(rows)}
              className="rounded-full border border-line px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash hover:text-bone"
            >
              CSV
            </button>
          </div>
        }
      >
        <div className="hidden grid-cols-[92px_minmax(0,1.05fr)_minmax(0,1.9fr)_96px_minmax(0,0.9fr)] gap-x-4 border-b border-line px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ash lg:grid">
          <span>Status</span>
          <span>Rule</span>
          <span>Account · finding · evidence</span>
          <span className="text-right">ARR</span>
          <span>Action</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-ash">
            {status === "new" ? (
              <>
                Nothing new in audit #{a.n}. Add a rule, then{" "}
                <button
                  onClick={onRun}
                  disabled={running}
                  className="text-signal underline-offset-2 hover:underline"
                >
                  re-run the audit
                </button>
                .
              </>
            ) : (
              "No exceptions match these filters."
            )}
          </div>
        ) : (
          <ul data-testid="exceptions" className="divide-y divide-line/70">
            <AnimatePresence initial={false}>
              {rows.map((e) => (
                <ExceptionRow
                  key={`${e.key}:${e.status}`}
                  e={e}
                  fresh={freshId === a.id}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ rules */

function RulesTab({
  v,
  onEdit,
  onNew,
  refresh,
}: {
  v: View;
  onEdit: (r: RuleRow, dup?: boolean) => void;
  onNew: () => void;
  refresh: () => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const now = useNow();
  const act = async (body: unknown) => {
    await post("/api/policies", body);
    refresh();
  };
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {(["business", "financial", "compliance"] as Category[]).map((c) => {
        const list = v.rules.filter((r) => r.category === c);
        return (
          <div key={c} className="min-w-0 space-y-3">
            <div className="flex items-center justify-between px-1">
              <Mono className="text-bone">
                {CAT_LABEL[c]} · {list.filter((r) => r.enabled).length}/
                {list.length} on
              </Mono>
            </div>
            {list.map((r) => (
              <div
                key={r.id}
                data-rule={r.id}
                className={`rounded-[18px] border bg-carbon p-4 transition ${r.enabled ? "border-line" : "border-line/60 opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] text-ash">
                        {r.id}
                      </span>
                      <SevChip s={r.severity} />
                      <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">
                        {r.scope === "deal" ? "deals" : "accounts"}
                      </span>
                      {r.changedAt && now - r.changedAt < 10 * 60_000 && (
                        <span className="font-mono text-[10px] text-signal">
                          edited {timeAgo(r.changedAt)} ago
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-[15px] leading-snug">
                      {r.name}
                    </div>
                  </div>
                  <Toggle
                    on={r.enabled}
                    label={`Enable ${r.id}`}
                    onChange={(enabled) =>
                      act({ action: "toggle", id: r.id, enabled })
                    }
                  />
                </div>
                <div className="mt-3 rounded-lg border border-line bg-ink/60 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-bone/80">
                  {r.text}
                </div>
                {r.description && (
                  <p className="mt-2 text-[12px] text-ash">{r.description}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="text-ash">
                    → {ACTION_LABEL[r.action.type]}
                    {r.action.play ? ` (${r.action.play})` : ""} ·{" "}
                    <span className={r.exceptions ? "text-bone" : ""}>
                      {r.exceptions} open
                    </span>
                  </span>
                  <span className="flex gap-1">
                    {confirm === r.id ? (
                      <>
                        <button
                          onClick={() =>
                            act({ action: "delete", id: r.id }).then(() =>
                              setConfirm(null),
                            )
                          }
                          className="rounded-md bg-signal px-2 py-0.5 text-ink"
                        >
                          Delete {r.id}
                        </button>
                        <button
                          onClick={() => setConfirm(null)}
                          className="rounded-md px-2 py-0.5 text-ash hover:text-bone"
                        >
                          Keep
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onEdit(r)}
                          className="rounded-md px-2 py-0.5 text-ash hover:bg-line hover:text-bone"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onEdit(r, true)}
                          className="rounded-md px-2 py-0.5 text-ash hover:bg-line hover:text-bone"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => setConfirm(r.id)}
                          className="rounded-md px-2 py-0.5 text-ash hover:bg-line hover:text-signal"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </span>
                </div>
              </div>
            ))}
            <button
              onClick={onNew}
              className="w-full rounded-[18px] border border-dashed border-line py-4 text-[13px] text-ash transition hover:border-ash hover:text-bone"
            >
              + New {CAT_LABEL[c].toLowerCase()} rule
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ config */

function FieldsRef({ fields }: { fields: FieldDef[] }) {
  const [qq, setQ] = useState("");
  const list = fields.filter(
    (f) =>
      !qq ||
      `${f.key} ${f.label} ${f.description}`
        .toLowerCase()
        .includes(qq.toLowerCase()),
  );
  return (
    <Panel
      title={`Fields · ${fields.length}`}
      right={
        <input
          value={qq}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter"
          className="w-24 rounded-full border border-line bg-ink px-2.5 py-0.5 text-[11.5px] outline-none"
        />
      }
      pad={false}
    >
      <ul className="max-h-[420px] divide-y divide-line/60 overflow-y-auto">
        {list.map((f) => (
          <li key={f.key} className="px-4 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`font-mono text-[12px] ${f.scope === "deal" ? "text-signal" : "text-bone"}`}
              >
                {f.key}
              </span>
              <span className="font-mono text-[10px] text-ash">
                {f.type}
                {f.scope === "deal" ? " · deal" : ""}
              </span>
            </div>
            <div className="text-[11.5px] text-ash">{f.description}</div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ConfigTab({
  v,
  refresh,
  onApplied,
}: {
  v: View;
  refresh: () => void;
  onApplied: (version: number) => void;
}) {
  const [format, setFormat] = useState<"yaml" | "json">("yaml");
  const [text, setText] = useState<string | null>(null);
  const [base, setBase] = useState<{ text: string; version: number } | null>(
    null,
  );
  const [check, setCheck] = useState<{
    ok: boolean;
    issues: { path: string; message: string; line?: number }[];
    count: number;
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const dirty = text !== null && base !== null && text !== base.text;

  const load = async (f = format) => {
    const t = await (
      await fetch(`/api/policies/config?format=${f}`, { cache: "no-store" })
    ).text();
    setText(t);
    setBase({ text: t, version: v.version });
    setCheck(null);
  };
  // first load + follow the file when it changes elsewhere (unless you're mid-edit)
  useEffect(() => {
    if (!base || (!dirty && base.version !== v.version)) {
      const t = setTimeout(() => void load(), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.version]);

  // validate as you type
  useEffect(() => {
    if (text === null || !dirty) return;
    const t = setTimeout(async () => {
      const r = await fetch("/api/policies/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, dryRun: true }),
      });
      setCheck(await r.json());
    }, 350);
    return () => clearTimeout(t);
  }, [text, dirty]);

  const apply = async (t: string, source: "ui" | "upload") => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/policies/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t, source }),
      });
      const j = (await r.json()) as {
        ok: boolean;
        issues?: { path: string; message: string; line?: number }[];
        version?: number;
        summary?: string[];
      };
      if (!j.ok) {
        setText(t);
        setCheck({ ok: false, issues: j.issues ?? [], count: 0 });
        setMsg(
          "Rejected — nothing changed. The last good version is still enforced.",
        );
        return;
      }
      setMsg(
        j.summary?.length
          ? `v${j.version} live · ${j.summary.join(" · ")}`
          : "No rule changes.",
      );
      refresh();
      onApplied(j.version ?? v.version);
      const fresh = await (
        await fetch(`/api/policies/config?format=${format}`, {
          cache: "no-store",
        })
      ).text();
      setText(fresh);
      setBase({ text: fresh, version: j.version ?? v.version });
      setCheck(null);
    } finally {
      setBusy(false);
    }
  };

  const errLines = new Set(
    (check?.issues ?? []).map((i) => i.line).filter(Boolean) as number[],
  );
  const lines = (text ?? "").split("\n").length;
  const changedOnDisk = dirty && base && base.version !== v.version;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-line p-0.5 text-[11.5px]">
              {(["yaml", "json"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFormat(f);
                    void load(f);
                  }}
                  className={`rounded-full px-3 py-0.5 uppercase transition ${format === f ? "bg-bone text-ink" : "text-ash hover:text-bone"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="font-mono text-[11px] text-ash">
              {format === "yaml" ? v.file : "same rules, as JSON"}
            </span>
            {dirty && (
              <span className="rounded-full bg-signal/15 px-2 py-0.5 font-mono text-[10px] text-signal">
                unsaved
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".yaml,.yml,.json,application/json,text/yaml"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) await apply(await f.text(), "upload");
              }}
            />
            <Btn onClick={() => fileRef.current?.click()}>Upload file</Btn>
            <a
              href={`/api/policies/config?format=${format}&download=1`}
              className="inline-flex items-center rounded-full border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] hover:border-ash"
            >
              Download
            </a>
            {dirty && <Btn onClick={() => void load()}>Discard</Btn>}
            <Btn
              tone="primary"
              disabled={!dirty || busy || (check ? !check.ok : false)}
              onClick={() => text !== null && apply(text, "ui")}
            >
              {busy ? "Applying…" : "Apply"}
            </Btn>
          </div>
        </div>
        {changedOnDisk && (
          <div className="flex items-center justify-between rounded-xl border border-signal/40 bg-signal/[0.06] px-4 py-2 text-[12.5px]">
            <span>
              The file changed elsewhere (now v{v.version}) while you were
              editing.
            </span>
            <button
              onClick={() => void load()}
              className="text-signal hover:underline"
            >
              Load latest
            </button>
          </div>
        )}
        <div className="relative flex overflow-hidden rounded-[18px] border border-line bg-[#0d0d0c]">
          <div
            ref={gutter}
            aria-hidden
            className="select-none overflow-hidden border-r border-line py-3 text-right font-mono text-[12px] leading-[20px] text-ash/50"
            style={{ height: 560 }}
          >
            {Array.from({ length: lines }, (_, i) => (
              <div
                key={i}
                className={`px-3 ${errLines.has(i + 1) ? "bg-signal/20 text-signal" : ""}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            data-testid="config-editor"
            spellCheck={false}
            value={text ?? "loading…"}
            onChange={(e) => setText(e.target.value)}
            onScroll={(e) => {
              if (gutter.current)
                gutter.current.scrollTop = e.currentTarget.scrollTop;
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const el = e.currentTarget;
                const a = el.selectionStart;
                const nt =
                  (text ?? "").slice(0, a) +
                  "  " +
                  (text ?? "").slice(el.selectionEnd);
                setText(nt);
                requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
              }
              if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (dirty && text !== null) void apply(text, "ui");
              }
            }}
            className="h-[560px] w-full resize-none whitespace-pre bg-transparent px-4 py-3 font-mono text-[12.5px] leading-[20px] text-bone/90 outline-none"
          />
        </div>
        <div aria-live="polite" className="min-h-6">
          {check && !check.ok && (
            <div className="space-y-1.5" data-testid="config-issues">
              {check.issues.slice(0, 8).map((i, k) => (
                <div
                  key={k}
                  className="flex gap-3 rounded-lg border border-signal/30 bg-signal/[0.06] px-3 py-1.5 text-[12.5px]"
                >
                  <span className="w-14 shrink-0 font-mono text-[11px] text-signal">
                    {i.line ? `line ${i.line}` : "—"}
                  </span>
                  <span className="font-mono text-[11px] text-ash">
                    {i.path}
                  </span>
                  <span>{i.message}</span>
                </div>
              ))}
            </div>
          )}
          {check?.ok && dirty && (
            <div className="text-[12.5px] text-volt">
              ✓ Valid · {check.count} rules · ⌘/Ctrl+S or Apply to go live
            </div>
          )}
          {msg && (
            <div
              data-testid="config-msg"
              className="mt-1 text-[12.5px] text-bone/80"
            >
              {msg}
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 space-y-4">
        <Panel title="Four ways to change policy — none need code">
          <ol className="space-y-3 text-[13px]">
            <li>
              <span className="text-bone">1 · Rule builder.</span>{" "}
              <span className="text-ash">
                Form + formula, with a live dry-run.
              </span>
            </li>
            <li>
              <span className="text-bone">2 · This editor or an upload.</span>{" "}
              <span className="text-ash">
                YAML or JSON. Validated as you type; broken files are rejected
                whole.
              </span>
            </li>
            <li>
              <span className="text-bone">3 · The file on disk.</span>{" "}
              <span className="text-ash">Open </span>
              <code className="font-mono text-[12px] text-bone">
                clutch/{v.file}
              </code>
              <span className="text-ash">
                {" "}
                in any editor and save. Clutch is watching it — live in about a
                second.
              </span>
            </li>
            <li>
              <span className="text-bone">4 · API.</span>
              <code className="mt-1 block break-all rounded-lg bg-ink px-2.5 py-1.5 font-mono text-[11px] text-ash">
                curl -X POST localhost:3210/api/policies/config --data-binary
                @policies.yaml
              </code>
            </li>
          </ol>
        </Panel>
        <FieldsRef fields={v.fields} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ history */

function HistoryTab({ v }: { v: View }) {
  const now = useNow();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Policy change log" pad={false}>
        <ol className="divide-y divide-line/70">
          {v.changelog.map((c) => (
            <li key={`${c.version}-${c.at}`} className="px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-bone px-2 py-0.5 font-mono text-[10px] text-ink">
                  v{c.version}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash">
                  {SOURCE_LABEL[c.source]}
                </span>
                <span className="ml-auto font-mono text-[10.5px] text-ash">
                  {now ? `${timeAgo(c.at)} ago` : ""}
                </span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-bone/85">
                {c.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="Audit runs" pad={false}>
        <ol className="divide-y divide-line/70">
          {v.history.map((h) => (
            <li
              key={h.id}
              className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3"
            >
              <span className="font-mono text-[13px]">#{h.n}</span>
              <div className="min-w-0">
                <div className="text-[13px]">
                  <span className={h.counts.new ? "text-signal" : "text-ash"}>
                    +{h.counts.new} new
                  </span>{" "}
                  ·{" "}
                  <span
                    className={h.counts.resolved ? "text-volt" : "text-ash"}
                  >
                    −{h.counts.resolved} resolved
                  </span>{" "}
                  · {h.counts.total} open
                </div>
                <div className="font-mono text-[10.5px] text-ash">
                  {h.trigger} · rules v{h.version} · {h.rulesChecked} rules ×{" "}
                  {h.accountsChecked} accounts · {h.ms} ms
                </div>
              </div>
              <span className="font-mono text-[10.5px] text-ash">
                {now ? `${timeAgo(h.at)} ago` : ""}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export function Policies() {
  const { data: v, refresh } = useApi<View>("/api/policies");
  const { last } = useLive();
  const [tab, setTab] = useState<Tab>("audit");
  const [edit, setEdit] = useState<{
    draft: Draft;
    originalId?: string;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // the file was edited on disk → say so
  useEffect(() => {
    if (
      last?.kind === "system" &&
      /^Policies v\d+ live · .*edited$/.test(last.title) &&
      last.title.includes("policies.yaml")
    ) {
      const t = setTimeout(
        () => setToast(`${last.title} — ${last.detail ?? ""}`),
        0,
      );
      return () => clearTimeout(t);
    }
  }, [last]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!v) return <Loading />;

  const run = async () => {
    setRunning(true);
    try {
      const r = await post<{ audit: AuditRun }>("/api/audit");
      setFreshId(r.audit.id);
      setTab("audit");
      refresh();
    } finally {
      setRunning(false);
    }
  };
  const taken = v.rules.map((r) => r.id);
  const active = v.rules.filter((r) => r.enabled);

  return (
    <div className={page}>
      <PageHeader
        eyebrow="Automation · governance"
        title="Policies & audit"
        subtitle="Your business, finance and compliance rules — as data, not code. Change one here or in config/policies.yaml, then re-run the audit to see what it catches."
        actions={
          <>
            <FileChip v={v} />
            <ExportBrief compact />
            <MailAction endpoint="/api/mail/exceptions" label="Email audit" testId="mail-audit" />
            <Btn onClick={() => setEdit({ draft: blankDraft(taken) })}>
              <span className="text-[14px] leading-none">+</span> New rule
            </Btn>
            <Btn
              tone="primary"
              onClick={run}
              disabled={running}
              className="relative"
            >
              {v.stale && !running && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-volt" />
              )}
              <I.refresh
                width={13}
                height={13}
                className={running ? "animate-spin" : ""}
              />
              {running ? "Auditing…" : "Re-run audit"}
            </Btn>
          </>
        }
      />

      <AnimatePresence>
        {v.error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-[18px] border border-signal/50 bg-signal/[0.07] px-5 py-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px]">
                <span className="text-signal">
                  {v.file} has {v.error.issues.length} error
                  {v.error.issues.length > 1 ? "s" : ""}
                </span>{" "}
                — the edit was rejected, v{v.version} is still enforced.
              </span>
              <button
                onClick={() => setTab("config")}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
              >
                Open in editor →
              </button>
            </div>
            <ul className="mt-2 space-y-0.5 font-mono text-[11.5px] text-bone/80">
              {v.error.issues.slice(0, 4).map((i, k) => (
                <li key={k}>
                  {i.line ? `line ${i.line}: ` : ""}
                  {i.message}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
        {v.stale && !v.error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            data-testid="stale-banner"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-volt/30 bg-volt/[0.05] px-5 py-3"
          >
            <span className="text-[13.5px]">
              <span className="text-volt">Rules changed (v{v.version})</span>{" "}
              since audit #{v.audit.n}. Re-run to see exactly what they catch.
            </span>
            <Btn tone="volt" onClick={run} disabled={running}>
              {running ? "Auditing…" : "Re-run audit now"}
            </Btn>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-line bg-carbon p-1">
          {(
            [
              [
                "audit",
                "Results",
                v.audit.counts.new
                  ? `${v.audit.counts.new} new`
                  : v.audit.counts.total,
              ],
              ["rules", "Rules", `${active.length}/${v.rules.length}`],
              ["config", "Config file", `v${v.version}`],
              ["history", "History", v.changelog.length],
            ] as [Tab, string, number | string][]
          ).map(([k, label, n]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`relative rounded-full px-4 py-1.5 text-[13px] transition ${tab === k ? "text-ink" : "text-ash hover:text-bone"}`}
            >
              {tab === k && (
                <motion.span
                  layoutId="policy-tab"
                  className="absolute inset-0 rounded-full bg-bone"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">
                {label}{" "}
                <span className="font-mono text-[11px] opacity-60">{n}</span>
              </span>
            </button>
          ))}
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash">
          {active.length} rules on ·{" "}
          {active.filter((r) => r.scope === "deal").length} enforced live at the
          deal desk
        </span>
      </div>

      <div className="mt-5">
        {tab === "audit" && (
          <AuditTab v={v} freshId={freshId} onRun={run} running={running} />
        )}
        {tab === "rules" && (
          <RulesTab
            v={v}
            refresh={refresh}
            onNew={() => setEdit({ draft: blankDraft(taken) })}
            onEdit={(r, dup) => {
              const d = draftFrom(
                r as unknown as Partial<Rule> & Record<string, unknown>,
              );
              if (dup) {
                d.id = `${r.id}-COPY`.slice(0, 30);
                d.name = `${r.name} (copy)`;
              }
              setEdit({ draft: d, originalId: dup ? undefined : r.id });
            }}
          />
        )}
        {tab === "config" && (
          <ConfigTab v={v} refresh={refresh} onApplied={() => undefined} />
        )}
        {tab === "history" && <HistoryTab v={v} />}
      </div>

      {edit && (
        <RuleEditor
          initial={edit.draft}
          originalId={edit.originalId}
          fields={v.fields}
          templates={v.templates}
          taken={taken}
          onClose={() => setEdit(null)}
          onSaved={async ({ audit, version, id }) => {
            setEdit(null);
            if (audit) {
              const r = await fetch("/api/audit", { cache: "no-store" }).then(
                (x) => x.json() as Promise<{ audit: AuditRun }>,
              );
              setFreshId(r.audit.id);
              setTab("audit");
              setToast(`${id} saved · policies v${version} · audit re-run`);
            } else
              setToast(
                `${id} saved · policies v${version} written to ${v.file}`,
              );
            refresh();
          }}
        />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            data-testid="policy-toast"
            className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-line bg-carbon px-5 py-2.5 text-[13px] shadow-2xl"
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-volt align-middle" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
