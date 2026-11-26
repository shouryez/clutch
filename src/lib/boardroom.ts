/**
 * One-click boardroom brief. Compiles the CURRENT run — the latest policy audit plus the live risk scan —
 * into an executive summary where every claim carries a numbered source citation: the contract clause
 * (with page and quote), the ticket, the email, the invoice, the usage metric (with its date window),
 * the CRM contact, the policy rule (with its line in config/policies.yaml) or the run-log entry.
 * Numbers are computed here, never by the model; the optional AI narrative is checked against them.
 */
import { createHash } from "node:crypto";
import { inr, inrCompact } from "./format";
import { llmJSON } from "./llmjson";
import { PLAYBOOK } from "./playbook";
import { lastAudit, policyBadge, policyMeta, ruleLines, runAudit, type PolicyException } from "./policy/engine";
import { whenText } from "./policy/schema";
import { FIELD, fmtValue } from "./policy/catalog";
import { usageWindows } from "./risk";
import { getHealth, store } from "./store";
import type { Account, Health, Signal } from "./types";

export type CitationKind = "clause" | "ticket" | "email" | "invoice" | "metric" | "contact" | "rule" | "log";
export type Citation = {
  id: string; // S1, S2 …
  kind: CitationKind;
  source: string; // where it lives: "MSA · Clause 9.2 · p.4", "Ticket #4821", "usage_daily · 12 Oct–24 Nov"
  detail: string; // the fact, with numbers
  quote?: string; // verbatim text from the record
  accountId?: string;
  link?: string;
};

export type UrgentItem = {
  rank: number;
  accountId: string;
  name: string;
  industry: string;
  arr: number;
  risk: number;
  tier: Health["tier"];
  daysToRenewal: number;
  daysToNotice: number;
  renewalDate: string;
  noticeBy: string;
  expectedLoss: number;
  score: number;
  headline: string;
  why: { text: string; cites: string[] }[];
  exceptions: { ruleId: string; ruleName: string; severity: string; message: string; cite: string }[];
  recommended: string;
  status: string;
};

export type Brief = {
  id: string;
  generatedAt: number;
  generatedLabel: string;
  workspace: string;
  run: { auditN: number; auditAt: number; rulesVersion: number; ms: number; file: string; trigger: string };
  processed: { accounts: number; contracts: number; clauses: number; usageDays: number; tickets: number; emails: number; invoices: number; contacts: number; signals: number; rules: number; checks: number; offers: number; total: number };
  impact: {
    arrUnderManagement: number;
    arrUpForRenewal: number;
    renewalsIn120: number;
    arrAtRisk: number;
    atRiskCount: number;
    expectedLoss: number;
    exposure: number;
    exceptionsOpen: number;
    exceptionsNew: number;
    bySeverity: Record<"critical" | "high" | "medium" | "low", number>;
    arrRenewed: number;
    savedArr: number;
    top3Arr: number;
    top3Loss: number;
  };
  summary: { text: string; model: string | null; grounded: boolean };
  top3: UrgentItem[];
  exceptions: (PolicyException & { cite: string })[];
  citations: Citation[];
  method: string[];
  fingerprint: string;
};

const IST = (t: number) => new Date(t).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clip = (s: string, n = 220) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function addDays(iso: string, d: number) {
  const t = new Date(iso + "T00:00:00");
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
}

/** Collects citations and hands out stable S-numbers (same record → same number). */
class Sources {
  list: Citation[] = [];
  private byKey = new Map<string, string>();
  add(key: string, c: Omit<Citation, "id">) {
    const hit = this.byKey.get(key);
    if (hit) return hit;
    const id = `S${this.list.length + 1}`;
    this.list.push({ id, ...c });
    this.byKey.set(key, id);
    return id;
  }
}

