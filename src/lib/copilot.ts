/**
 * "Ask Clutch" — portfolio copilot. Sarvam LLM with tools over the live data:
 * it can answer questions about accounts/renewals and take actions (run plays, autopilot).
 */
import { inrCompact } from "./format";
import { PLAY_META, startPlay } from "./runner";
import { emit, store, summaries } from "./store";
import type { PlayKey } from "./types";
import { radarView, stateView } from "./views";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "find_accounts",
      description: "Search and filter the customer portfolio. Use for any question about which accounts are at risk, renewing soon, biggest, etc.",
      parameters: {
        type: "object",
        properties: {
          tier: { type: "string", enum: ["critical", "watch", "healthy", "any"] },
          renewing_within_days: { type: "integer" },
          min_arr_lakh: { type: "number", description: "minimum ARR in lakh rupees" },
          name_contains: { type: "string" },
          sort: { type: "string", enum: ["risk", "arr", "renewal"] },
          limit: { type: "integer" },
        },
      },
    },
  },
  { type: "function", function: { name: "portfolio_kpis", description: "Headline numbers: ARR up for renewal, at risk, renewed, touchless rate, saves.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "bug_radar", description: "Bugs ranked by the ARR they put at risk.", parameters: { type: "object", properties: {} } } },
  {
    type: "function",
    function: {
      name: "run_play",
      description: "Start an automated play for one account. play = recommended | touchless | competitor | bug | champion | adoption | billing | expansion | rightsize.",
      parameters: { type: "object", properties: { account: { type: "string", description: "account name" }, play: { type: "string" } }, required: ["account"] },
    },
  },
  { type: "function", function: { name: "run_autopilot", description: "Start the recommended play for every account that needs one (renewing within 120 days).", parameters: { type: "object", properties: {} } } },
];

function find(args: Record<string, unknown>) {
  let list = summaries();
  const tier = (args.tier as string) || "any";
  if (tier !== "any") list = list.filter((a) => a.health.tier === tier);
  if (args.renewing_within_days) list = list.filter((a) => a.health.daysToRenewal >= 0 && a.health.daysToRenewal <= Number(args.renewing_within_days));
  if (args.min_arr_lakh) list = list.filter((a) => a.arr >= Number(args.min_arr_lakh) * 1e5);
  if (args.name_contains) list = list.filter((a) => a.name.toLowerCase().includes(String(args.name_contains).toLowerCase()));
  const sort = (args.sort as string) || "risk";
  list.sort((x, y) => (sort === "arr" ? y.arr - x.arr : sort === "renewal" ? x.health.daysToRenewal - y.health.daysToRenewal : y.health.risk - x.health.risk));
  return {
    count: list.length,
    accounts: list.slice(0, Number(args.limit) || 8).map((a) => ({
      name: a.name,
      id: a.id,
      arr: inrCompact(a.arr),
      risk: a.health.risk,
      tier: a.health.tier,
      renews_in_days: a.health.daysToRenewal,
      notice_closes_in_days: a.health.daysToNotice,
      why: a.health.why,
      recommended_play: PLAY_META[a.health.cause].title,
      renewed: !!a.renewed,
    })),
  };
}

export function autopilot(limit?: number) {
  const s = store();
  const cfg = s.settings;
  const busy = new Set(s.runs.filter((r) => r.status === "running" || r.status === "waiting").map((r) => r.accountId));
  const targets = summaries()
    .filter((a) => !a.renewed && !busy.has(a.id) && a.health.daysToRenewal >= 0 && a.health.daysToRenewal <= 120)
    .sort((x, y) => y.health.risk * y.arr - x.health.risk * x.arr)
    .slice(0, limit ?? cfg.autopilotLimit);
  const started: { account: string; play: string }[] = [];
  const queued: { account: string; play: string }[] = [];
  let i = 0;
  for (const a of targets) {
    const play = a.health.cause;
    const mode = play === "negotiated" ? "auto" : cfg.autonomy[play];
    if (mode === "off") continue;
    if (mode === "ask") {
      if (!s.suggestions.some((x) => x.accountId === a.id)) s.suggestions.push({ id: `sug_${a.id}`, accountId: a.id, play, at: Date.now(), reason: a.health.why });
      queued.push({ account: a.name, play: PLAY_META[play].title });
      continue;
    }
    const k = i++;
    setTimeout(() => {
      try {
        startPlay(a.id, play, { autoSign: play === "touchless" || play === "expansion", autoSignAfterMs: 7000 + k * 1500, autoMail: false });
      } catch {
        /* already running */
      }
    }, k * 600);
    started.push({ account: a.name, play: PLAY_META[play].title });
  }
  if (queued.length) emit({ kind: "system", title: `${queued.length} plays waiting for your approval`, detail: queued.map((q) => `${q.account} · ${q.play}`).join(" · "), tone: "action" });
  return { started, queued };
}

function resolveAccount(name: string) {
  const n = name.toLowerCase();
  return store().accounts.find((a) => a.name.toLowerCase() === n) ?? store().accounts.find((a) => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase().split(" ")[0]));
}

