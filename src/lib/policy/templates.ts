/** One-click starting points in the rule builder. Client-safe. */
export type Template = { key: string; label: string; blurb: string; rule: Record<string, unknown> };

export const TEMPLATES: Template[] = [
  {
    key: "hc-cap",
    label: "Industry discount cap",
    blurb: "Block any offer over 5% for healthcare — enforced on live calls",
    rule: { id: "FIN-010", name: "Healthcare discount cap", category: "financial", severity: "critical", scope: "deal", when: { all: [{ field: "industry", op: "eq", value: "Healthcare" }, { field: "discountPct", op: "gt", value: 5 }] }, message: "{{discountPct}} off for a {{industry}} customer — the cap is 5%", action: { type: "block" } },
  },
  {
    key: "p1-renewal",
    label: "Open P1 near renewal",
    blurb: "An urgent ticket open in the last 60 days before renewal",
    rule: { id: "BIZ-010", name: "Open P1 close to renewal", category: "business", severity: "critical", scope: "account", when: { all: [{ field: "openP1Tickets", op: "gte", value: 1 }, { field: "daysToRenewal", op: "lte", value: 60 }] }, message: "{{openP1Tickets}} open P1 ticket(s), renewal in {{daysToRenewal}}", action: { type: "notify" } },
  },
  {
    key: "silent",
    label: "Silent decline, big account",
    blurb: "Usage down 25%+ on an account worth ₹25L or more",
    rule: { id: "BIZ-011", name: "Silent decline on a big account", category: "business", severity: "high", scope: "account", when: { expr: "usageChange <= -25 && arr >= 25L" }, message: "Usage {{usageChange}} on a {{arr}} account", action: { type: "start_play", play: "adoption" } },
  },
  {
    key: "seat-cut",
    label: "Big seat cut needs approval",
    blurb: "Any renewal that drops 10+ seats goes to a manager",
    rule: { id: "FIN-011", name: "Large seat reduction", category: "financial", severity: "high", scope: "deal", when: { all: [{ field: "seatChange", op: "lte", value: -10 }] }, message: "Renewal drops {{seatChange}} seats", action: { type: "require_approval" } },
  },
  {
    key: "uplift",
    label: "Uplift above cap",
    blurb: "Contracts allowing more than a 5% price rise",
    rule: { id: "COMP-010", name: "Uplift above 5% cap", category: "compliance", severity: "medium", scope: "account", when: { all: [{ field: "upliftPct", op: "gt", value: 5 }] }, message: "Contract allows {{upliftPct}} uplift — above the 5% policy cap", action: { type: "flag" } },
  },
  {
    key: "quiet-champ",
    label: "Champion gone quiet",
    blurb: "Champion hasn't logged in for 3 weeks",
    rule: { id: "BIZ-012", name: "Champion inactive 21+ days", category: "business", severity: "medium", scope: "account", when: { all: [{ field: "championInactiveDays", op: "gt", value: 21 }, { field: "renewed", op: "is_false" }] }, message: "Champion last active {{championInactiveDays}} ago", action: { type: "start_play", play: "champion" } },
  },
  {
    key: "competitor",
    label: "Competitor on a big account",
    blurb: "A competitor named on a ₹25L+ account",
    rule: { id: "BIZ-013", name: "Competitor on a big account", category: "business", severity: "high", scope: "account", when: { expr: 'competitorMentioned && arr >= 25L' }, message: "{{competitor}} is in the conversation at {{name}} ({{arr}})", action: { type: "notify" } },
  },
];
