/**
 * Deal desk: the guardrails live HERE, in code, not in a prompt.
 * The LLM (or a human) proposes; this module decides.
 */
import { checkDeal } from "./policy/engine";
import { usageWindows } from "./risk";
import type { Account } from "./types";
import { valueOf } from "./value";

export const POLICY = {
  maxDiscount: 0.15, // hard ceiling, never exceeded
  approvalAbove: 0.1, // anything above needs a human
  minTermForDiscount: { 0.05: 12, 0.1: 24 } as Record<number, number>, // discount tier -> min term months
  allowedTerms: [12, 24, 36],
  allowedExtras: ["onboarding", "case-study", "upfront-payment", "extra-seats", "training", "free-month", "pause"],
};

export type Proposal = { discountPct: number; termMonths: number; extras?: string[]; seats?: number };

export type Verdict =
  | { ok: true; needsApproval: boolean; price: number; listPrice: number; reasons: string[] }
  | { ok: false; reasons: string[]; counter?: Proposal };

export function listPrice(a: Account, seats = a.seats, termMonths = 12) {
  const annual = seats * a.pricePerSeatMonth * 12 * (1 + a.contract.upliftPct / 100);
  return Math.round(annual * (termMonths / 12));
}

/**
 * Every offer passes here: first the hard guardrails, then the workspace's own
 * deal policies (config/policies.yaml, editable live). A blocking policy gets a
 * counter-offer: the best terms that pass every rule.
 */
export function validate(a: Account, p: Proposal): Verdict {
  const v = baseValidate(a, p);
  if (!v.ok) return v;
  const pol = policyCheck(a, p, v.price, v.listPrice);
  if (pol.blocks.length) {
    return { ok: false, reasons: pol.blocks.map((b) => `policy ${b.rule.id} (${b.rule.name}): ${b.message}`), counter: compliantCounter(a, p) };
  }
  if (pol.approvals.length) {
    return { ...v, needsApproval: true, reasons: [...pol.approvals.map((b) => `needs approval — policy ${b.rule.id}: ${b.message}`), ...v.reasons.filter((r) => r !== "within policy")] };
  }
  return v;
}

function policyCheck(a: Account, p: Proposal, price: number, list: number) {
  try {
    return checkDeal(a, { discountPct: p.discountPct, termMonths: p.termMonths, seats: p.seats, extras: p.extras, price, listPrice: list });
  } catch {
    return { blocks: [], approvals: [], flags: [] };
  }
}

/** Search the nearest terms that pass every rule: smaller discount first, then longer term. */
function compliantCounter(a: Account, p: Proposal): Proposal | undefined {
  const start = Math.round(p.discountPct * 100);
  for (const term of [p.termMonths, 24, 36].filter((t, i, xs) => xs.indexOf(t) === i && t >= p.termMonths)) {
    for (let d = start; d >= 0; d--) {
      const q: Proposal = { ...p, discountPct: d / 100, termMonths: term, extras: (p.extras ?? []).filter((e) => e !== "free-month" || d === 0) };
      const v = baseValidate(a, q);
      if (!v.ok) continue;
      if (!policyCheck(a, q, v.price, v.listPrice).blocks.length) return q;
    }
  }
  return undefined;
}

function baseValidate(a: Account, p: Proposal): Verdict {
  const reasons: string[] = [];
  const d = Math.round(p.discountPct * 1000) / 1000;
  if (!POLICY.allowedTerms.includes(p.termMonths)) return { ok: false, reasons: [`term ${p.termMonths}mo not allowed (12/24/36)`] };
  const badExtra = (p.extras ?? []).find((e) => !POLICY.allowedExtras.includes(e));
  if (badExtra) return { ok: false, reasons: [`extra "${badExtra}" not in catalogue`] };
  if (d < 0) return { ok: false, reasons: ["negative discount"] };
  if (d > POLICY.maxDiscount) {
    return {
      ok: false,
      reasons: [`discount ${d.toFixed(2)} exceeds max_discount ${POLICY.maxDiscount.toFixed(2)}`],
      counter: { discountPct: 0.12, termMonths: Math.max(24, p.termMonths), extras: ["onboarding"] },
    };
  }
  for (const [tier, minTerm] of Object.entries(POLICY.minTermForDiscount)) {
    if (d > Number(tier) && p.termMonths < minTerm) {
      return {
        ok: false,
        reasons: [`discount > ${tier} requires term ≥ ${minTerm}mo`],
        counter: { ...p, termMonths: minTerm },
      };
    }
  }
  const lp = listPrice(a, p.seats ?? a.seats, p.termMonths);
  const price = Math.round(lp * (1 - d));
  const needsApproval = d > POLICY.approvalAbove;
  reasons.push(needsApproval ? `needs approval > ${POLICY.approvalAbove.toFixed(2)}` : "within policy");
  return { ok: true, needsApproval, price, listPrice: lp, reasons };
}

/** Leverage: how much negotiating power the data gives us (0..1 each). */
export function leverage(a: Account, competitorPricePerSeat?: number) {
  const uw = usageWindows(a);
  const growth = Math.max(0, Math.min(1, (uw.base ? uw.last / uw.base : 1) - 0.5));
  const hoursSaved = valueOf(a).hoursSaved;
  const migrationCost = a.seats * 15000; // ₹ per seat: retraining + data migration + downtime
  const switching = Math.min(1, migrationCost / (a.arr * 0.5));
  const ourAnnual = a.seats * a.pricePerSeatMonth * 12;
  const theirAnnual = competitorPricePerSeat ? a.seats * competitorPricePerSeat * 12 : ourAnnual * 0.8;
  const gap = Math.max(0, Math.min(1, 1 - (ourAnnual - theirAnnual) / ourAnnual / 0.4));
  return {
    usageGrowth: growth,
    switchingCost: switching,
    competitorGap: gap,
    hoursSaved,
    migrationCost,
    annualDelta: ourAnnual - theirAnnual,
    walkAway: Math.round(listPrice(a) * (1 - POLICY.maxDiscount)),
    target: Math.round(listPrice(a, a.seats, 24) * 0.88),
  };
}