/** The record behind a risk signal, cited precisely. */
function citeSignal(src: Sources, a: Account, s: Signal): string | null {
  const ref = s.ref;
  if (s.key === "usage") {
    const u = a.usage;
    const n = u.length;
    const last = u.slice(-14);
    const base = u.slice(-112, -56);
    const prev = u.slice(-42, -14);
    const uw = usageWindows(a);
    const useBase = uw.base && Math.abs(uw.sixWeekChange) >= Math.abs(uw.change);
    const ref2 = useBase ? base : prev;
    const was = avg(ref2.map((d) => d.activeUsers));
    const now = avg(last.map((d) => d.activeUsers));
    const pct = was ? Math.round(((now - was) / was) * 100) : 0;
    return src.add(`usage:${a.id}`, {
      kind: "metric",
      accountId: a.id,
      source: `Product analytics · usage_daily · ${day(last[0].date)}–${day(u[n - 1].date)} vs ${day(ref2[0].date)}–${day(ref2[ref2.length - 1].date)}`,
      detail: `Daily active users averaged ${now.toFixed(1)} over the last 14 days vs ${was.toFixed(1)} in the comparison window (${pct > 0 ? "+" : ""}${pct}%). ${a.seats} seats licensed.`,
    });
  }
  if (s.key === "seats") {
    const uw = usageWindows(a);
    return src.add(`seats:${a.id}`, {
      kind: "metric",
      accountId: a.id,
      source: `Product analytics · usage_daily · last 28 days (weekdays)`,
      detail: `${uw.weekdayAvg.toFixed(1)} weekday active users on ${a.seats} licensed seats = ${Math.round((uw.weekdayAvg / a.seats) * 100)}% utilisation.`,
    });
  }
  if (s.key === "depth") {
    return src.add(`depth:${a.id}`, { kind: "metric", accountId: a.id, source: "Product analytics · feature usage", detail: `Uses ${a.features.length} of 6 core features: ${a.features.join(", ")}.` });
  }
  if (ref?.kind === "contact") {
    const c = a.contacts.find((x) => x.id === ref.id);
    if (!c) return null;
    return src.add(`contact:${c.id}`, {
      kind: "contact",
      accountId: a.id,
      source: `CRM contact record · ${c.name} (${c.isChampion ? "champion" : c.role})`,
      detail: `${c.name}, ${c.role} · ${c.email} · last active ${c.lastActiveDaysAgo} days ago${c.bounced ? " · email hard-bounced (likely left the company)" : ""}.`,
    });
  }
  if (s.key === "champion" && !ref) {
    return src.add(`nochamp:${a.id}`, { kind: "contact", accountId: a.id, source: "CRM contact records", detail: `No contact on ${a.name} is marked as champion (${a.contacts.length} contacts on file).` });
  }
  if (ref?.kind === "ticket") {
    const t = a.tickets.find((x) => x.id === ref.id);
    if (!t) return null;
    return src.add(`ticket:${t.id}`, {
      kind: "ticket",
      accountId: a.id,
      source: `Support ticket #${t.number} · ${t.priority} · ${t.status} · opened ${t.openedDaysAgo} days ago`,
      detail: `“${t.subject}”${t.competitor ? ` — names competitor ${t.competitor}` : ""}${t.asks?.length ? ` — asks for ${t.asks.join(", ")}` : ""}.`,
      quote: clip(t.body),
    });
  }
  if (ref?.kind === "email") {
    const e = a.emails.find((x) => x.id === ref.id);
    if (!e) return null;
    return src.add(`email:${e.id}`, { kind: "email", accountId: a.id, source: `Email from ${e.from} · ${e.daysAgo} days ago`, detail: `Subject: “${e.subject}” (tone ${e.sentiment.toFixed(2)}).`, quote: clip(e.body) });
  }
  if (ref?.kind === "invoice") {
    const i = a.invoices.find((x) => x.id === ref.id);
    if (!i) return null;
    return src.add(`invoice:${i.id}`, { kind: "invoice", accountId: a.id, source: `Billing · invoice ${i.id} · ${i.daysAgo} days ago`, detail: `${inr(i.amount)} · status ${i.status.toUpperCase()} (Stripe subscription ${a.stripeSubscriptionId}).` });
  }
  return null;
}

function citeClause(src: Sources, a: Account, key: string, extra?: string) {
  const c = a.contract.clauses.find((x) => x.key === key);
  if (!c) return null;
  const num = key === "notice" ? "Clause 9.2" : key === "term" ? "Clause 2.1" : key === "uplift" ? "Clause 5.3" : key === "autorenew" ? "Clause 9.1" : key === "payment" ? "Clause 5.1" : "Schedule A";
  return src.add(`clause:${a.id}:${key}`, { kind: "clause", accountId: a.id, source: `Master Services Agreement · ${num} · page ${c.page}`, detail: `${c.label}: ${c.value}${extra ? ` — ${extra}` : ""}.`, quote: c.quote });
}

/** Expected loss if nothing is done: risk × ARR. Urgency boosts a closing notice window and severe policy exceptions. */
function score(arr: number, risk: number, daysToNotice: number, ex: PolicyException[]) {
  const urgency = daysToNotice >= 0 && daysToNotice <= 15 ? 1.5 : daysToNotice < 0 ? 0.8 : daysToNotice <= 45 ? 1.15 : 1;
  const sev = ex.reduce((t, e) => t + (e.severity === "critical" ? 2 : e.severity === "high" ? 1 : 0.3), 0);
  return (risk / 100) ** 2 * arr * urgency * (1 + 0.15 * sev);
}

