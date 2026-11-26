/**
 * Clutch conversation agent — Gemini with function calling.
 *
 * Gemini runs the conversation (answers questions, handles objections, speaks Hinglish),
 * but it can only change the deal through tools. The tools call the deal-desk engine,
 * so every price/discount is validated in code: max discount, minimum term, one concession
 * step per turn, manager approval above 10%.
 */
import { fileTopic } from "./bugs";
import { createIssue } from "./adapters";
import { leverage } from "./dealdesk";
import { inr, inrCompact } from "./format";
import type { DealSession, Lang } from "./negotiator";
import { agreeDeal, digitize, offerExact } from "./negotiator";
import { emit, getHealth, store } from "./store";
import type { Account } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODELS = ["gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash"];

type Part = { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: Record<string, unknown> } };
type Content = { role: "user" | "model"; parts: Part[] };

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "make_offer",
        description:
          "Put a renewal offer on the table. The deal desk validates it in code: max discount 15%, discounts above 5% need a 24-month term, above 10% needs manager approval, and you may only concede one ladder step per customer turn. Returns the offer actually made (it may be adjusted). Call this BEFORE mentioning any price or discount.",
        parameters: {
          type: "OBJECT",
          properties: {
            discount_pct: { type: "NUMBER", description: "discount in percent, e.g. 8 for 8%" },
            term_months: { type: "INTEGER", description: "12, 24 or 36" },
          },
          required: ["discount_pct", "term_months"],
        },
      },
      {
        name: "accept_and_send_order_form",
        description: "The customer clearly agreed to the offer currently on the table. Creates the order form and sends it for e-signature. Only call after an explicit yes.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "escalate_issue",
        description: "Escalate the customer's product problem to engineering as a P0 with revenue at stake. Returns ticket number and ETA.",
        parameters: { type: "OBJECT", properties: { summary: { type: "STRING" } }, required: ["summary"] },
      },
      {
        name: "compare_competitor",
        description: "Get switching-cost and value numbers versus a named competitor (e.g. Freshdesk, Zendesk).",
        parameters: { type: "OBJECT", properties: { competitor: { type: "STRING" } }, required: ["competitor"] },
      },
      {
        name: "book_meeting",
        description: "Book a follow-up meeting (demo, training, QBR) with the customer.",
        parameters: { type: "OBJECT", properties: { purpose: { type: "STRING" }, when: { type: "STRING", description: "customer's preferred time, if said" } }, required: ["purpose"] },
      },
    ],
  },
];

