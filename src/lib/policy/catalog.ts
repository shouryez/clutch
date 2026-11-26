/**
 * The facts a policy can test. This catalogue IS the contract between the
 * config file and the engine: every name here is documented, typed and shown
 * in the rule builder. Client-safe (no server imports).
 */

export type FieldType = "money" | "number" | "percent" | "days" | "string" | "enum" | "boolean" | "list";
export type FieldScope = "account" | "deal";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  group: string;
  description: string;
  scope: FieldScope; // "deal" fields exist only when a deal/offer is being checked
  options?: string[];
  unit?: string;
};

const PLAYS = ["touchless", "bug", "competitor", "champion", "adoption", "billing", "expansion", "rightsize"];

export const FIELDS: FieldDef[] = [
  // identity
  { key: "name", label: "Account name", type: "string", group: "Account", scope: "account", description: "Customer name" },
  { key: "industry", label: "Industry", type: "enum", group: "Account", scope: "account", description: "Customer industry", options: ["Logistics", "Healthcare", "Financial services", "Insurance", "Pharma", "Retail", "FMCG", "Education", "Manufacturing", "Software", "Mobility", "Media", "Energy", "Travel", "Real estate", "Telecom"] },
  { key: "city", label: "City", type: "string", group: "Account", scope: "account", description: "Head-office city" },
  { key: "plan", label: "Plan", type: "enum", group: "Account", scope: "account", description: "Subscription plan", options: ["Starter", "Growth", "Enterprise"] },
  { key: "csm", label: "CSM", type: "string", group: "Account", scope: "account", description: "Owning customer success manager" },
  { key: "imported", label: "Imported from a contract", type: "boolean", group: "Account", scope: "account", description: "Created by the contract reader, not synced from CRM" },

  // money & seats
  { key: "arr", label: "ARR", type: "money", group: "Revenue", scope: "account", description: "Annual recurring revenue (₹). Accepts 25L, 1.2Cr" },
  { key: "seats", label: "Licensed seats", type: "number", group: "Revenue", scope: "account", description: "Seats on the current contract" },
  { key: "pricePerSeat", label: "Price per seat / month", type: "money", group: "Revenue", scope: "account", description: "Contracted ₹ per seat per month" },
  { key: "activeUsers", label: "Active users", type: "number", group: "Usage", scope: "account", description: "Average weekday active users, last 28 days" },
  { key: "utilization", label: "Seat utilisation", type: "percent", group: "Usage", scope: "account", description: "Active users ÷ licensed seats, in %", unit: "%" },
  { key: "usageChange", label: "Usage change (6 wk)", type: "percent", group: "Usage", scope: "account", description: "Change in active users vs 6–12 weeks ago, in %. Negative = decline", unit: "%" },
  { key: "featureCount", label: "Core features used", type: "number", group: "Usage", scope: "account", description: "Of 6 core features" },
  { key: "features", label: "Features in use", type: "list", group: "Usage", scope: "account", description: "tickets, automations, reports, exports, sla, integrations", options: ["tickets", "automations", "reports", "exports", "sla", "integrations"] },

  // health
  { key: "risk", label: "Churn risk", type: "number", group: "Health", scope: "account", description: "Clutch risk score 0–100" },
  { key: "tier", label: "Risk tier", type: "enum", group: "Health", scope: "account", description: "critical · watch · healthy", options: ["critical", "watch", "healthy"] },
  { key: "upsell", label: "Expansion score", type: "number", group: "Health", scope: "account", description: "Upsell readiness 0–100" },
  { key: "cause", label: "Main risk driver", type: "enum", group: "Health", scope: "account", description: "The play Clutch would pick", options: PLAYS },
  { key: "sentiment", label: "Sentiment", type: "number", group: "Health", scope: "account", description: "Average tone of tickets & emails, last 60 days (−100 to 100)" },

  // contract
  { key: "daysToRenewal", label: "Days to renewal", type: "days", group: "Contract", scope: "account", description: "Days until the contract end date", unit: "days" },
  { key: "daysToNotice", label: "Days to notice deadline", type: "days", group: "Contract", scope: "account", description: "Days until the non-renewal notice window closes (negative = closed)", unit: "days" },
  { key: "noticeDays", label: "Notice period", type: "days", group: "Contract", scope: "account", description: "Contractual notice period", unit: "days" },
  { key: "termMonths", label: "Contract term", type: "number", group: "Contract", scope: "account", description: "Current term length in months", unit: "mo" },
  { key: "autoRenew", label: "Auto-renews", type: "boolean", group: "Contract", scope: "account", description: "Contract renews automatically" },
  { key: "upliftPct", label: "Renewal uplift cap", type: "percent", group: "Contract", scope: "account", description: "Max price increase allowed at renewal, in %", unit: "%" },
  { key: "paymentTerms", label: "Payment terms", type: "string", group: "Contract", scope: "account", description: "e.g. Net 30" },
  { key: "renewed", label: "Already renewed", type: "boolean", group: "Contract", scope: "account", description: "Signed this cycle" },

  // people
  { key: "hasChampion", label: "Has a champion", type: "boolean", group: "People", scope: "account", description: "A named, active champion exists" },
  { key: "championInactiveDays", label: "Champion inactive (days)", type: "days", group: "People", scope: "account", description: "Days since the champion last logged in (999 if none)", unit: "days" },
  { key: "championBounced", label: "Champion email bounced", type: "boolean", group: "People", scope: "account", description: "Their email hard-bounced (likely left)" },
  { key: "hasExecSponsor", label: "Has exec sponsor", type: "boolean", group: "People", scope: "account", description: "An executive sponsor is on record" },
  { key: "contactCount", label: "Contacts", type: "number", group: "People", scope: "account", description: "Known stakeholders" },
  { key: "bouncedContacts", label: "Bounced contacts", type: "number", group: "People", scope: "account", description: "Contacts whose email bounced" },

  // support
  { key: "openTickets", label: "Open tickets", type: "number", group: "Support", scope: "account", description: "Unresolved support tickets" },
  { key: "openP1Tickets", label: "Open P1 tickets", type: "number", group: "Support", scope: "account", description: "Unresolved P1 (urgent) tickets" },
  { key: "competitorMentioned", label: "Competitor mentioned", type: "boolean", group: "Support", scope: "account", description: "A competitor came up in a ticket" },
  { key: "competitor", label: "Competitor", type: "string", group: "Support", scope: "account", description: "Name of the competitor mentioned (empty if none)" },

  // billing
  { key: "failedInvoices", label: "Failed payments", type: "number", group: "Billing", scope: "account", description: "Failed invoices / payment-failed notices" },
  { key: "overdueAmount", label: "Overdue amount", type: "money", group: "Billing", scope: "account", description: "₹ in failed or due invoices" },

  // automation
  { key: "activePlay", label: "Running play", type: "enum", group: "Automation", scope: "account", description: "Play Clutch is running now (empty if none)", options: ["", ...PLAYS, "negotiated"] },

  // deal desk (only when an offer/quote is checked)
  { key: "discountPct", label: "Discount", type: "percent", group: "Deal", scope: "deal", description: "Discount on list price, in %", unit: "%" },
  { key: "dealTerm", label: "Deal term", type: "number", group: "Deal", scope: "deal", description: "Proposed term in months (12/24/36)", unit: "mo" },
  { key: "dealSeats", label: "Deal seats", type: "number", group: "Deal", scope: "deal", description: "Seats on the proposed renewal" },
  { key: "seatChange", label: "Seat change", type: "number", group: "Deal", scope: "deal", description: "Proposed seats − current seats" },
  { key: "dealPrice", label: "Deal total", type: "money", group: "Deal", scope: "deal", description: "Total contract value of the offer (₹)" },
  { key: "dealAnnual", label: "Deal annual value", type: "money", group: "Deal", scope: "deal", description: "Offer value per year (₹)" },
  { key: "listPrice", label: "List price", type: "money", group: "Deal", scope: "deal", description: "Price before discount (₹)" },
  { key: "discountAmount", label: "Discount amount", type: "money", group: "Deal", scope: "deal", description: "₹ given away vs list" },
  { key: "effectiveSeatPrice", label: "Effective ₹ / seat / month", type: "money", group: "Deal", scope: "deal", description: "After discount" },
  { key: "extras", label: "Extras", type: "list", group: "Deal", scope: "deal", description: "Concessions bundled in", options: ["onboarding", "case-study", "upfront-payment", "extra-seats", "training", "free-month", "pause"] },
];

