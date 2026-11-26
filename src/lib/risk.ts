/**
 * Signal engine: a transparent weighted model. Every point of risk traces back
 * to a piece of evidence, so the "why" sentence is never a black box.
 */
import { CORE_FEATURES, startOfToday } from "./seed";
import type { Account, Health, PlayKey, Signal, SignalKey } from "./types";

const WEIGHTS: Record<SignalKey, number> = {
  usage: 0.22,
  depth: 0.1,
  seats: 0.14,
  champion: 0.18,
  support: 0.14,
  sentiment: 0.14,
  billing: 0.12,
};
/** each signal can push risk up to (weight × GAIN); signals compound: risk = 1 − Π(1 − wᵢ·sᵢ·GAIN) */
const GAIN = 2.0;

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const DAY = 86_400_000;

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function usageWindows(a: Account) {
  const u = a.usage.map((d) => d.activeUsers);
  const last = avg(u.slice(-14));
  const prev = avg(u.slice(-42, -14));
  const base = avg(u.slice(-112, -56));
  const weekdays = a.usage.slice(-28).filter((d) => {
    const g = new Date(d.date + "T00:00:00").getDay();
    return g !== 0 && g !== 6;
  });
  const weekdayAvg = avg(weekdays.map((d) => d.activeUsers));
  return { last, prev, base, change: prev ? (last - prev) / prev : 0, sixWeekChange: base ? (last - base) / base : 0, weekdayAvg };
}

export function daysUntil(isoDate: string) {
  return Math.round((new Date(isoDate + "T00:00:00").getTime() - startOfToday().getTime()) / DAY);
}