function facts(a: Account, ses: DealSession) {
  const h = getHealth(a.id);
  const lv = leverage(a);
  const openTickets = a.tickets.filter((t) => t.status === "open").map((t) => `#${t.number} ${t.priority} "${t.subject}" (open ${t.openedDaysAgo}d)`);
  return [
    `Company: ${a.name} (${a.industry}, ${a.city}). Plan: ${a.plan}, ${a.seats} agent seats, ${inr(a.pricePerSeatMonth)}/seat/month, ARR ${inr(a.arr)}.`,
    `You are speaking with ${ses.contact.name} (${ses.contact.role}).`,
    `Renewal date ${a.contract.end} (in ${h.daysToRenewal} days). Notice window closes in ${h.daysToNotice} days. Auto-renew: ${a.contract.autoRenew ? "yes" : "no"}. Contractual uplift up to ${a.contract.upliftPct}%.`,
    `Risk signals: ${h.why}`,
    `Open tickets: ${openTickets.join("; ") || "none"}. The CSV export fix ships this Thursday (engineering P0).`,
    `Value delivered last 90 days: ~${lv.hoursSaved} agent-hours saved. Usage trend: ${h.signals.find((s) => s.key === "usage")?.evidence}.`,
    `Product: Helpdeck — helpdesk/ticketing SaaS: shared inbox, automations, SLA timers, reports, CSV exports, integrations (Slack, Jira, WhatsApp). Enterprise plan adds SAML SSO, audit log, unlimited automations, priority support, 99.9% SLA.`,
    `Deal desk policy (enforced by make_offer): discounts are 5% (12 months), 8% or 10% (24 months), 12% (24 months, needs manager approval) and 15% (36 months, needs manager approval) — 15% is the absolute maximum; anything above 15% is impossible. Extras you may trade: free onboarding, training session, case study, upfront payment.`,
    ses.current ? `Offer currently on the table: ${Math.round(ses.current.discountPct * 100)}% off, ${ses.current.termMonths} months, total ${inr(ses.current.price)}.` : "No offer on the table yet.",
    ses.pendingApproval ? `Waiting for manager approval of ${Math.round(ses.pendingApproval.discountPct * 100)}%.` : "",
    ses.stage === "agreed" ? "The customer already agreed; the order form is sent. Just help with questions." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function system(a: Account, ses: DealSession, lang: Lang) {
  return [
    "You are Clutch, the AI renewal assistant for Helpdeck (a helpdesk SaaS), on a live " + (ses.channel === "voice" ? "PHONE CALL" : "chat") + " with a customer whose renewal is coming up.",
    "Goal: keep the customer and renew — ideally for 24 months — at the best price for Helpdeck. Be warm, direct, honest; never pushy. Always disclose you are an AI if asked.",
    "You are a woman: in Hindi use feminine verb forms (sakti hoon, rahi hoon, karungi).",
    lang === "hi"
      ? "The customer is speaking Hinglish: reply in natural Hinglish (Hindi + English mix)."
      : "Reply in natural Indian English. If the customer switches to Hindi/Hinglish, switch with them.",
    "ANSWER THE CUSTOMER'S ACTUAL QUESTION FIRST, using the facts below. If the facts don't cover it, say you'll have the team confirm by email — never invent.",
    "Never state a price, discount or term unless it came from a make_offer result in this conversation. To offer anything, call make_offer. Never promise features, credits or dates not in the facts.",
    "Do NOT make an offer until the customer brings up price, discount, budget or renewing — first answer questions, listen and understand their situation. Negotiate like a good rep: acknowledge pain, use value (hours saved, switching cost), trade discount for a longer term. Concede in small steps. If they accept, call accept_and_send_order_form.",
    ses.channel === "voice"
      ? "This is spoken audio: 1–2 short sentences (max 40 words), no lists, no markdown, no emoji. Say rupee amounts as written (e.g. ₹91,58,400)."
      : "Chat: max 4 sentences, no markdown, no emoji.",
    "OUTPUT FORMAT — exactly two lines:\nDISPLAY: <your reply for the screen; Hinglish in Latin script>\nSPEECH: <the same reply for text-to-speech; when Hinglish, write Hindi words in Devanagari and English words in Latin>",
    "",
    "FACTS:",
    facts(a, ses),
    "",
    ses.channel === "voice"
      ? "LENGTH RULE (most important): this is a phone call. DISPLAY must be at most 2 short sentences (under 35 words). Answer, then at most one question. Never repeat facts you already said."
      : "LENGTH RULE: at most 4 sentences.",
  ].join("\n");
}

async function callGemini(sys: string, contents: Content[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const r = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents,
          tools: TOOLS,
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
          generationConfig: { temperature: 0.6, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { candidates?: { content?: { parts?: Part[] } }[] };
      const parts = j.candidates?.[0]?.content?.parts;
      if (parts?.length) return parts;
    } catch {
      /* next model */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Execute a tool call against the deal desk. */
async function runTool(name: string, args: Record<string, unknown>, ses: DealSession, a: Account) {
  switch (name) {
    case "make_offer": {
      const r = offerExact(ses, a, Number(args.discount_pct ?? 0) / 100, Number(args.term_months ?? 24));
      return r;
    }
    case "accept_and_send_order_form": {
      if (!ses.current) return { ok: false, reason: "no offer on the table — call make_offer first" };
      const r = agreeDeal(ses, a);
      return { ok: true, ...r };
    }
    case "escalate_issue": {
      const topic = a.tickets.find((t) => t.topic && t.status === "open")?.topic;
      const filed = topic ? await fileTopic(topic, `${a.name} call`) : null;
      if (filed) return { ok: true, ticket: filed.number, eta: "Thursday", priority: "P0", accounts_affected: filed.accounts.length };
      const r = await createIssue({ title: String(args.summary ?? "Customer escalation"), body: `Escalated live by Clutch for ${a.name} (${inrCompact(a.arr)} ARR).`, labels: ["P0", "revenue-at-risk"] });
      emit({ kind: "signal", accountId: a.id, accountName: a.name, title: `Escalated during call: #${r.number}`, detail: String(args.summary ?? ""), tone: "risk" });
      return { ok: true, ticket: r.number, eta: "Thursday", priority: "P0" };
    }
    case "compare_competitor": {
      const lv = leverage(a, 7000);
      return { competitor: args.competitor, migration_cost: inr(lv.migrationCost), hours_saved_90d: lv.hoursSaved, note: "migration cost = retraining + data migration + downtime for all seats" };
    }
    case "book_meeting": {
      const d = new Date(Date.now() + 2 * 86_400_000);
      const when = (args.when as string) || `${d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}, 11:30 AM`;
      emit({ kind: "step", accountId: a.id, accountName: a.name, title: `Meeting booked: ${args.purpose}`, detail: when, tone: "action" });
      return { ok: true, when };
    }
  }
  return { ok: false, reason: "unknown tool" };
}

function split(out: string) {
  const d = out.match(/DISPLAY:\s*([\s\S]*?)(?:\n\s*SPEECH:|$)/i)?.[1]?.trim();
  const s = out.match(/SPEECH:\s*([\s\S]*)$/i)?.[1]?.trim();
  const clean = (x: string) => x.replace(/\*\*/g, "").replace(/^["']|["']$/g, "").trim();
  if (d) return { reply: clean(d), speech: clean(s || d) };
  return { reply: clean(out), speech: clean(out) };
}

/** Numbers guard on the final wording: every % and ₹ must come from tool results or the customer. */
function numbersOk(text: string, allowed: string) {
  const pct = (s: string) => [...s.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|percent|प्रतिशत)/gi)].map((m) => Number(m[1]));
  const rup = (s: string) => [...s.matchAll(/₹\s?([\d,]+)/g)].map((m) => m[1].replace(/,/g, ""));
  const ap = new Set(pct(allowed));
  const ar = new Set(rup(allowed));
  return pct(text).every((p) => ap.has(p)) && rup(text).every((r) => ar.has(r));
}

export function agentEnabled() {
  return !!(process.env.SARVAM_API_KEY || process.env.GEMINI_API_KEY);
}

/* ---------------- Sarvam (OpenAI-compatible) — primary ---------------- */

type OAMsg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

function lowerSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(lowerSchema);
  if (s && typeof s === "object") {
    return Object.fromEntries(Object.entries(s as Record<string, unknown>).map(([k, v]) => [k, k === "type" && typeof v === "string" ? v.toLowerCase() : lowerSchema(v)]));
  }
  return s;
}
const OA_TOOLS = TOOLS[0].functionDeclarations.map((f) => ({ type: "function" as const, function: { name: f.name, description: f.description, parameters: lowerSchema(f.parameters) } }));

export const SARVAM_LLM = "sarvam-105b-conversations";

async function sarvamChat(messages: OAMsg[], withTools = true) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "api-subscription-key": key, "content-type": "application/json" },
      body: JSON.stringify({ model: SARVAM_LLM, messages, ...(withTools ? { tools: OA_TOOLS, tool_choice: "auto" } : {}), max_tokens: 500, temperature: 0.5 }),
    });
    if (!r.ok) {
      console.log(`[agent] sarvam ${r.status} ${(await r.text()).slice(0, 160)}`);
      return null;
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] } }[] };
    return j.choices?.[0]?.message ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function turnSarvam(ses: DealSession, a: Account, customerText: string) {
  const msgs: OAMsg[] = [{ role: "system", content: system(a, ses, ses.lang) }];
  const hist = ses.messages.filter((m) => m.who !== "system").slice(-14);
  for (const m of hist) msgs.push(m.who === "clutch" ? { role: "assistant", content: m.text } : { role: "user", content: m.text });
  const last = msgs[msgs.length - 1];
  if (last.role !== "user") msgs.push({ role: "user", content: customerText });
  else last.content = customerText;

  const used: string[] = [];
  let allowed = `${digitize(customerText)} ${facts(a, ses)}`;
  let rewrites = 0;
  for (let step = 0; step < 5; step++) {
    const m = await sarvamChat(msgs);
    if (!m) return null;
    if (!m.tool_calls?.length) {
      const text = (m.content ?? "").trim();
      if (!text) return null;
      const out = split(text);
      if (!numbersOk(`${out.reply} ${out.speech}`, allowed)) {
        console.log(`[agent] number guard rejected: ${out.reply.slice(0, 120)}`);
        if (rewrites++ >= 1) return null;
        msgs.push({ role: "assistant", content: text });
        msgs.push({ role: "user", content: "[System check, not the customer] Your reply mentioned a price or percentage that did not come from a make_offer result or the facts. Rewrite it without any unverified numbers (call make_offer if you need to state an offer). Keep the DISPLAY/SPEECH format." });
        continue;
      }
      return { ...out, tools: used, model: SARVAM_LLM };
    }
    msgs.push({ role: "assistant", content: null, tool_calls: m.tool_calls });
    for (const c of m.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {
        /* empty args */
      }
      const res = await runTool(c.function.name, args, ses, a);
      used.push(c.function.name);
      allowed += " " + JSON.stringify(res);
      msgs.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(res) });
    }
  }
  return null;
}

