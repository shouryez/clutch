/**
 * Real email from any step. Every artifact Clutch produces (customer email, quote, issue, Slack alert,
 * meeting, billing link, research, call summary) has a drafted email template filled with the account's
 * live variables. In the demo every message is delivered to DEMO_EMAIL_TO (the original recipient is
 * shown in a banner), so judges can watch real mail arrive without anyone else being emailed.
 */
import { readFileSync } from "node:fs";
import { getAccount, getHealth, store } from "./store";
import { inr, inrCompact } from "./format";
import { PLAYBOOK } from "./playbook";
import type { Artifact } from "./types";

export type Draft = { subject: string; html: string; text: string; originalTo: string; scenario: string };
export type Attachment = { filename: string; content: string /* base64 */ };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Links in emails must open on a phone: prefer the live tunnel URL. */
const base = () => {
  let t = "";
  try {
    t = readFileSync(".tunnel-url", "utf8").trim();
  } catch {}
  return (t || process.env.PUBLIC_URL || "http://localhost:3210").replace(/\/$/, "");
};
const abs = (link?: string) => (link ? (link.startsWith("http") ? link : base() + link) : undefined);
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/** Variables every template can use. */
export function vars(accountId?: string) {
  const a = accountId ? getAccount(accountId) : undefined;
  if (!a) return null;
  const h = getHealth(a.id);
  const champ = a.contacts.find((c) => c.isChampion && !c.bounced) ?? a.contacts.find((c) => !c.bounced);
  return {
    account: a.name,
    industry: a.industry,
    city: a.city,
    plan: a.plan,
    seats: a.seats,
    arr: inr(a.arr),
    arrShort: inrCompact(a.arr),
    risk: h.risk,
    tier: h.tier,
    why: h.why,
    renewalDate: fmtDate(a.contract.end),
    daysToRenewal: h.daysToRenewal,
    noticeDays: a.contract.noticeDays,
    daysToNotice: h.daysToNotice,
    uplift: a.contract.upliftPct,
    champion: champ?.name ?? "the team",
    championFirst: champ?.name.split(" ")[0] ?? "there",
    csm: a.csm,
    accountUrl: `${base()}/app/accounts/${a.id}`,
  };
}

function shell(o: { scenario: string; title: string; originalTo: string; context: string; body: string; cta?: { label: string; href: string }; meta?: [string, string][] }) {
  const meta = o.meta?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:18px 0 4px;border-collapse:collapse">${o.meta
        .map(([k, v]) => `<tr><td style="padding:7px 0;border-top:1px solid #ece8df;color:#77726a;font-size:13px">${esc(k)}</td><td style="padding:7px 0;border-top:1px solid #ece8df;text-align:right;font-size:13px;font-weight:600;color:#1d1c1a">${esc(v)}</td></tr>`)
        .join("")}</table>`
    : "";
  const cta = o.cta ? `<p style="margin:22px 0 4px"><a href="${o.cta.href}" style="display:inline-block;background:#ff5a1f;color:#0b0b0a;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px">${esc(o.cta.label)} →</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#efebe3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1c1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efebe3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 4px 10px;font-size:12px;color:#77726a">Demo delivery · originally to <b>${esc(o.originalTo || "—")}</b> · ${esc(o.scenario)}</td></tr>