export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<string, FieldDef>;

export type Op = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between" | "in" | "not_in" | "contains" | "not_contains" | "matches" | "is_true" | "is_false" | "is_empty" | "not_empty";

export const OP_LABEL: Record<Op, string> = {
  eq: "is",
  neq: "is not",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  between: "between",
  in: "is one of",
  not_in: "is none of",
  contains: "contains",
  not_contains: "doesn’t contain",
  matches: "matches regex",
  is_true: "is yes",
  is_false: "is no",
  is_empty: "is empty",
  not_empty: "is set",
};

/** Symbols people naturally type in a YAML file. */
export const OP_ALIAS: Record<string, Op> = {
  "=": "eq", "==": "eq", is: "eq", equals: "eq", "!=": "neq", "<>": "neq", not: "neq", ">": "gt", ">=": "gte", "<": "lt", "<=": "lte",
  above: "gt", below: "lt", at_least: "gte", at_most: "lte", one_of: "in", none_of: "not_in", "not in": "not_in", regex: "matches",
  true: "is_true", false: "is_false", empty: "is_empty", exists: "not_empty",
};

export function opsFor(t: FieldType): Op[] {
  switch (t) {
    case "money":
    case "number":
    case "percent":
    case "days":
      return ["gt", "gte", "lt", "lte", "eq", "neq", "between"];
    case "boolean":
      return ["is_true", "is_false"];
    case "enum":
      return ["eq", "neq", "in", "not_in", "is_empty", "not_empty"];
    case "list":
      return ["contains", "not_contains", "is_empty", "not_empty"];
    default:
      return ["eq", "neq", "contains", "not_contains", "in", "matches", "is_empty", "not_empty"];
  }
}

export const NO_VALUE: Op[] = ["is_true", "is_false", "is_empty", "not_empty"];

/** "25L" → 2500000, "1.2Cr" → 12000000, "₹5,00,000" → 500000, "12%" → 12 */
export function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const m = /^\s*₹?\s*(-?[\d,._]*\.?\d+)\s*(k|K|L|l|lakh|lakhs|Cr|cr|CR|crore|%)?\s*$/.exec(v);
  if (!m) return null;
  const n = Number(m[1].replace(/[,_]/g, ""));
  if (Number.isNaN(n)) return null;
  const s = (m[2] ?? "").toLowerCase();
  return n * (s === "k" ? 1e3 : s.startsWith("l") ? 1e5 : s.startsWith("c") ? 1e7 : 1);
}

export function fmtValue(v: unknown, t?: FieldType): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") {
    if (t === "money") {
      if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 2).replace(/\.?0+$/, "")} Cr`;
      if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, "")} L`;
      return `₹${Math.round(v).toLocaleString("en-IN")}`;
    }
    if (t === "percent") return `${Math.round(v * 10) / 10}%`;
    if (t === "days") return `${Math.round(v)} days`;
    return `${Math.round(v * 100) / 100}`;
  }
  return String(v);
}

export const PLAY_OPTIONS = PLAYS;
