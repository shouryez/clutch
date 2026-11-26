/**
 * After every call or chat: a CRM-ready summary — outcome, objections, what we
 * committed to, next steps — written by the model from the transcript and
 * cross-checked against the deal desk's own log (the source of truth for money).
 */
import { inr } from "./format";
import { llmJSON } from "./llmjson";
import type { CallSummary, DealSession } from "./negotiator";
import { emit, getAccount, record, store } from "./store";

function fallback(ses: DealSession): Omit<CallSummary, "model" | "at"> {
  const said = ses.messages.filter((m) => m.who === "customer").map((m) => m.text.toLowerCase()).join(" ");
  const objections: string[] = [];
  if (/export|bug|broken|fail/.test(said)) objections.push("Product reliability (exports failing)");
  if (/freshdesk|zendesk|competitor|switch/.test(said)) objections.push("Evaluating a competitor");
  if (/price|discount|expensive|budget|%|percent/.test(said)) objections.push("Price / discount");
  if (/sso|saml|feature/.test(said)) objections.push("Missing feature");
  const commitments = [...ses.gave];
  if (ses.topics.includes("bug")) commitments.push("Export fix ships Thursday; CSM tracks personally");
  const agreed = ses.stage === "agreed";
  return {
    outcome: agreed ? `Agreed${ses.current ? ` · ${inr(ses.current.price)} · ${ses.current.termMonths} months` : ""}` : ses.stage === "awaiting-approval" ? "Waiting on manager approval" : ses.current ? "Offer on the table, not yet agreed" : "No offer made yet",
    summary: `${ses.messages.filter((m) => m.who === "customer").length} customer turns${ses.lang === "hi" ? " in Hinglish" : ""}. ${objections.length ? `Raised: ${objections.join(", ").toLowerCase()}.` : "No objections raised."}`,
    objections,
    commitments,
    nextSteps: agreed ? ["Order form sent — wait for signature", "Confirm billing update"] : ["Follow up within 24 hours", "Keep the offer inside the ladder"],
    sentiment: ses.sentiment > 0.2 ? "positive" : ses.sentiment < -0.25 ? "negative" : "neutral",
  };
}

export async function summarize(accountId: string) {
  const ses = store().deals.get(accountId);
  const a = getAccount(accountId);
  if (!ses || !a) throw new Error("no conversation");
  const turns = ses.messages.filter((m) => m.who !== "system");
  if (turns.filter((m) => m.who === "customer").length === 0) throw new Error("nothing said yet");
  const base = fallback(ses);
  const transcript = turns.map((m) => `${m.who === "clutch" ? "Clutch" : ses.contact.name}: ${m.text}`).join("\n").slice(-6000);
  const money = ses.log.filter((l) => l.tone === "ok").map((l) => `${l.fn}(${l.args}) → ${l.result}`).join("; ") || "no offers";
  const out = await llmJSON<Partial<CallSummary>>(
    `You write CRM notes after a renewal ${ses.channel === "voice" ? "call" : "chat"}. Be factual and brief; English only even if the call was Hinglish. Use only numbers that appear in the transcript or the deal log.
JSON: {"outcome": string (one line), "summary": string (2 sentences max), "objections": [string], "commitments": [string] (what Helpdeck promised), "nextSteps": [string], "sentiment": "positive"|"neutral"|"negative"}`,
    `Account: ${a.name} (${a.plan}, ${a.seats} seats, renews ${a.contract.end})\nDeal desk log: ${money}\nStage: ${ses.stage}\n\nTranscript:\n${transcript}`,
    { maxTokens: 450, timeoutMs: 12000 },
  );
  const d = out?.data ?? {};
  const arr = (x: unknown, fb: string[]) => (Array.isArray(x) && x.every((y) => typeof y === "string") && x.length ? (x as string[]).slice(0, 5) : fb);
  const s: CallSummary = {
    outcome: base.outcome, // money outcome always from the deal desk, never the model
    summary: typeof d.summary === "string" && d.summary ? d.summary : base.summary,
    objections: arr(d.objections, base.objections),
    commitments: arr(d.commitments, base.commitments),
    nextSteps: arr(d.nextSteps, base.nextSteps),
    sentiment: d.sentiment === "positive" || d.sentiment === "negative" || d.sentiment === "neutral" ? d.sentiment : base.sentiment,
    model: out?.model ?? "rules",
    at: Date.now(),
  };
  ses.summary = s;
  record({
    kind: "analysis",
    mode: "live",
    accountId: a.id,
    accountName: a.name,
    title: `${ses.channel === "voice" ? "Call" : "Chat"} summary · ${a.name}`,
    body: `${s.outcome}\n\n${s.summary}`,
    meta: [
      ["Objections", s.objections.join(" · ") || "—"],
      ["We committed to", s.commitments.join(" · ") || "—"],
      ["Next steps", s.nextSteps.join(" · ") || "—"],
      ["Sentiment", s.sentiment],
    ],
    link: `/app/call/${a.id}`,
  });
  emit({ kind: "call", accountId: a.id, accountName: a.name, title: `${ses.channel === "voice" ? "Call" : "Chat"} summary logged`, detail: s.outcome, tone: "neutral" });
  return s;
}