<tr><td style="background:#0b0b0a;border-radius:18px 18px 0 0;padding:22px 28px">
<span style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#eee9df">clutch<span style="color:#ff5a1f">.</span></span>
<div style="margin-top:14px;font-size:20px;line-height:1.3;font-weight:650;color:#eee9df">${esc(o.title)}</div>
<div style="margin-top:6px;font-size:12.5px;color:#8c877d">${esc(o.context)}</div>
</td></tr>
<tr><td style="background:#ff5a1f;height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 18px 18px;padding:26px 28px 28px;font-size:15px;line-height:1.6">
${o.body}${meta}${cta}
</td></tr>
<tr><td style="padding:14px 4px;font-size:11.5px;color:#8c877d;line-height:1.5">Sent by Clutch, the renewal autopilot for Helpdeck. Every action is logged in the Outbox.</td></tr>
</table></td></tr></table></body></html>`;
}

const paras = (t: string) =>
  t
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

/** The drafted email for any artifact. */
export function draftForArtifact(x: Artifact): Draft {
  const v = vars(x.accountId);
  const play = x.play ? PLAYBOOK[x.play] : undefined;
  const run = x.runId ? store().runs.find((r) => r.id === x.runId) : undefined;
  const stepIdx = run ? run.steps.findIndex((s) => s.artifactId === x.id) : -1;
  const context = [x.accountName, play ? `${play.label} play` : null, run && stepIdx >= 0 ? `step ${stepIdx + 1} of ${run.steps.length}: ${run.steps[stepIdx].label}` : null].filter(Boolean).join(" · ");
  const link = abs(x.link);
  const originalTo = x.to ?? "";
  const meta = x.meta ?? [];
  const facts: [string, string][] = v ? [["Account", `${v.account} · ${v.industry}`], ["ARR", v.arr], ["Renews", `${v.renewalDate} (${v.daysToRenewal} days)`], ["Risk", `${v.risk}/100 · ${v.tier}`]] : [];

  switch (x.kind) {
    case "email":
      return {
        scenario: "customer email",
        originalTo,
        subject: x.title,
        text: x.body,
        html: shell({ scenario: "Customer email", title: x.title, originalTo, context, body: paras(x.body), meta, cta: link ? { label: link.includes("/sign/") ? "Review & sign the order form" : link.includes("/value/") ? "See your value receipt" : "Open", href: link } : undefined }),
      };
    case "quote":
      return {
        scenario: "renewal quote",
        originalTo: originalTo || (v ? `${v.champion} at ${v.account}` : ""),
        subject: `Your renewal quote — ${x.accountName ?? ""}`.trim(),
        text: x.body,
        html: shell({
          scenario: "Renewal quote",
          title: `Renewal quote for ${x.accountName}`,
          originalTo: originalTo || (v ? v.champion : ""),
          context,
          body: `<p style="margin:0 0 14px">Hi ${esc(v?.championFirst ?? "there")},</p>${paras(x.body)}<p style="margin:0 0 6px">Your contract renews on <b>${esc(v?.renewalDate ?? "")}</b>; the notice window closes in <b>${v?.daysToNotice ?? "—"} days</b>.</p>`,
          meta,
          cta: link ? { label: "Open the order form", href: link } : undefined,
        }),
      };
    case "issue":
      return {
        scenario: "engineering escalation",
        originalTo: originalTo || "engineering@helpdeck",
        subject: `[Escalation] ${x.title}`,
        text: x.body,
        html: shell({
          scenario: "Engineering escalation",
          title: x.title,
          originalTo: originalTo || "engineering@helpdeck",
          context,
          body: `<p style="margin:0 0 14px">Clutch filed this bug because it is blocking renewals. Revenue attached below.</p><pre style="white-space:pre-wrap;font:13px/1.55 ui-monospace,Menlo,Consolas,monospace;background:#f6f3ed;border-radius:12px;padding:14px;margin:0">${esc(x.body)}</pre>`,
          meta: [...meta, ...facts.slice(0, 2)],
          cta: link ? { label: "Open the issue", href: link } : undefined,
        }),
      };
    case "slack":
      return {
        scenario: "internal alert",
        originalTo: originalTo || "#renewals",
        subject: `🔔 ${x.title}`,
        text: x.body,
        html: shell({ scenario: "Internal alert (#renewals)", title: x.title, originalTo: originalTo || "#renewals", context, body: paras(x.body.replace(/[*_]/g, "")), meta: [...meta, ...facts], cta: v ? { label: "Open the account in Clutch", href: v.accountUrl } : undefined }),
      };
    case "meeting":
      return {
        scenario: "meeting invite",
        originalTo,
        subject: `Invitation: ${x.title}`,
        text: x.body,
        html: shell({ scenario: "Meeting invite", title: x.title, originalTo, context, body: paras(x.body), meta, cta: link ? { label: "Accept", href: link } : undefined }),
      };
    case "billing":
      return {
        scenario: "billing update",
        originalTo: originalTo || (v ? `${v.account} finance` : ""),
        subject: `Billing update — ${x.accountName ?? ""}`.trim(),
        text: x.body,
        html: shell({ scenario: "Billing", title: x.title, originalTo: originalTo || (v ? `${v.account} finance` : ""), context, body: paras(x.body), meta, cta: link ? { label: "Update payment", href: link } : undefined }),
      };
    case "research":
      return {
        scenario: "account research",
        originalTo: originalTo || (v ? `${v.csm} (CSM)` : ""),
        subject: `Research: ${x.title}`,
        text: x.body,
        html: shell({ scenario: "Account research for the CSM", title: x.title, originalTo: originalTo || (v ? v.csm : ""), context, body: paras(x.body), meta: [...meta, ...facts] }),
      };
    default:
      return {
        scenario: "analysis",
        originalTo: originalTo || (v ? `${v.csm} (CSM)` : ""),
        subject: x.title,
        text: x.body,
        html: shell({ scenario: "Analysis", title: x.title, originalTo: originalTo || (v ? v.csm : ""), context, body: paras(x.body), meta: [...meta, ...facts], cta: link ? { label: "Open", href: link } : undefined }),
      };
  }
}

/** Policy exceptions digest (from the latest audit). */
export function draftExceptions(audit: { n: number; at: number; counts: { new: number; total: number; critical: number; high: number }; exposure: number; exceptions: { ruleId: string; ruleName: string; severity: string; accountName: string; message: string; status: string; evidence: { field: string; actual: string }[] }[] }): Draft {
  const list = [...audit.exceptions].sort((a, b) => (a.status === "new" ? 0 : 1) - (b.status === "new" ? 0 : 1)).slice(0, 12);
  const rows = list
    .map(
      (e) =>
        `<tr><td style="padding:9px 0;border-top:1px solid #ece8df;vertical-align:top;font-size:12px;color:${/critical|high/.test(e.severity) ? "#e14a12" : "#77726a"};font-weight:600;white-space:nowrap">${e.status === "new" ? "NEW · " : ""}${esc(e.severity)}</td><td style="padding:9px 0 9px 12px;border-top:1px solid #ece8df;font-size:13.5px"><b>${esc(e.accountName)}</b> — ${esc(e.message)}<div style="font:11.5px ui-monospace,Menlo,monospace;color:#8c877d;margin-top:2px">${esc(e.ruleId)} · ${esc(e.evidence.map((x) => `${x.field} = ${x.actual}`).join(", "))}</div></td></tr>`,
    )
    .join("");
  const title = `Policy audit #${audit.n}: ${audit.counts.new} new exception${audit.counts.new === 1 ? "" : "s"}`;
  return {
    scenario: "policy exceptions",
    originalTo: "Finance & RevOps",
    subject: title,
    text: list.map((e) => `${e.status === "new" ? "NEW " : ""}[${e.severity}] ${e.accountName} — ${e.message} (${e.ruleId})`).join("\n"),
    html: shell({
      scenario: "Policy audit digest",
      title,
      originalTo: "Finance & RevOps",
      context: `${audit.counts.total} open · ${audit.counts.critical} critical · ${audit.counts.high} high · ${inrCompact(audit.exposure)} ARR exposed`,
      body: `<p style="margin:0 0 6px">The latest audit checked every account and open offer against your policies.</p><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px">${rows}</table>`,
      cta: { label: "Open Policies & audit", href: `${base()}/app/policies` },
    }),
  };
}

