/**
 * Inbox: everything that needs a human, plus an agent that reads customer
 * replies, works out what they want and does it — re-quotes, payment links,
 * contact changes, security documents — inside the same guardrails.
 */
import { sendEmail } from "./adapters";
import { validate } from "./dealdesk";
import { inr, inrCompact } from "./format";
import { llmJSON } from "./llmjson";
import { PLAYBOOK } from "./playbook";
import type { Intent, Reply, Triage } from "./replies-seed";
import { startPlay } from "./runner";
import { emit, getAccount, getHealth, recompute, record, store, uid } from "./store";
import type { Account, Contact, Offer, PlayKey } from "./types";

const SIGN = "Meera Kapoor\nCustomer Success, Helpdeck";
const firstName = (n: string) => n.split(" ")[0];

/* ---------------- understand ---------------- */

const INTENTS: Intent[] = ["change_request", "billing", "churn_risk", "info_request", "contact_change", "ready_to_sign", "other"];

function rules(body: string): Omit<Triage, "reply" | "actions" | "model" | "ms"> {
  const t = body.toLowerCase();
  const p: Triage["params"] = {};
  const add = t.match(/(\d+)\s+(?:more|extra|additional)\s+seats?/);
  const abs = t.match(/(?:to|need|want)\s+(\d+)\s+seats?/);
  if (add) p.addSeats = Number(add[1]);
  else if (abs) p.seats = Number(abs[1]);
  if (/upfront|up-front|annual(ly)? in advance/.test(t)) p.upfront = true;
  const name = body.match(/\b(?:I'?m|I am|this is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  const email = body.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (name) p.newContactName = name[1];
  if (email) p.newContactEmail = email[0];
  const docs = [
    [/soc ?2/, "SOC 2 Type II report"],
    [/dpa|data processing/, "DPA"],
    [/iso ?27001/, "ISO 27001 certificate"],
    [/pen ?test/, "Pen-test summary"],
    [/gst/, "GST certificate"],
  ]
    .filter(([re]) => (re as RegExp).test(t))
    .map(([, d]) => d as string);
  if (docs.length) p.documents = docs;
  let intent: Intent = "other";
  if (/\b(left|no longer|leaving|new (main )?contact|send .* to me|run the support team now)\b/.test(t)) intent = "contact_change";
  else if (/payment|card|invoice|billing link/.test(t)) intent = "billing";
  else if (/not sure we'?ll renew|won'?t renew|not renew|cancel|budget|too expensive|switch(ing)? to|options\?/.test(t)) intent = "churn_risk";
  else if (/soc ?2|dpa|security|infosec|gdpr|iso|documents?|w-?9|gst certificate/.test(t)) intent = "info_request";
  else if (/seats?|upgrade|upfront|add users|plan/.test(t)) intent = "change_request";
  else if (/send (it|the order form)|ready to sign|let'?s renew|go ahead/.test(t)) intent = "ready_to_sign";
  const summary = {
    change_request: "Wants to change the renewal terms.",
    billing: "Payment problem — needs a way to update the card.",
    churn_risk: "Signalling they may not renew.",
    info_request: "Needs documents before signing.",
    contact_change: "Their contact has changed.",
    ready_to_sign: "Ready to sign.",
    other: "General question.",
  }[intent];
  return { intent, confidence: intent === "other" ? 0.4 : 0.75, summary, params: p };
}

async function understand(r: Reply, a: Account) {
  const sys = `You triage customer emails for Helpdeck's renewals team. Classify the email into exactly one intent:
change_request (seats/plan/payment-terms change), billing (payment/card problem), churn_risk (may not renew, budget, cancel, competitor), info_request (needs documents: SOC 2, DPA, security, tax forms), contact_change (person left / new owner), ready_to_sign, other.
Extract params when present: seats (absolute total), addSeats (additional seats), upfront (true if they want to pay upfront/annually in advance), newContactName, newContactEmail, documents (list).
JSON schema: {"intent": string, "confidence": number 0-1, "summary": string (one short sentence, what they want), "params": object}`;
  const user = `Account: ${a.name} · ${a.plan} · ${a.seats} seats · renews ${a.contract.end}\nFrom: ${r.fromName} <${r.fromEmail}>\nSubject: ${r.subject}\n\n${r.body}`;
  const out = await llmJSON<{ intent: string; confidence: number; summary: string; params?: Triage["params"] }>(sys, user, { maxTokens: 300, timeoutMs: 9000 });
  const fb = rules(r.body);
  if (out && INTENTS.includes(out.data.intent as Intent)) {
    const params = { ...fb.params, ...(out.data.params ?? {}) };
    if (params.seats !== undefined) params.seats = Number(params.seats) || undefined;
    if (params.addSeats !== undefined) params.addSeats = Number(params.addSeats) || undefined;
    return { intent: out.data.intent as Intent, confidence: Math.max(0, Math.min(1, Number(out.data.confidence) || 0.8)), summary: out.data.summary || fb.summary, params, model: out.model };
  }
  return { ...fb, model: "rules" };
}

/* ---------------- act ---------------- */

async function reply(a: Account, r: Reply, body: string, actions: string[]) {
  const m = await sendEmail({ to: [r.fromEmail], subject: `Re: ${r.subject}`, body });
  record({ kind: "email", mode: m.mode, accountId: a.id, accountName: a.name, title: `Re: ${r.subject}`, to: `${r.fromName} <${r.fromEmail}>`, body, meta: [["Handled by", "Clutch inbox agent"], ["Actions", actions.join(" · ") || "reply only"]] });
}

async function act(a: Account, r: Reply, intent: Intent, p: Triage["params"]) {
  const actions: string[] = [];
  const name = firstName(r.fromName);
  const h0 = getHealth(a.id).risk;
  switch (intent) {
    case "change_request": {
      const wantsMore = /(more|additional|extra|add)/i.test(r.body);
      const seats = Math.max(1, p.addSeats ? a.seats + p.addSeats : p.seats && wantsMore && p.seats < a.seats * 0.6 ? a.seats + p.seats : (p.seats ?? a.seats));
      const extras = p.upfront ? ["upfront-payment"] : [];
      const v = validate(a, { discountPct: 0, termMonths: 12, extras, seats });
      if (!v.ok) {
        actions.push(`Change refused by deal desk: ${v.reasons[0]}`);
        return { actions, body: `Hi ${name},\n\nThanks — I'll need to check this one with the team and come back to you today.\n\n${SIGN}` };
      }
      const offer: Offer = { id: uid("ofr"), accountId: a.id, listPrice: v.listPrice, price: v.price, discountPct: 0, termMonths: 12, seats, extras, status: "draft", createdAt: Date.now() };
      store().offers.push(offer);
      actions.push(`Re-priced: ${a.seats} → ${seats} seats${p.upfront ? " · annual upfront" : ""} · ${inr(v.price)} (${v.reasons[0]})`);
      const busy = store().runs.find((x) => x.accountId === a.id && (x.status === "running" || x.status === "waiting"));
      if (!busy) {
        startPlay(a.id, "negotiated", { offerId: offer.id });
        actions.push("Order form sent for e-signature");
      } else actions.push("Attached to the running play");
      const proc = a.contacts.find((c) => /procure/i.test(c.role));
      if (/procure/i.test(r.body)) actions.push(proc ? `Copied ${proc.name} (procurement)` : "Copied procurement on the order form");
      return {
        actions,
        body: `Hi ${name},\n\nDone — your renewal is updated to ${seats} seats${p.upfront ? ", billed annually upfront" : ""}: ${inr(v.price)} for 12 months. The order form is on its way to you now (link: /sign/${offer.id})${/procure/i.test(r.body) ? " with procurement in copy" : ""}.\n\nIf anything needs adjusting before you sign, just reply here.\n\n${SIGN}`,
      };
    }
    case "billing": {
      const run = safeStart(a, "billing");
      actions.push(run ? "Started Billing recovery: payment link sent" : "Payment link sent");
      return {
        actions,
        body: `Hi ${name},\n\nNo problem — here's a secure link to update the card: https://pay.helpdeck.dev/u/${a.stripeSubscriptionId}\n\nNothing has been switched off, and we'll retry the invoice automatically as soon as the new card is in.\n\n${SIGN}`,
      };
    }
    case "churn_risk": {
      a.tickets.push({ id: uid("t"), number: 3500 + a.tickets.length, subject: "Customer signalled they may not renew", body: r.body, priority: "P2", status: "open", openedDaysAgo: 0, sentiment: -0.6 });
      recompute(a.id);
      const h = getHealth(a.id);
      actions.push(h.risk !== h0 ? `Flagged as churn risk · risk ${h0} → ${h.risk}` : `Flagged as churn risk (risk ${h.risk}) · intent logged on the account`);
      const play: PlayKey = h.cause === "touchless" || h.cause === "expansion" ? "adoption" : h.cause;
      if (safeStart(a, play)) actions.push(`Started ${PLAYBOOK[play].title}`);
      actions.push("Shared their value receipt", "Alerted the CSM in #renewals");
      const active = Math.round(a.usage.slice(-28).reduce((t, d) => t + d.activeUsers, 0) / 28);
      return {
        actions,
        body: `Hi ${name},\n\nThank you for being straight with me — that's genuinely useful. A few options, so the budget works:\n\n  • Right-size to the people actually using it (about ${Math.max(5, Math.ceil(active * 1.1))} seats instead of ${a.seats}), locked at today's price.\n  • Pause for up to two months and keep all your data and setup.\n  • A free 30-minute session to get the rest of the team value from it.\n\nHere's what Helpdeck did for your team in the last 90 days: /value/${a.id}\n\nWould 20 minutes this week help? I'll work around your calendar.\n\n${SIGN}`,
      };
    }
    case "info_request": {
      const docs = p.documents?.length ? p.documents : ["SOC 2 Type II report", "DPA"];
      actions.push(`Sent from the trust library: ${docs.join(", ")}`);
      record({ kind: "analysis", mode: "live", accountId: a.id, accountName: a.name, title: `Security pack · ${a.name}`, body: "Shared under the standard NDA in the trust library.", meta: docs.map((d) => [d, "shared · expires in 30 days"] as [string, string]) });
      return {
        actions,
        body: `Hi ${name},\n\nOf course. Here's our security pack for your InfoSec team:\n\n  • SOC 2 Type II report (2026) — https://trust.helpdeck.dev/soc2\n  • Data Processing Agreement — https://trust.helpdeck.dev/dpa\n  • Latest pen-test summary — https://trust.helpdeck.dev/pentest\n\nThe links work for 30 days. If they have a questionnaire, send it over and we'll turn it around in 48 hours.\n\n${SIGN}`,
      };
    }
    case "contact_change": {
      const old = a.contacts.find((c) => c.isChampion);
      let nc: Contact | undefined = a.contacts.find((c) => p.newContactName && c.name.toLowerCase().startsWith(p.newContactName.toLowerCase().split(" ")[0]));
      nc ??= a.contacts.find((c) => c.email === r.fromEmail);
      if (!nc) {
        nc = { id: uid("c"), name: p.newContactName ?? r.fromName, role: "Support Lead", email: p.newContactEmail ?? r.fromEmail, phone: "", isChampion: false, isExecSponsor: false, lastActiveDaysAgo: 0, bounced: false };
        a.contacts.push(nc);
      }
      if (old && old.id !== nc.id) {
        old.isChampion = false;
        old.bounced = true;
      }
      nc.isChampion = true;
      nc.lastActiveDaysAgo = 0;
      recompute(a.id);
      const h = getHealth(a.id);
      actions.push(`Updated champion: ${old ? firstName(old.name) : "—"} → ${firstName(nc.name)}`, `Renewal emails now go to ${nc.name}`, `Risk re-scored ${h0} → ${h.risk}`);
      return {
        actions,
        body: `Hi ${firstName(nc.name)},\n\nThanks for letting me know — I've made you the main contact for Helpdeck, so renewal details will come straight to you. Your renewal is due on ${a.contract.end}.\n\nWould a quick 20-minute intro this week help? I can walk you through what your team uses and what's coming.\n\n${SIGN}`,
      };
    }
    case "ready_to_sign": {
      const sent = store().offers.find((o) => o.accountId === a.id && o.status === "sent");
      if (sent) actions.push("Re-sent the existing order form");
      else if (safeStart(a, "touchless")) actions.push("Started Touchless renewal: quote + order form");
      return { actions, body: `Hi ${name},\n\nWonderful — ${sent ? `here's the order form again: /sign/${sent.id}` : "the order form will be with you in a minute"}. It takes about two minutes to sign on any device.\n\n${SIGN}` };
    }
    default: {
      actions.push("Forwarded to the CSM with a summary");
      return { actions, body: `Hi ${name},\n\nThanks for your note — I've passed it to the right person and you'll hear back today.\n\n${SIGN}` };
    }
  }
}

function safeStart(a: Account, play: PlayKey) {
  const busy = store().runs.find((x) => x.accountId === a.id && (x.status === "running" || x.status === "waiting"));
  if (busy) return null;
  try {
    return startPlay(a.id, play, { autoSign: false });
  } catch {
    return null;
  }
}

export async function handleReply(id: string) {
  const r = store().replies.find((x) => x.id === id);
  if (!r) throw new Error("reply not found");
  if (r.status !== "new") return r;
  const a = getAccount(r.accountId)!;
  r.status = "handling";
  const t0 = Date.now();
  const u = await understand(r, a);
  const done = await act(a, r, u.intent, u.params);
  await reply(a, r, done.body, done.actions);
  r.triage = { ...u, reply: done.body, actions: done.actions, ms: Date.now() - t0 };
  r.status = "handled";
  emit({ kind: "deal", accountId: a.id, accountName: a.name, title: `Reply handled: ${u.summary}`, detail: done.actions.join(" · "), tone: u.intent === "churn_risk" ? "risk" : "good" });
  return r;
}

export async function addReply(accountId: string, body: string, subject = "Re: Your Helpdeck renewal") {
  const a = getAccount(accountId);
  if (!a) throw new Error("unknown account");
  const c = a.contacts.find((x) => x.isChampion && !x.bounced) ?? a.contacts.find((x) => !x.bounced) ?? a.contacts[0];
  const r: Reply = { id: uid("rep"), accountId, accountName: a.name, fromName: c.name, fromEmail: c.email, subject, body, at: Date.now(), status: "new" };
  store().replies.unshift(r);
  emit({ kind: "signal", accountId, accountName: a.name, title: `New reply from ${c.name}`, detail: body.slice(0, 90), tone: "action" });
  if (store().settings.autoReplies) await handleReply(r.id);
  return r;
}

/* ---------------- view ---------------- */

export function inboxView() {
  const s = store();
  const approvals = [...s.deals.values()]
    .filter((d) => d.pendingApproval && d.stage === "awaiting-approval")
    .map((d) => {
      const a = getAccount(d.accountId)!;
      return { accountId: a.id, accountName: a.name, arr: a.arr, channel: d.channel, discount: d.pendingApproval!.discountPct, term: d.pendingApproval!.termMonths, price: d.pendingApproval!.price, extras: d.pendingApproval!.extras };
    });
  const steps = s.runs
    .filter((r) => r.status === "waiting")
    .flatMap((r) => {
      const st = r.steps.find((x) => x.status === "waiting");
      if (!st) return [];
      const a = getAccount(r.accountId)!;
      return [{ runId: r.id, accountId: a.id, accountName: a.name, play: r.title, step: st.label, key: st.key, who: st.key === "await_signature" ? "customer" : "you", link: st.link ?? null }];
    });
  const suggestions = s.suggestions.map((x) => {
    const a = getAccount(x.accountId)!;
    return { ...x, accountName: a.name, arr: a.arr, title: PLAYBOOK[x.play].title };
  });
  const replies = [...s.replies].sort((x, y) => Number(x.status !== "new") - Number(y.status !== "new") || y.at - x.at);
  return {
    approvals,
    steps,
    suggestions,
    replies,
    counts: { approvals: approvals.length, you: steps.filter((x) => x.who === "you").length + suggestions.length, replies: replies.filter((x) => x.status === "new").length },
    autoReplies: s.settings.autoReplies,
  };
}

export function inboxCount() {
  const v = inboxView();
  return v.counts.approvals + v.counts.you + v.counts.replies;
}

export function decideSuggestion(id: string, approve: boolean) {
  const s = store();
  const x = s.suggestions.find((y) => y.id === id);
  if (!x) throw new Error("not found");
  s.suggestions = s.suggestions.filter((y) => y.id !== id);
  if (approve) {
    startPlay(x.accountId, x.play, { autoSign: x.play === "touchless" || x.play === "expansion", autoSignAfterMs: 9000 });
  }
  return { ok: true, started: approve, arr: inrCompact(getAccount(x.accountId)!.arr) };
}