function narrativeFacts(b: Omit<Brief, "summary" | "fingerprint">) {
  const i = b.impact;
  return [
    `Accounts analysed: ${b.processed.accounts}; records processed: ${b.processed.total}.`,
    `ARR up for renewal in 120 days: ${inrCompact(i.arrUpForRenewal)} across ${i.renewalsIn120} renewals.`,
    `ARR at risk: ${inrCompact(i.arrAtRisk)} across ${i.atRiskCount} accounts; expected loss if nothing is done: ${inrCompact(i.expectedLoss)}.`,
    `Open policy exceptions: ${i.exceptionsOpen} (${i.bySeverity.critical} critical, ${i.bySeverity.high} high).`,
    ...b.top3.map((t) => `#${t.rank} ${t.name}: ${inrCompact(t.arr)} ARR, risk ${t.risk}, notice deadline in ${t.daysToNotice} days; ${t.headline}; recommended: ${t.recommended}.`),
  ];
}

function templateSummary(b: Omit<Brief, "summary" | "fingerprint">) {
  const i = b.impact;
  const [a, c, d] = b.top3;
  return `Clutch analysed ${b.processed.accounts} accounts (${b.processed.total.toLocaleString("en-IN")} records). ${inrCompact(i.arrUpForRenewal)} renews in the next 120 days, of which ${inrCompact(i.arrAtRisk)} is at risk across ${i.atRiskCount} accounts — an expected loss of ${inrCompact(i.expectedLoss)} if nothing is done. ${i.exceptionsOpen} policy exceptions are open (${i.bySeverity.critical} critical, ${i.bySeverity.high} high).${a ? ` Most urgent: ${a.name} (${inrCompact(a.arr)}, notice deadline in ${a.daysToNotice} days)` : ""}${c ? `, ${c.name}` : ""}${d ? ` and ${d.name}` : ""}.`;
}

/** Every number in the AI's paragraph must already exist in the facts we gave it — otherwise we use the template. */
function grounded(text: string, facts: string) {
  const nums = text.match(/\d[\d,.]*/g) ?? [];
  const pool = facts.replace(/,/g, "");
  return nums.every((n) => pool.includes(n.replace(/,/g, "").replace(/\.$/, "")));
}

let latest: Brief | null = null;

