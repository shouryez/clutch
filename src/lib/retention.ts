/**
 * Cancel interceptor: when a customer clicks "Cancel subscription", Clutch already knows
 * their usage, their open tickets and their contract — so the save offer is specific,
 * and every offer passes the same deal-desk guardrails.
 */
import { updateSubscription } from "./adapters";
import { listPrice, validate } from "./dealdesk";
import { inr, inrCompact } from "./format";
import { daysUntil, usageWindows } from "./risk";
import { emit, getAccount, recompute, store } from "./store";

export type Reason = "bugs" | "price" | "usage" | "switching" | "feature" | "other";

export type SaveOffer = {
  key: string;
  title: string;
  detail: string;
  impact: string; // what it costs us
  tag?: string;
};

export type SaveRecord = { accountId: string; reason: Reason; offerKey: string; arr: number; at: number; note?: string };

export const REASONS: { key: Reason; label: string }[] = [
  { key: "bugs", label: "Things keep breaking" },
  { key: "price", label: "It's too expensive" },
  { key: "usage", label: "We're not using it enough" },
  { key: "switching", label: "We're moving to another tool" },
  { key: "feature", label: "It's missing something we need" },
  { key: "other", label: "Something else" },
];

export function cancelContext(accountId: string) {
  const a = getAccount(accountId);
  if (!a) return null;
  const uw = usageWindows(a);
  const last30 = a.usage.slice(-30);
  const exportTickets = a.tickets.filter((t) => t.topic === "csv-export" && t.status === "open");
  const openTickets = a.tickets.filter((t) => t.status === "open");
  const issue = store().issues.find((i) => i.topic === "csv-export");
  const activePeak = Math.max(...last30.map((d) => d.activeUsers));
  const likely: Reason = exportTickets.length ? "bugs" : uw.sixWeekChange < -0.2 || activePeak < a.seats * 0.6 ? "usage" : "price";
  const champ = a.contacts.find((c) => c.isChampion) ?? a.contacts[0];
  return {
    account: { id: a.id, name: a.name, plan: a.plan, seats: a.seats, arr: a.arr, pricePerSeatMonth: a.pricePerSeatMonth, city: a.city },
    user: { name: champ.name, role: champ.role, email: champ.email },
    renewal: { date: a.contract.end, inDays: daysUntil(a.contract.end), noticeDays: a.contract.noticeDays },
    facts: {
      exportFailures: exportTickets.length ? 3 + exportTickets.length * 4 : 0,
      exportTicket: exportTickets[0]?.number ?? null,
      fixIssue: issue ? issue.number : null,
      openTickets: openTickets.length,
      activePeak,
      ticketsHandled90d: Math.round(a.usage.slice(-90).reduce((s, d) => s + d.events, 0) / 9),
      usageChangePct: Math.round(uw.sixWeekChange * 100),
    },
    likely,
    reasons: REASONS,
    saved: store().saves.find((s) => s.accountId === a.id) ?? null,
    churned: store().churned.get(a.id) ?? null,
  };
}

