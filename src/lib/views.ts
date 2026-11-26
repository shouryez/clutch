import { integrationStatus } from "./adapters";
import { leverage, listPrice, POLICY } from "./dealdesk";
import { clusters } from "./bugs";
import { inboxCount } from "./inbox";
import { exceptionsFor, policyBadge } from "./policy/engine";
import { PLAY_META } from "./runner";
import { valueOf } from "./value";
import { getAccount, getHealth, store, summaries } from "./store";

export function stateView() {
  const s = store();
  const sums = summaries();
  const window = sums.filter((x) => x.health.daysToRenewal >= 0 && x.health.daysToRenewal <= 120 && !x.renewed);
  const renewedOffers = [...s.renewed.entries()].map(([, r]) => ({ r, o: s.offers.find((o) => o.id === r.offerId)! }));
  const kpis = {
    arrUpForRenewal: window.reduce((t, x) => t + x.arr, 0),
    renewalsIn120: window.length,
    arrAtRisk: window.filter((x) => x.health.tier !== "healthy").reduce((t, x) => t + x.arr, 0),
    atRiskCount: window.filter((x) => x.health.tier !== "healthy").length,
    arrRenewed: renewedOffers.reduce((t, { o }) => t + Math.round(o.price / (o.termMonths / 12)), 0),
    renewedCount: renewedOffers.length,
    touchlessCount: renewedOffers.filter(({ r }) => r.touchless).length,
    expansionPipeline: sums.filter((x) => x.health.upsell >= 60).reduce((t, x) => t + x.arr * 0.6, 0),
    critical: sums.filter((x) => x.health.tier === "critical").length,
    activeRuns: s.runs.filter((r) => r.status === "running" || r.status === "waiting").length,
    saves: s.saves.length,
    savedArr: s.saves.reduce((t, x) => t + x.arr, 0),
  };
  return {
    kpis,
    accounts: sums,
    feed: s.feed.slice(0, 60),
    runs: s.runs.slice(-20).reverse(),
    integrations: integrationStatus(),
    counts: {
      inbox: inboxCount(),
      atRisk: kpis.atRiskCount,
      bugs: clusters().filter((c) => !c.issue).length,
      outbox: s.artifacts.length,
      calls: [...s.deals.values()].filter((d) => d.messages.some((m) => m.who === "customer")).length,
      policies: policyBadge().open,
    },
  };
}

export function accountView(id: string) {
  const a = getAccount(id);
  if (!a) return null;
  const s = store();
  const h = getHealth(id);
  // weekly aggregates of weekday active users
  const weeks: { week: string; active: number; events: number }[] = [];
  for (let i = 0; i < a.usage.length; i += 7) {
    const chunk = a.usage.slice(i, i + 7);
    const wd = chunk.filter((d) => {
      const g = new Date(d.date + "T00:00:00").getDay();
      return g !== 0 && g !== 6;
    });
    weeks.push({
      week: chunk[0].date,
      active: Math.round(wd.reduce((t, d) => t + d.activeUsers, 0) / Math.max(1, wd.length)),
      events: chunk.reduce((t, d) => t + d.events, 0),
    });
  }
  const comp = a.tickets.find((t) => t.competitor);
  return {
    account: { ...a, usage: undefined },
    weeks,
    health: h,
    runs: s.runs.filter((r) => r.accountId === id).reverse(),
    offers: s.offers.filter((o) => o.accountId === id).reverse(),
    leverage: leverage(a, comp ? 7000 : undefined),
    listPrice: listPrice(a),
    policy: POLICY,
    renewed: s.renewed.get(id) ?? null,
    artifacts: s.artifacts.filter((x) => x.accountId === id),
    exceptions: exceptionsFor(id),
    value: valueOf(a),
    plays: Object.entries(PLAY_META)
      .filter(([key]) => key !== "negotiated")
      .map(([key, m]) => ({ key, ...m, recommended: key === h.cause })),
  };
}

export function radarView() {
  return clusters();
}