export async function compileBrief(opts: { narrative?: boolean } = {}): Promise<Brief> {
  const s = store();
  const t0 = Date.now();
  // the current run: re-audit first if the rules changed since the last audit
  const audit = policyBadge().stale ? runAudit("auto") : lastAudit();
  const meta = policyMeta();
  const lines = ruleLines();
  const src = new Sources();

  // ---- processed
  const accounts = s.accounts.filter((a) => !s.churned.has(a.id));
  const processed = {
    accounts: accounts.length,
    contracts: accounts.length,
    clauses: accounts.reduce((t, a) => t + a.contract.clauses.length, 0),
    usageDays: accounts.reduce((t, a) => t + a.usage.length, 0),
    tickets: accounts.reduce((t, a) => t + a.tickets.length, 0),
    emails: accounts.reduce((t, a) => t + a.emails.length, 0),
    invoices: accounts.reduce((t, a) => t + a.invoices.length, 0),
    contacts: accounts.reduce((t, a) => t + a.contacts.length, 0),
    signals: accounts.length * 7,
    rules: audit.rulesChecked,
    checks: audit.rulesChecked * audit.accountsChecked + audit.offersChecked,
    offers: audit.offersChecked,
    total: 0,
  };
  processed.total = processed.clauses + processed.usageDays + processed.tickets + processed.emails + processed.invoices + processed.contacts;

  // ---- impact
  const live = accounts.map((a) => ({ a, h: getHealth(a.id), renewed: s.renewed.has(a.id) }));
  const window = live.filter((x) => x.h.daysToRenewal >= 0 && x.h.daysToRenewal <= 120 && !x.renewed);
  const atRisk = window.filter((x) => x.h.tier !== "healthy");
  const renewedArr = [...s.renewed.values()].reduce((t, r) => {
    const o = s.offers.find((x) => x.id === r.offerId);
    return t + (o ? Math.round(o.price / (o.termMonths / 12)) : 0);
  }, 0);

  // ---- rank the urgent three
  const exByAcct = new Map<string, PolicyException[]>();
  for (const e of audit.exceptions) exByAcct.set(e.accountId, [...(exByAcct.get(e.accountId) ?? []), e]);
  const ranked = live
    .filter((x) => !x.renewed && x.h.daysToRenewal >= -15 && x.h.daysToRenewal <= 180 && (x.h.tier !== "healthy" || (exByAcct.get(x.a.id) ?? []).some((e) => e.severity === "critical" || e.severity === "high")))
    .map((x) => ({ ...x, ex: exByAcct.get(x.a.id) ?? [], score: score(x.a.arr, x.h.risk, x.h.daysToNotice, exByAcct.get(x.a.id) ?? []) }))
    .sort((p, q) => q.score - p.score)
    .slice(0, 3);

  const top3: UrgentItem[] = ranked.map(({ a, h, ex, score: sc }, idx) => {
    const why: UrgentItem["why"] = [];
    const total = h.signals.reduce((t, x) => t + x.contribution, 0) || 1;
    for (const sig of [...h.signals].sort((x, y) => y.contribution - x.contribution).filter((x) => x.value > 0.15).slice(0, 3)) {
      const cite = citeSignal(src, a, sig);
      const pts = Math.round((h.risk * sig.contribution) / total);
      why.push({ text: `${sig.evidence.charAt(0).toUpperCase() + sig.evidence.slice(1)} (~${pts} of ${h.risk} risk points)`, cites: cite ? [cite] : [] });
    }
    const noticeBy = addDays(a.contract.end, -a.contract.noticeDays);
    const nCite = citeClause(src, a, "notice", `notice deadline ${day(noticeBy)} (${h.daysToNotice >= 0 ? `in ${h.daysToNotice} days` : `passed ${-h.daysToNotice} days ago`})`);
    const tCite = citeClause(src, a, "term", `renews ${day(a.contract.end)} (in ${h.daysToRenewal} days)`);
    why.push({ text: `Renewal on ${day(a.contract.end)}; the customer can give notice until ${day(noticeBy)}`, cites: [tCite, nCite].filter(Boolean) as string[] });
    if (a.contract.upliftPct >= 7) {
      const uCite = citeClause(src, a, "uplift");
      if (uCite) why.push({ text: `Contract allows a ${a.contract.upliftPct}% renewal uplift`, cites: [uCite] });
    }
    const exceptions = ex
      .sort((x, y) => ["critical", "high", "medium", "low"].indexOf(x.severity) - ["critical", "high", "medium", "low"].indexOf(y.severity))
      .slice(0, 3)
      .map((e) => {
        const rule = meta.rules.find((r) => r.id === e.ruleId);
        const cite = src.add(`rule:${e.ruleId}`, {
          kind: "rule",
          source: `Policy ${e.ruleId} · ${meta.file} line ${lines[e.ruleId] ?? "?"} · rules v${meta.version}`,
          detail: `${e.ruleName}: ${rule ? whenText(rule.when, (v, k) => fmtValue(v, FIELD[k]?.type)) : ""}`,
        });
        const evid = src.add(`ex:${e.key}`, {
          kind: "log",
          accountId: a.id,
          source: `Audit #${audit.n} · ${IST(audit.at)} · exception ${e.key}`,
          detail: `${e.accountName} tripped ${e.ruleId}: ${e.evidence.map((x) => `${x.field} = ${x.actual}`).join(", ")}.`,
        });
        return { ruleId: e.ruleId, ruleName: e.ruleName, severity: e.severity, message: e.message, cite: `${cite},${evid}` };
      });
    // what Clutch already did (run log)
    const run = [...s.runs].reverse().find((r) => r.accountId === a.id);
    let status = "No play started yet";
    if (run) {
      const done = run.steps.filter((x) => x.status === "done");
      const lastStep = done[done.length - 1];
      const logCite = lastStep
        ? src.add(`run:${run.id}`, { kind: "log", accountId: a.id, source: `Play run ${run.id} · ${PLAYBOOK[run.play]?.label ?? run.play} · ${IST(lastStep.endedAt ?? run.startedAt)}`, detail: `Step “${lastStep.label}” — ${lastStep.output ?? "done"}. ${done.length}/${run.steps.length} steps complete, status ${run.status}.` })
        : null;
      status = `${PLAYBOOK[run.play]?.label ?? run.play} play ${run.status} (${done.length}/${run.steps.length} steps)${logCite ? ` [${logCite}]` : ""}`;
    }
    const play = PLAYBOOK[h.cause];
    return {
      rank: idx + 1,
      accountId: a.id,
      name: a.name,
      industry: a.industry,
      arr: a.arr,
      risk: h.risk,
      tier: h.tier,
      daysToRenewal: h.daysToRenewal,
      daysToNotice: h.daysToNotice,
      renewalDate: a.contract.end,
      noticeBy,
      expectedLoss: Math.round((h.risk / 100) * a.arr),
      score: Math.round(sc),
      headline: h.why.replace(/\.$/, ""),
      why,
      exceptions,
      recommended: play ? `${play.label} — ${play.outcome}` : h.cause,
      status,
    };
  });

  // every open exception, cited, for the appendix / CSV
  const exceptions = audit.exceptions.map((e) => {
    const cite = src.add(`rule:${e.ruleId}`, {
      kind: "rule",
      source: `Policy ${e.ruleId} · ${meta.file} line ${lines[e.ruleId] ?? "?"} · rules v${meta.version}`,
      detail: `${e.ruleName}: ${(() => {
        const r = meta.rules.find((x) => x.id === e.ruleId);
        return r ? whenText(r.when, (v, k) => fmtValue(v, FIELD[k]?.type)) : "";
      })()}`,
    });
    return { ...e, cite };
  });

  const base: Omit<Brief, "summary" | "fingerprint"> = {
    id: `brief_${Date.now().toString(36)}`,
    generatedAt: Date.now(),
    generatedLabel: IST(Date.now()),
    workspace: "Helpdeck",
    run: { auditN: audit.n, auditAt: audit.at, rulesVersion: audit.version, ms: 0, file: meta.file, trigger: audit.trigger },
    processed,
    impact: {
      arrUnderManagement: accounts.reduce((t, a) => t + a.arr, 0),
      arrUpForRenewal: window.reduce((t, x) => t + x.a.arr, 0),
      renewalsIn120: window.length,
      arrAtRisk: atRisk.reduce((t, x) => t + x.a.arr, 0),
      atRiskCount: atRisk.length,
      expectedLoss: Math.round(window.reduce((t, x) => t + (x.h.risk / 100) * x.a.arr, 0)),
      exposure: audit.exposure,
      exceptionsOpen: audit.counts.total,
      exceptionsNew: audit.counts.new,
      bySeverity: { critical: audit.counts.critical, high: audit.counts.high, medium: audit.counts.medium, low: audit.counts.low },
      arrRenewed: renewedArr,
      savedArr: s.saves.reduce((t, x) => t + x.arr, 0),
      top3Arr: top3.reduce((t, x) => t + x.arr, 0),
      top3Loss: top3.reduce((t, x) => t + x.expectedLoss, 0),
    },
    top3,
    exceptions,
    citations: src.list,
    method: [
      "Risk = 1 − Π(1 − wᵢ·sᵢ·2) over seven weighted signals (usage trend, feature depth, seat utilisation, champion, support pain, sentiment, billing), ×1.07–1.15 when the notice window is close.",
      "Expected loss = risk × ARR for every unrenewed account renewing in the next 120 days.",
      "Urgency rank = risk² × ARR × notice-window factor (1.5 if ≤ 15 days) × (1 + 0.15 × severity of open policy exceptions).",
      `Policy exceptions come from audit #${audit.n} of ${meta.file} (rules v${meta.version}); each cites the rule line and the exact values that tripped it.`,
      "All figures are computed deterministically from source records; the narrative paragraph is AI-written and rejected if it contains any number not present in these figures.",
    ],
  };

  // ---- narrative (optional, grounded)
  const factLines = narrativeFacts(base);
  let summary: Brief["summary"] = { text: templateSummary(base), model: null, grounded: true };
  if (opts.narrative !== false) {
    const out = await llmJSON<{ summary?: string }>(
      "You write the opening paragraph of a board-level renewal risk brief for a B2B SaaS company. Use ONLY the facts given. Keep every number exactly as written (same units, e.g. ₹4.4 Cr). 70–100 words, plain business English, no bullet points, no headings.",
      `Facts:\n${factLines.join("\n")}\n\nReturn {"summary": "..."}`,
      { maxTokens: 400, timeoutMs: 7000 },
    ).catch(() => null);
    const text = out?.data?.summary?.trim();
    if (text && text.length > 80 && grounded(text, factLines.join(" ") + " " + templateSummary(base))) summary = { text, model: out!.model, grounded: true };
  }
  base.run.ms = Date.now() - t0;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ i: base.impact, t: base.top3.map((x) => [x.accountId, x.risk, x.score]), a: base.run.auditN }))
    .digest("hex")
    .slice(0, 16);
  latest = { ...base, summary, fingerprint };
  return latest;
}

export async function currentBrief() {
  return latest ?? compileBrief();
}