export function offersFor(accountId: string, reason: Reason): SaveOffer[] {
  const a = getAccount(accountId)!;
  const ctx = cancelContext(accountId)!;
  const monthly = Math.round(a.arr / 12);
  const rightSeats = Math.max(5, Math.ceil(ctx.facts.activePeak * 1.1));
  const rightPrice = listPrice(a, rightSeats, 12);
  const lock = validate(a, { discountPct: 0.1, termMonths: 24, extras: ["onboarding"] });
  const out: SaveOffer[] = [];

  if (reason === "bugs") {
    out.push({
      key: "fix-credit",
      title: "Stay while we fix it — on us",
      detail: `The export fix ships Thursday${ctx.facts.fixIssue ? ` (engineering issue #${ctx.facts.fixIssue}, P0)` : ""}. We'll credit your next month and email you the moment it's live.`,
      impact: `1 free month · ${inr(monthly)}`,
      tag: "Recommended",
    });
    out.push({ key: "pause", title: "Pause instead of cancel", detail: "Freeze billing for 2 months. Your data, automations and seats stay exactly as they are.", impact: "2 months paused" });
  }
  if (reason === "price") {
    out.push({
      key: "rightsize",
      title: `Pay for ${rightSeats} seats, not ${a.seats}`,
      detail: `Your busiest day this month had ${ctx.facts.activePeak} agents online. Drop to ${rightSeats} seats and keep everything else.`,
      impact: `${inr(rightPrice)}/yr instead of ${inr(listPrice(a))}`,
      tag: "Recommended",
    });
    if (lock.ok) out.push({ key: "lock", title: "10% off if you stay two years", detail: "Lock today's price for 24 months, plus free onboarding for new agents.", impact: `${inr(lock.price)} over 24 months` });
  }
  if (reason === "usage") {
    out.push({ key: "training", title: "Let us get your team using it", detail: `A free 45-minute session on the features you haven't switched on yet, plus 1 free month while you ramp up.`, impact: `1 free month · ${inr(monthly)}`, tag: "Recommended" });
    out.push({ key: "pause", title: "Pause for 2 months", detail: "Quiet season? Freeze billing and pick up where you left off.", impact: "2 months paused" });
  }
  if (reason === "switching") {
    if (lock.ok) out.push({ key: "lock", title: "10% off for two years", detail: `Moving ${a.seats} agents costs roughly ${inrCompact(a.seats * 15000)} in retraining and migration. Stay, and we'll beat that with a locked price and free onboarding.`, impact: `${inr(lock.price)} over 24 months`, tag: "Recommended" });
    out.push({ key: "call", title: "Talk to a human first", detail: "Your account manager will call you today. If we can't fix it, cancellation goes through with no questions.", impact: "a call today" });
  }
  if (reason === "feature" || reason === "other") {
    out.push({ key: "free-month", title: "Give us a month to make it right", detail: "Tell us what's missing. We'll credit a month while the product team looks at it, and reply within 48 hours.", impact: `1 free month · ${inr(monthly)}`, tag: "Recommended" });
    out.push({ key: "pause", title: "Pause for 2 months", detail: "Keep your data and setup; billing stops until you come back.", impact: "2 months paused" });
  }
  return out;
}

export async function applySave(accountId: string, reason: Reason, offerKey: string, note?: string) {
  const a = getAccount(accountId)!;
  const offer = offersFor(accountId, reason).find((o) => o.key === offerKey);
  if (!offer) throw new Error("offer not available");
  if (offerKey === "rightsize") {
    const ctx = cancelContext(accountId)!;
    a.seats = Math.max(5, Math.ceil(ctx.facts.activePeak * 1.1));
    a.arr = a.seats * a.pricePerSeatMonth * 12;
  }
  const r = await updateSubscription({ id: a.stripeSubscriptionId, annual: a.arr, termMonths: offerKey === "lock" ? 24 : 12, seats: a.seats });
  const rec: SaveRecord = { accountId, reason, offerKey, arr: a.arr, at: Date.now(), note };
  store().saves.push(rec);
  // they told us why — log it where the bug radar and risk engine can see it
  a.tickets.push({
    id: `t-save-${Date.now()}`,
    number: 3400 + store().saves.length,
    subject: `Cancellation intercepted: ${REASONS.find((x) => x.key === reason)!.label}`,
    body: note || `Accepted: ${offer.title}.`,
    priority: "P2",
    status: "solved",
    openedDaysAgo: 0,
    sentiment: 0.1,
    topic: reason === "bugs" ? "csv-export" : undefined,
  });
  recompute(accountId);
  emit({ kind: "deal", accountId, accountName: a.name, title: `Cancellation intercepted — ${a.name} stayed`, detail: `${offer.title} · ${offer.impact} · ${inrCompact(a.arr)} ARR kept${r.mode === "mock" ? " · billing simulated" : ""}`, tone: "good" });
  return rec;
}

export function confirmCancel(accountId: string, reason: Reason, note?: string) {
  const a = getAccount(accountId)!;
  store().churned.set(accountId, { reason, at: Date.now() });
  emit({ kind: "signal", accountId, accountName: a.name, title: `${a.name} cancelled`, detail: `${REASONS.find((x) => x.key === reason)!.label}${note ? ` — “${note}”` : ""} · ${inrCompact(a.arr)} ARR lost`, tone: "risk" });
}

export function undoCancel(accountId: string) {
  store().churned.delete(accountId);
  store().saves = store().saves.filter((s) => s.accountId !== accountId);
}