async function runTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "find_accounts":
      return find(args);
    case "portfolio_kpis": {
      const k = stateView().kpis;
      return { up_for_renewal_120d: inrCompact(k.arrUpForRenewal), renewals_120d: k.renewalsIn120, arr_at_risk: inrCompact(k.arrAtRisk), accounts_at_risk: k.atRiskCount, renewed_by_clutch: inrCompact(k.arrRenewed), renewed_count: k.renewedCount, touchless: k.touchlessCount, cancellations_stopped: k.saves, critical_accounts: k.critical, plays_running: k.activeRuns };
    }
    case "bug_radar":
      return { clusters: radarView().slice(0, 4).map((c) => ({ bug: c.title, arr_at_risk: inrCompact(c.arr), accounts: c.accounts.length, renewing_within_90d: c.renewalsIn90, filed: c.issue ? `#${c.issue.number}` : "not filed" })) };
    case "run_play": {
      const a = resolveAccount(String(args.account ?? ""));
      if (!a) return { ok: false, reason: "account not found" };
      const sum = summaries().find((x) => x.id === a.id)!;
      const play = (!args.play || args.play === "recommended" ? sum.health.cause : args.play) as PlayKey;
      if (!PLAY_META[play]) return { ok: false, reason: "unknown play" };
      const run = startPlay(a.id, play, { autoSign: play === "touchless" });
      return { ok: true, account: a.name, play: PLAY_META[play].title, run: run.id, link: `/app/accounts/${a.id}` };
    }
    case "run_autopilot":
      return autopilot();
  }
  return { ok: false };
}

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string };

export async function copilot(history: { role: "user" | "assistant"; content: string }[]) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return { reply: "Copilot needs SARVAM_API_KEY.", actions: [] as string[] };
  const msgs: Msg[] = [
    {
      role: "system",
      content:
        "You are Clutch, the AI renewal copilot inside a B2B SaaS revenue dashboard (the company is Helpdeck, a helpdesk SaaS; amounts in Indian rupees, L = lakh, Cr = crore). Answer questions about the customer portfolio using tools — never invent numbers. Be concise: short sentences or a compact list (max 6 items, '- ' bullets), no markdown headings, no bold. When the user asks you to do something (run a play, call, autopilot), use the tool and confirm what started. Mention account names exactly.",
    },
    ...history.slice(-10),
  ];
  const actions: string[] = [];
  for (let step = 0; step < 5; step++) {
    const r = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: { "api-subscription-key": key, "content-type": "application/json" },
      body: JSON.stringify({ model: "sarvam-105b-conversations", messages: msgs, tools: TOOLS, tool_choice: "auto", max_tokens: 700, temperature: 0.3 }),
    });
    if (!r.ok) return { reply: `Copilot is unavailable right now (${r.status}).`, actions };
    const j = (await r.json()) as { choices?: { message?: { content?: string | null; tool_calls?: Msg["tool_calls"] } }[] };
    const m = j.choices?.[0]?.message;
    if (!m) break;
    if (!m.tool_calls?.length) return { reply: (m.content ?? "").trim(), actions };
    msgs.push({ role: "assistant", content: null, tool_calls: m.tool_calls });
    for (const c of m.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {
        /* ignore */
      }
      const res = await runTool(c.function.name, args);
      if (c.function.name === "run_play" || c.function.name === "run_autopilot") actions.push(c.function.name);
      msgs.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(res) });
    }
  }
  return { reply: "I couldn't finish that — try asking more specifically.", actions };
}

export function callsView() {
  const s = store();
  return [...s.deals.values()]
    .map((d) => {
      const a = s.accounts.find((x) => x.id === d.accountId)!;
      const turns = d.messages.filter((m) => m.who === "customer").length;
      const last = d.messages[d.messages.length - 1];
      return {
        accountId: d.accountId,
        account: a.name,
        arr: a.arr,
        channel: d.channel,
        contact: d.contact.name,
        lang: d.lang,
        stage: d.stage,
        turns,
        startedAt: d.startedAt,
        lastAt: last?.at ?? d.startedAt,
        offer: d.current ? `${Math.round(d.current.discountPct * 100)}% · ${d.current.termMonths} mo` : null,
        sentiment: d.sentiment,
        messages: d.messages,
      };
    })
    .sort((x, y) => y.lastAt - x.lastAt);
}