/* ---------------- Gemini — fallback ---------------- */

async function turnGemini(ses: DealSession, a: Account, customerText: string) {
  const history: Content[] = ses.messages
    .filter((m) => m.who !== "system")
    .slice(-14)
    .map((m) => ({ role: m.who === "clutch" ? "model" : "user", parts: [{ text: m.text }] }));
  if (!history.length || history[history.length - 1].role !== "user") history.push({ role: "user", parts: [{ text: customerText }] });
  while (history.length > 1 && history[0].role === "model") history.shift();

  const used: string[] = [];
  let allowed = `${customerText} ${facts(a, ses)}`;
  for (let step = 0; step < 4; step++) {
    const parts = await callGemini(system(a, ses, ses.lang), history);
    if (!parts) return null;
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const text = parts.map((p) => p.text ?? "").join("").trim();
      if (!text) return null;
      const out = split(text);
      if (!numbersOk(`${out.reply} ${out.speech}`, allowed)) return null;
      return { ...out, tools: used, model: "gemini" };
    }
    history.push({ role: "model", parts });
    const responses: Part[] = [];
    for (const c of calls) {
      const res = await runTool(c.functionCall!.name, c.functionCall!.args ?? {}, ses, a);
      used.push(c.functionCall!.name);
      allowed += " " + JSON.stringify(res);
      responses.push({ functionResponse: { name: c.functionCall!.name, response: res as Record<string, unknown> } });
    }
    history.push({ role: "user", parts: responses });
  }
  return null;
}

