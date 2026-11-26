/**
 * Revenue bug radar: cluster open tickets by root cause, price each bug in ARR,
 * file it with the money attached, and close the loop with every affected
 * customer the moment the fix ships.
 */
import { createIssue, sendEmail } from "./adapters";
import { inrCompact } from "./format";
import { emit, getAccount, getHealth, recompute, record, store, type Issue } from "./store";
import type { Account } from "./types";

export const TOPIC_TITLE: Record<string, string> = {
  "csv-export": "CSV export times out above 10k rows",
  sla: "SLA timers don't pause on weekends",
  "slack-integration": "Slack integration double-posts tickets",
  reports: "Report filters reset on refresh",
};

type Row = { id: string; name: string; arr: number; quote: string; daysToRenewal: number; ticket: number; risk: number; tier: string };

export function clusters() {
  const s = store();
  const map = new Map<string, { topic: string; title: string; accounts: Row[] }>();
  for (const a of s.accounts) {
    for (const t of a.tickets) {
      if (!t.topic || t.status !== "open") continue;
      const c = map.get(t.topic) ?? { topic: t.topic, title: TOPIC_TITLE[t.topic] ?? t.subject, accounts: [] };
      if (!c.accounts.some((x) => x.id === a.id)) {
        const h = getHealth(a.id);
        c.accounts.push({ id: a.id, name: a.name, arr: a.arr, quote: t.body.split(/(?<=[.!?])\s/)[0], daysToRenewal: h.daysToRenewal, ticket: t.number, risk: h.risk, tier: h.tier });
      }
      map.set(t.topic, c);
    }
  }
  return [...map.values()]
    .map((c) => {
      const accounts = c.accounts.sort((x, y) => y.arr - x.arr);
      const arr = accounts.reduce((t, x) => t + x.arr, 0);
      const renewalsIn90 = accounts.filter((x) => x.daysToRenewal >= 0 && x.daysToRenewal <= 90).length;
      return { ...c, accounts, arr, renewalsIn90, issue: s.issues.find((i) => i.topic === c.topic) ?? null, draft: draft(c.title, accounts, arr, renewalsIn90) };
    })
    .sort((x, y) => y.arr - x.arr);
}

function draft(title: string, accounts: Row[], arr: number, renewalsIn90: number) {
  return {
    title,
    labels: ["P0", "revenue-at-risk", "customer-reported"],
    body: [
      `## ${inrCompact(arr)} ARR blocked across ${accounts.length} accounts`,
      `${renewalsIn90} of them renew within 90 days.`,
      "",
      "| Account | ARR | Renews in | Ticket |",
      "|---|---|---|---|",
      ...accounts.map((a) => `| ${a.name} | ${inrCompact(a.arr)} | ${a.daysToRenewal}d | #${a.ticket} |`),
      "",
      "### In their words",
      ...accounts.slice(0, 4).map((a) => `> “${a.quote}” — ${a.name}`),
      "",
      "### When this closes",
      `Clutch emails every affected customer that the fix is live, closes their tickets and re-scores their renewal risk.`,
      "",
      "_Filed by Clutch revenue bug radar._",
    ].join("\n"),
  };
}

/** File a cluster as a P0 (idempotent). */
export async function fileTopic(topic: string, source = "Bug radar") {
  const existing = store().issues.find((i) => i.topic === topic);
  if (existing) return existing;
  const c = clusters().find((x) => x.topic === topic);
  if (!c) return null;
  const r = await createIssue({ title: c.draft.title, body: c.draft.body, labels: c.draft.labels });
  const issue: Issue = { number: r.number, topic, title: c.title, arr: c.arr, accounts: c.accounts.map((a) => a.name), url: r.url, at: Date.now(), mode: r.mode, body: c.draft.body };
  store().issues.push(issue);
  record({ kind: "issue", mode: r.mode, title: `#${r.number} ${c.title}`, to: "helpdeck/core", body: c.draft.body, meta: [["Labels", c.draft.labels.join(", ")], ["ARR blocked", inrCompact(c.arr)], ["Accounts", String(c.accounts.length)], ["Filed by", source]], link: "/app/radar" });
  emit({ kind: "signal", title: `Filed #${r.number}: ${c.title}`, detail: `P0 · ${inrCompact(c.arr)} ARR at risk · ${c.accounts.length} accounts${r.mode === "mock" ? " · sandbox" : ""}`, tone: "risk" });
  return issue;
}

function contactFor(a: Account) {
  return (
    a.contacts.find((c) => c.isChampion && !c.bounced && c.lastActiveDaysAgo <= 10) ??
    [...a.contacts].filter((c) => !c.bounced).sort((x, y) => x.lastActiveDaysAgo - y.lastActiveDaysAgo)[0] ??
    a.contacts[0]
  );
}

/**
 * Engineering closed the issue: tell every affected customer, close their
 * tickets, and re-score them. This is the GitHub "issue closed" webhook.
 */
export async function shipFix(topic: string) {
  const issue = store().issues.find((i) => i.topic === topic);
  if (!issue) throw new Error("file the issue first");
  if (issue.fixedAt) return issue;
  const affected = store().accounts.filter((a) => a.tickets.some((t) => t.topic === topic && t.status === "open"));
  const notified: NonNullable<Issue["notified"]> = [];
  for (const a of affected) {
    const before = getHealth(a.id).risk;
    const tickets = a.tickets.filter((t) => t.topic === topic && t.status === "open");
    for (const t of tickets) {
      t.status = "solved";
      t.sentiment = Math.max(t.sentiment, 0.2);
      t.competitor = undefined;
    }
    const c = contactFor(a);
    const body = `Hi ${c.name.split(" ")[0]},\n\nYou told us “${tickets[0].body.split(/(?<=[.!?])\s/)[0]}” (ticket #${tickets[0].number}).\n\nThat's fixed. ${issue.title.replace(/ times out.*/, "")} is live for your workspace as of today — we load-tested it at 50,000 rows. Your ticket is closed; reply to this email if anything still looks off and it comes straight to me.\n\nThanks for your patience,\nMeera Kapoor\nCustomer Success, Helpdeck`;
    const r = await sendEmail({ to: [c.email], subject: `Fixed: ${issue.title}`, body });
    record({ kind: "email", mode: r.mode, accountId: a.id, accountName: a.name, title: `Fixed: ${issue.title}`, to: `${c.name} <${c.email}>`, body, meta: [["Issue", `#${issue.number}`], ["Ticket", `#${tickets[0].number} → solved`]] });
    recompute(a.id);
    const after = getHealth(a.id).risk;
    notified.push({ id: a.id, name: a.name, contact: c.name, before, after });
    emit({ kind: "signal", accountId: a.id, accountName: a.name, title: `Told ${c.name.split(" ")[0]} the fix is live`, detail: `#${tickets[0].number} closed · risk ${before} → ${after}`, tone: "good" });
  }
  issue.fixedAt = Date.now();
  issue.notified = notified;
  const drop = notified.reduce((t, n) => t + (n.before - n.after), 0);
  emit({ kind: "signal", title: `#${issue.number} shipped — ${notified.length} customers told`, detail: `${issue.title} · risk down ${drop} points across ${notified.length} accounts`, tone: "good" });
  return issue;
}

export function resolvedIssues() {
  return store()
    .issues.filter((i) => i.fixedAt)
    .map((i) => ({ ...i, accountsArr: (i.notified ?? []).reduce((t, n) => t + (getAccount(n.id)?.arr ?? 0), 0) }));
}
