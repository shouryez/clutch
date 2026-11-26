/**
 * "What will this button do?" — the play, personalised to one account, before it runs.
 * The runner uses the same recipient + pricing helpers, so the preview is what happens.
 */
import { listPrice, POLICY, validate, type Proposal } from "./dealdesk";
import { inr, inrCompact } from "./format";
import { PLAYBOOK } from "./playbook";
import { getAccount, getHealth, store } from "./store";
import type { Account, Contact, PlayKey } from "./types";
import { valueOf } from "./value";

const EXEC = /cfo|ceo|coo|cto|vp|ciso/i;
const FIN = /finance|accounts|procure|cfo/i;

/** Who gets the order form: an active champion, else the most active reachable non-exec, plus finance in copy. */
export function orderFormRecipients(a: Account) {
  const reachable = a.contacts.filter((x) => !x.bounced && !EXEC.test(x.role));
  const champ = a.contacts.find((x) => x.isChampion);
  const to =
    a.contacts.find((x) => x.isChampion && !x.bounced && x.lastActiveDaysAgo <= 7) ??
    [...reachable].sort((x, y) => x.lastActiveDaysAgo - y.lastActiveDaysAgo)[0] ??
    a.contacts.find((x) => !x.bounced)!;
  const cc = a.contacts.find((x) => FIN.test(x.role) && x.id !== to.id);
  const skipped = champ && champ.id !== to.id ? champ : undefined;
  return { to, cc, skipped };
}

export function nextStakeholder(a: Account) {
  return a.contacts.filter((x) => !x.bounced && !x.isChampion).sort((x, y) => x.lastActiveDaysAgo - y.lastActiveDaysAgo)[0] ?? a.contacts[0];
}

export function execSponsor(a: Account) {
  return a.contacts.find((x) => x.isExecSponsor) ?? a.contacts.find((x) => EXEC.test(x.role)) ?? a.contacts[0];
}

export function financeContact(a: Account) {
  return a.contacts.find((x) => FIN.test(x.role)) ?? a.contacts[0];
}

export function rightsizeSeats(a: Account) {
  return Math.ceil(Math.max(...a.usage.slice(-28).map((d) => d.activeUsers)) * 1.1);
}

/** The exact proposal each play prices. */
export function quoteParams(play: PlayKey, a: Account): Proposal & { seats: number; extras: string[] } {
  switch (play) {
    case "competitor":
      return { discountPct: 0.1, termMonths: 24, extras: ["onboarding"], seats: a.seats };
    case "expansion":
      return { discountPct: 0, termMonths: 12, extras: [], seats: a.seats + 30 };
    case "rightsize":
      return { discountPct: 0, termMonths: 24, extras: [], seats: rightsizeSeats(a) };
    default:
      return { discountPct: 0, termMonths: 12, extras: [], seats: a.seats };
  }
}

const who = (c?: Contact) => (c ? `${c.name} (${c.role})` : "—");
const seen = (c: Contact) => (c.bounced ? "email bouncing" : c.lastActiveDaysAgo === 0 ? "active today" : `active ${c.lastActiveDaysAgo}d ago`);