export type AgentOut = { reply: string; speech: string; tools: string[]; model: string };

/** One agent turn: Sarvam first, Gemini second; null → caller uses the rules engine. */
export async function agentTurn(ses: DealSession, a: Account, customerText: string): Promise<AgentOut | null> {
  const t0 = Date.now();
  const out = (await turnSarvam(ses, a, customerText)) ?? (await turnGemini(ses, a, customerText));
  if (out) console.log(`[agent] ${a.id} ${out.model} ${Date.now() - t0}ms tools=${out.tools.join(",") || "-"}`);
  else console.log(`[agent] ${a.id} no LLM answer (${Date.now() - t0}ms) → rules engine`);
  return out;
}

/** Phrase a system-triggered message (e.g. manager approval) in the agent's voice. */
export async function agentSay(ses: DealSession, a: Account, draft: string): Promise<{ reply: string; speech: string } | null> {
  const m = await sarvamChat(
    [
      { role: "system", content: system(a, ses, ses.lang) },
      ...ses.messages
        .filter((x) => x.who !== "system")
        .slice(-6)
        .map((x): OAMsg => (x.who === "clutch" ? { role: "assistant", content: x.text } : { role: "user", content: x.text })),
      { role: "user", content: `[Internal update, not from the customer] Tell the customer this in your own words, keeping every number exactly: "${draft}"` },
    ],
    false,
  );
  if (!m?.content) return null;
  const out = split(m.content);
  return numbersOk(`${out.reply} ${out.speech}`, draft) ? out : null;
}