export function computeHealth(a: Account): Health {
  const signals: Signal[] = [];
  const push = (key: SignalKey, label: string, value: number, evidence: string, ref?: Signal["ref"]) =>
    signals.push({ key, label, weight: WEIGHTS[key], value: clamp(value), contribution: 0, evidence, ref });

  // usage trend (compare to 8-12 weeks ago so slow declines are caught)
  const uw = usageWindows(a);
  const drop = Math.max(-uw.change, -uw.sixWeekChange, 0);
  push("usage", "Usage trend", drop / 0.45, drop > 0.04 ? `usage down ${Math.round(drop * 100)}% in 6 weeks` : "usage steady", { kind: "usage", id: "28d" });

  // feature depth
  const depth = a.features.length / CORE_FEATURES.length;
  push("depth", "Feature depth", (0.75 - depth) / 0.6, `uses ${a.features.length} of ${CORE_FEATURES.length} core features`);

  // seat utilisation (weekday peak vs licensed)
  const util = uw.weekdayAvg / a.seats;
  push("seats", "Seat utilisation", (0.72 - util) / 0.3, `${Math.round(util * 100)}% of seats active`, { kind: "usage", id: "seats" });

  // champion
  const champ = a.contacts.find((c) => c.isChampion);
  if (champ) {
    const v = champ.bounced ? 1 : clamp((champ.lastActiveDaysAgo - 5) / 12);
    const ev = champ.bounced
      ? `champion ${champ.name.split(" ")[0]}'s email is bouncing`
      : champ.lastActiveDaysAgo > 7
        ? `champion ${champ.name.split(" ")[0]} inactive ${champ.lastActiveDaysAgo} days`
        : `champion ${champ.name.split(" ")[0]} active`;
    push("champion", "Champion", v, ev, { kind: "contact", id: champ.id });
  } else {
    push("champion", "Champion", 0.7, "no identified champion");
  }

  // support pain: open P1/P2 weighted by age
  const open = a.tickets.filter((t) => t.status === "open");
  const pain = open.reduce((s, t) => s + (t.priority === "P1" ? 1.6 : t.priority === "P2" ? 0.8 : 0.2) * Math.min(t.openedDaysAgo, 30), 0);
  const worst = [...open].sort((x, y) => x.priority.localeCompare(y.priority) || y.openedDaysAgo - x.openedDaysAgo)[0];
  push(
    "support",
    "Support pain",
    pain / 40,
    worst ? `${worst.priority} #${worst.number} open ${worst.openedDaysAgo} days` : "no open tickets",
    worst ? { kind: "ticket", id: worst.id } : undefined,
  );

  // sentiment + competitor
  const texts = [
    ...a.tickets.filter((t) => t.openedDaysAgo <= 60).map((t) => ({ s: t.sentiment, comp: t.competitor, id: t.id, kind: "ticket" as const, n: `#${t.number}` })),
    ...a.emails.filter((e) => e.daysAgo <= 60 && !e.bounced).map((e) => ({ s: e.sentiment, comp: undefined, id: e.id, kind: "email" as const, n: "email" })),
  ];
  const comp = texts.find((x) => x.comp);
  const minS = texts.length ? Math.min(...texts.map((x) => x.s)) : 0.2;
  if (comp) push("sentiment", "Sentiment", 0.95, `ticket ${comp.n} mentions ${comp.comp}`, { kind: comp.kind, id: comp.id });
  else {
    const w = texts.sort((x, y) => x.s - y.s)[0];
    push("sentiment", "Sentiment", (-minS - 0.15) / 0.65, minS < -0.15 && w ? `negative tone in ${w.n}` : "tone neutral", w ? { kind: w.kind, id: w.id } : undefined);
  }

  // billing
  const failed = a.invoices.filter((i) => i.status === "failed").length + a.emails.filter((e) => e.subject.startsWith("Payment failed")).length;
  // cite the record that proves it: the failed invoice, else the payment-failed notice
  const badInvoice = a.invoices.find((i) => i.status === "failed");
  const badMail = a.emails.find((e) => e.subject.startsWith("Payment failed"));
  push("billing", "Billing friction", failed / 2, failed ? `${failed} failed payment${failed > 1 ? "s" : ""}` : "payments on time", badInvoice ? { kind: "invoice", id: badInvoice.id } : badMail ? { kind: "email", id: badMail.id } : undefined);

  // deadline pressure
  const daysToRenewal = daysUntil(a.contract.end);
  const daysToNotice = daysToRenewal - a.contract.noticeDays;
  const deadlineMultiplier = daysToNotice <= 15 ? 1.15 : daysToNotice <= 45 ? 1.07 : 1;

  let keep = 1;
  for (const s of signals) {
    s.contribution = Math.min(0.95, s.weight * s.value * GAIN);
    keep *= 1 - s.contribution;
  }
  const risk = Math.round(clamp((1 - keep) * deadlineMultiplier) * 100);

  // upsell: seat cap + feature asks + growth
  const asks = a.tickets.flatMap((t) => t.asks ?? []);
  const upsell = Math.round(clamp((util >= 0.92 ? 0.45 : util > 0.85 ? 0.15 : 0) + asks.length * 0.2 + clamp(uw.sixWeekChange, 0, 0.5)) * 100);

  const top = [...signals].sort((x, y) => y.contribution - x.contribution).filter((s) => s.value > 0.15).slice(0, 3);
  const tier: Health["tier"] = risk >= 60 ? "critical" : risk >= 35 ? "watch" : "healthy";

  let why: string;
  if (upsell >= 60 && risk < 45) {
    why = `Expansion signal: ${Math.round(util * 100)}% of seats in use${asks.length ? `, asking about ${asks.filter((x) => x !== "seats").join(", ") || "more seats"}` : ""}, usage up ${Math.round(Math.max(uw.sixWeekChange, 0) * 100)}%.`;
  } else if (!top.length || tier === "healthy") {
    why = `Healthy: ${signals.find((s) => s.key === "usage")!.evidence}, ${signals.find((s) => s.key === "champion")!.evidence}, ${signals.find((s) => s.key === "billing")!.evidence}.`;
  } else {
    const parts = top.map((s) => s.evidence);
    const joined = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
    why = joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
  }

  const cause = pickCause(a, signals, risk, upsell, daysToRenewal);
  return { risk, tier, upsell, signals, why, cause, daysToRenewal, daysToNotice, deadlineMultiplier };
}

function pickCause(a: Account, signals: Signal[], risk: number, upsell: number, daysToRenewal: number): PlayKey {
  if (upsell >= 60 && risk < 45) return "expansion";
  if (risk < 35) return "touchless";
  const by = Object.fromEntries(signals.map((s) => [s.key, s])) as Record<SignalKey, Signal>;
  const competitor = a.tickets.some((t) => t.competitor);
  if (competitor) return "competitor";
  const ranked = [...signals].sort((x, y) => y.contribution - x.contribution);
  switch (ranked[0].key) {
    case "champion":
      return "champion";
    case "billing":
      return "billing";
    case "support":
    case "sentiment":
      return "bug";
    case "seats":
      return "rightsize";
    default:
      if (by.billing.value >= 0.5) return "billing";
      return daysToRenewal < 0 ? "touchless" : "adoption";
  }
}
