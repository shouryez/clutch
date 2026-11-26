/**
 * Value receipt: what the product actually did for a customer, in their numbers.
 * Customers rarely churn over price alone — they churn when nobody can say what they got.
 */
import { usageWindows } from "./risk";
import { CORE_FEATURES } from "./seed";
import type { Account } from "./types";

const MIN_PER_AUTOMATION = 8; // agent minutes an automated triage / reply / routing saves
const MIN_PER_CONVERSATION = 4; // shared inbox, macros and routing vs. handling it over plain email
const AGENT_HOUR_INR = 700; // loaded cost of a support agent hour

const FEATURE_LABEL: Record<string, string> = {
  tickets: "Shared inbox",
  automations: "Automations",
  reports: "Reports",
  exports: "Exports",
  sla: "SLA policies",
  integrations: "Integrations",
};

export function valueOf(a: Account) {
  const days = a.usage.slice(-90);
  const events = days.reduce((s, d) => s + d.events, 0);
  const conversations = Math.round(events / 3);
  const hasAuto = a.features.includes("automations");
  const automations = Math.round(events * (hasAuto ? 0.32 : 0.04));
  const hoursSaved = Math.round((automations * MIN_PER_AUTOMATION + conversations * MIN_PER_CONVERSATION) / 60);
  const valueInr = hoursSaved * AGENT_HOUR_INR;
  const cost = Math.round(a.arr / 4);
  const uw = usageWindows(a);
  const peak = Math.max(...a.usage.slice(-28).map((d) => d.activeUsers));
  // monthly trend for a sparkline (6 months)
  const months: { label: string; conversations: number }[] = [];
  for (let i = 0; i < a.usage.length; i += 30) {
    const chunk = a.usage.slice(i, i + 30);
    months.push({
      label: new Date(chunk[0].date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" }),
      conversations: Math.round(chunk.reduce((s, d) => s + d.events, 0) / 3),
    });
  }
  const unused = CORE_FEATURES.filter((f) => !a.features.includes(f));
  const opportunity = !hasAuto
    ? { feature: "Automations", hours: Math.round((events * 0.28 * MIN_PER_AUTOMATION) / 60), note: "Auto-triage and canned replies on your top 5 ticket types." }
    : unused[0]
      ? { feature: FEATURE_LABEL[unused[0]], hours: Math.round(hoursSaved * 0.12), note: `Teams like yours use ${FEATURE_LABEL[unused[0]].toLowerCase()} to cut repeat work.` }
      : null;
  return {
    period: "last 90 days",
    conversations,
    automations,
    hoursSaved,
    valueInr,
    cost,
    roi: cost ? valueInr / cost : 0,
    activeUsers: Math.round(uw.weekdayAvg),
    peakUsers: peak,
    seats: a.seats,
    firstResponseMins: 18 + (a.name.length % 7) * 4,
    features: a.features.map((f) => FEATURE_LABEL[f] ?? f),
    unused: unused.map((f) => FEATURE_LABEL[f] ?? f),
    opportunity,
    months,
  };
}

export type Value = ReturnType<typeof valueOf>;