export function planFor(accountId: string, play: PlayKey) {
  const a = getAccount(accountId);
  if (!a) return null;
  const h = getHealth(accountId);
  const doc = PLAYBOOK[play];
  const v = valueOf(a);
  const q = quoteParams(play, a);
  const priced = play === "expansion" ? { ...a, plan: "Enterprise" as const, pricePerSeatMonth: 10000 } : a;
  const verdict = validate(priced, q);
  const price = verdict.ok ? verdict.price : listPrice(priced, q.seats, q.termMonths);
  const rec = orderFormRecipients(a);
  const fin = financeContact(a);
  const next = nextStakeholder(a);
  const exec = execSponsor(a);
  const champ = a.contacts.find((x) => x.isChampion);
  const openBug = a.tickets.filter((t) => t.status === "open").sort((x, y) => x.priority.localeCompare(y.priority))[0];
  const issue = openBug?.topic ? store().issues.find((i) => i.topic === openBug.topic) : undefined;
  const affected = openBug?.topic ? store().accounts.filter((x) => x.tickets.some((t) => t.topic === openBug.topic && t.status === "open")) : [];
  const comp = a.tickets.find((t) => t.competitor)?.competitor;
  const failed = a.invoices.filter((i) => i.status === "failed");
  const newEnd = (() => {
    const d = new Date(a.contract.end + "T00:00:00");
    d.setMonth(d.getMonth() + q.termMonths);
    return d.toISOString().slice(0, 10);
  })();
  const missing = ["automations", "reports", "sla", "integrations", "exports"].filter((f) => !a.features.includes(f)).slice(0, 2);
  const peak = Math.max(...a.usage.slice(-28).map((d) => d.activeUsers));

  const detail: Record<string, string> = {
    health: `Risk is ${h.risk} today: ${h.why.replace(/^Healthy: /, "")}`,
    value_recap: `${v.conversations.toLocaleString("en-IN")} conversations, ${v.hoursSaved.toLocaleString("en-IN")} agent-hours saved (≈ ${inrCompact(v.valueInr)}) in the last 90 days.`,
    quote: `${inr(price)} · ${q.seats} seats · ${q.termMonths} months${q.discountPct ? ` · −${Math.round(q.discountPct * 100)}%` : ` · +${a.contract.upliftPct}% contractual uplift`}${q.extras.length ? ` · + ${q.extras.join(", ")}` : ""}. ${verdict.ok ? (verdict.needsApproval ? "Needs a manager." : "Inside policy, no approval needed.") : verdict.reasons[0]}`,
    send_order_form: `To ${who(rec.to)}${rec.cc ? `, cc ${rec.cc.name} (finance)` : ""}.${rec.skipped ? ` Skips ${rec.skipped.name.split(" ")[0]} — ${seen(rec.skipped)}.` : ""}`,
    await_signature: `${rec.to.name.split(" ")[0]} signs on any device; billing waits for the webhook.`,
    billing: `${a.stripeSubscriptionId}: ${a.seats} → ${q.seats} seats · ${inr(Math.round(price / (q.termMonths / 12)))}/yr · term ends ${newEnd}.`,
    slack: `#renewals gets a one-line summary.`,
    escalate: openBug
      ? issue
        ? `Already filed as #${issue.number} — links this account to it.`
        : `Files “${openBug.subject}” as P0 — blocks ${inrCompact(affected.reduce((t, x) => t + x.arr, 0) || a.arr)} across ${Math.max(1, affected.length)} account${affected.length > 1 ? "s" : ""}.`
      : "No open blocker — this step is skipped.",
    intel: `${comp ?? "Competitor"} for ${a.seats} seats. Switching would cost them ≈ ${inrCompact(a.seats * 15000)} in migration and retraining.`,
    call: `Calls ${who(rec.to)}. You can listen live from the call page. Ladder: 5% → 8% → 10% alone; 12–15% only after you approve.`,
    eta: `To ${who(rec.to)} about #${openBug?.number ?? "—"}: fix ships Thursday.`,
    credit: `1 free month = ${inr(a.seats * a.pricePerSeatMonth)}. Allowed without approval.`,
    stakeholder: `${champ ? `${champ.name} (${seen(champ)})` : "No champion"} → ${next.name}, ${next.role}, ${seen(next)}.`,
    intro: `From Helpdeck's CEO to ${who(exec)}, introducing ${next.name.split(" ")[0]} as the new owner.`,
    meeting: `30-minute renewal check-in with ${next.name}, in the next 3 working days.`,
    training: `To ${who(rec.to)}: free session on ${missing.join(" & ") || "advanced workflows"}.`,
    qbr: `With ${who(exec)}.`,
    paylink: `To ${who(fin)} — ${failed.length || 1} failed invoice${failed.length > 1 ? "s" : ""} worth ${inr(failed.reduce((t, i) => t + i.amount, 0) || a.arr / 12)}.`,
    confirm: `${fin.name.split(" ")[0]} updates the card; Clutch retries the moment Stripe confirms.`,
    retry: `Retries ${failed.length || 1} invoice${failed.length > 1 ? "s" : ""}.`,
    detect: `${peak} of ${a.seats} seats in use at peak${a.tickets.some((t) => t.asks?.includes("SSO")) ? " · asked for SSO" : ""}.`,
    upgrade: `${a.plan} → Enterprise (adds SAML SSO, audit log).`,
    size: `${peak} peak active of ${a.seats} licensed → ${rightsizeSeats(a)} seats on 24 months.`,
  };

  const now = { arr: a.arr, seats: a.seats };
  const after = { arr: Math.round(price / (q.termMonths / 12)), seats: q.seats, termMonths: q.termMonths, price };
  const closes = doc.steps.some((s) => s.key === "billing");
  return {
    accountId: a.id,
    accountName: a.name,
    play,
    ...doc,
    recommended: h.cause === play,
    why: h.why,
    risk: h.risk,
    steps: doc.steps.map((s) => ({ ...s, detail: detail[s.key] ?? "" })),
    humans: doc.steps.filter((s) => s.human).map((s) => s.human!),
    deal: closes ? { now, after, discountPct: q.discountPct, needsApproval: verdict.ok && verdict.needsApproval } : null,
    policy: { max: POLICY.maxDiscount, approvalAbove: POLICY.approvalAbove },
  };
}

export type Plan = NonNullable<ReturnType<typeof planFor>>;
