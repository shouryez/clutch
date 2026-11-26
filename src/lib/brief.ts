/**
 * Morning brief: the three things that matter today, written from live data
 * (no LLM — it can't invent a number) and read aloud by Sarvam's Bulbul voice.
 */
import { clusters } from "./bugs";
import { PLAYBOOK } from "./playbook";
import { store, summaries } from "./store";
import type { AccountSummary } from "./types";

function spokenInr(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(1).replace(/\.0$/, "")} crore`;
  if (n >= 1e5) return `${Math.round(n / 1e5)} lakh`;
  return `${Math.round(n / 1000)} thousand rupees`;
}

function stake(a: AccountSummary) {
  const r = a.health.risk / 100;
  return r * r * a.arr * (a.health.daysToNotice >= 0 && a.health.daysToNotice <= 15 ? 1.5 : 1);
}

export function briefing() {
  const all = summaries();
  const open = all.filter((a) => !a.renewed && a.health.daysToRenewal >= 0 && a.health.daysToRenewal <= 120);
  const urgent = open
    .filter((a) => a.health.tier !== "healthy" && !(a.activeRun && (a.activeRun.status === "running" || a.activeRun.status === "waiting")))
    .sort((x, y) => stake(y) - stake(x))
    .slice(0, 3);
  const touchless = open.filter((a) => a.health.tier === "healthy" && !a.activeRun && a.health.daysToRenewal <= 90);
  const bug = clusters().find((c) => !c.issue);
  const inFlight = store().runs.filter((r) => r.status === "running" || r.status === "waiting").length;
  const renewed = all.filter((a) => a.renewed).length;

  const items = urgent.map((a) => {
    const top = [...a.health.signals].sort((x, y) => y.contribution - x.contribution).filter((s) => s.value > 0.2).slice(0, 2);
    const reason = top.map((s) => s.evidence).join(" and ");
    const deadline = a.health.daysToNotice >= 0 && a.health.daysToNotice <= 30 ? `notice window closes in ${a.health.daysToNotice} days` : `renews in ${a.health.daysToRenewal} days`;
    return {
      accountId: a.id,
      name: a.name,
      arr: a.arr,
      reason: reason.charAt(0).toUpperCase() + reason.slice(1),
      deadline,
      play: a.health.cause,
      playLabel: PLAYBOOK[a.health.cause].label,
      spoken: `${a.name}, ${spokenInr(a.arr)}. ${reason.charAt(0).toUpperCase() + reason.slice(1)}; ${deadline}. I've lined up the ${PLAYBOOK[a.health.cause].label.toLowerCase()} play.`,
    };
  });

  const ord = ["First", "Second", "Third"];
  const lines = [
    `Good morning, Meera. I read all ${all.length} accounts overnight.`,
    items.length ? `${items.length === 1 ? "One account needs" : `${items.length} accounts need`} you today.` : "Nothing needs you today.",
    ...items.map((it, i) => `${ord[i]}: ${it.spoken}`),
    touchless.length ? `${touchless.length} healthy renewals worth ${spokenInr(touchless.reduce((t, a) => t + a.arr, 0))} can renew on their own — run autopilot and I'll send them.` : "",
    bug ? `One bug — ${bug.title} — is blocking ${spokenInr(bug.arr)} across ${bug.accounts.length} accounts. It isn't filed yet.` : "",
    inFlight ? `${inFlight} plays are already running${renewed ? ` and ${renewed} renewals have closed` : ""}.` : "",
  ].filter(Boolean);

  return {
    items,
    touchless: { count: touchless.length, arr: touchless.reduce((t, a) => t + a.arr, 0) },
    bug: bug ? { topic: bug.topic, title: bug.title, arr: bug.arr, accounts: bug.accounts.length } : null,
    inFlight,
    renewed,
    text: lines.join(" "),
  };
}