/** Boardroom brief cover email (the PDF goes as an attachment). */
export function draftBrief(b: { generatedLabel: string; summary: { text: string }; impact: { arrAtRisk: number; expectedLoss: number; arrUpForRenewal: number; exceptionsOpen: number }; processed: { total: number }; top3: { rank: number; name: string; arr: number; risk: number; daysToNotice: number; recommended: string }[]; citations: unknown[] }): Draft {
  const top = b.top3.map((t) => `<li style="margin:0 0 8px"><b>${esc(t.name)}</b> — ${inrCompact(t.arr)} ARR, risk ${t.risk}, notice in ${t.daysToNotice} days.<br><span style="color:#77726a;font-size:13px">${esc(t.recommended)}</span></li>`).join("");
  return {
    scenario: "boardroom brief",
    originalTo: "Board & leadership",
    subject: `Boardroom brief — ${inrCompact(b.impact.arrAtRisk)} ARR at risk (${b.generatedLabel})`,
    text: b.summary.text,
    html: shell({
      scenario: "Boardroom brief (PDF attached)",
      title: "Renewal risk — executive summary",
      originalTo: "Board & leadership",
      context: `Generated ${b.generatedLabel} IST · ${b.processed.total.toLocaleString("en-IN")} records · ${b.citations.length} cited sources`,
      body: `<p style="margin:0 0 14px">${esc(b.summary.text)}</p><p style="margin:0 0 6px;font-weight:700">Top 3 urgent</p><ol style="padding-left:20px;margin:0 0 6px">${top}</ol><p style="margin:12px 0 0;color:#77726a;font-size:13px">The full brief with every source citation is attached as a PDF.</p>`,
      meta: [
        ["ARR at risk", inrCompact(b.impact.arrAtRisk)],
        ["Expected loss if no action", inrCompact(b.impact.expectedLoss)],
        ["Renewing in 120 days", inrCompact(b.impact.arrUpForRenewal)],
        ["Open policy exceptions", String(b.impact.exceptionsOpen)],
      ],
      cta: { label: "Open the brief in Clutch", href: `${base()}/app/brief` },
    }),
  };
}

/** Deliver for real (Resend). Everything goes to DEMO_EMAIL_TO; a sandboxed Resend account falls back to its owner. */
export async function deliver(d: Draft, attachments?: Attachment[]): Promise<{ ok: boolean; id?: string; to?: string; note?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Clutch <onboarding@resend.dev>";
  const to = process.env.DEMO_EMAIL_TO;
  if (!key || !to) return { ok: false, error: "Email is not configured (RESEND_API_KEY / DEMO_EMAIL_TO)." };
  const send = async (addr: string) => {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [addr], subject: d.subject, html: d.html, text: d.text, ...(attachments?.length ? { attachments } : {}) }),
    });
    return { status: r.status, j: (await r.json().catch(() => ({}))) as { id?: string; message?: string } };
  };
  try {
    let r = await send(to);
    if (r.status === 403) {
      const owner = /own email address \(([^)]+)\)/.exec(r.j.message ?? "")?.[1];
      if (owner && owner !== to) {
        const r2 = await send(owner);
        if (r2.j.id) return { ok: true, id: r2.j.id, to: owner, note: `Resend is in testing mode, so it went to the account owner (${owner}). Verify a domain at resend.com/domains to deliver to ${to}.` };
        r = r2;
      }
    }
    if (r.j.id) return { ok: true, id: r.j.id, to };
    return { ok: false, error: r.j.message ?? `Resend ${r.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
