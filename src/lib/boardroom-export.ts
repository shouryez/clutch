/**
 * Boardroom brief → PDF (designed, with embedded Noto Sans so ₹ renders), Markdown, CSV.
 * All three are built from the same compiled Brief, so they always agree with each other and the screen.
 */
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { Brief, Citation } from "./boardroom";
import { inr, inrCompact } from "./format";

const KIND_LABEL: Record<Citation["kind"], string> = { clause: "Contract clause", ticket: "Support ticket", email: "Email", invoice: "Invoice", metric: "Metric", contact: "CRM record", rule: "Policy rule", log: "Log entry" };
const sevOrder = ["critical", "high", "medium", "low"];

// ------------------------------------------------------------------ markdown

export function toMarkdown(b: Brief) {
  const i = b.impact;
  const L: string[] = [];
  L.push(`# Boardroom brief — ${b.workspace} renewals`);
  L.push("");
  L.push(`_Generated ${b.generatedLabel} IST · audit #${b.run.auditN} · policies v${b.run.rulesVersion} (\`${b.run.file}\`) · brief \`${b.id}\` · fingerprint \`${b.fingerprint}\`_`);
  L.push("");
  L.push("## Executive summary");
  L.push("");
  L.push(b.summary.text);
  L.push("");
  L.push(`> ${b.summary.model ? `Narrative written by ${b.summary.model}; every number in it was checked against the computed figures below.` : "Narrative generated from the computed figures below."}`);
  L.push("");
  L.push("| Metric | Value |");
  L.push("|---|---|");
  L.push(`| Records processed | ${b.processed.total.toLocaleString("en-IN")} (${b.processed.accounts} accounts · ${b.processed.contracts} contracts / ${b.processed.clauses} clauses · ${b.processed.usageDays.toLocaleString("en-IN")} usage-days · ${b.processed.tickets} tickets · ${b.processed.emails} emails · ${b.processed.invoices} invoices · ${b.processed.contacts} contacts) |`);
  L.push(`| Policy checks run | ${b.processed.checks} (${b.processed.rules} rules × ${b.processed.accounts} accounts${b.processed.offers ? ` + ${b.processed.offers} offers` : ""}) |`);
  L.push(`| ARR under management | ${inr(i.arrUnderManagement)} |`);
  L.push(`| ARR renewing in 120 days | ${inr(i.arrUpForRenewal)} (${i.renewalsIn120} renewals) |`);
  L.push(`| **ARR at risk** | **${inr(i.arrAtRisk)}** (${i.atRiskCount} accounts) |`);
  L.push(`| **Expected loss if no action** | **${inr(i.expectedLoss)}** |`);
  L.push(`| Open policy exceptions | ${i.exceptionsOpen} (${i.bySeverity.critical} critical · ${i.bySeverity.high} high · ${i.bySeverity.medium} medium · ${i.bySeverity.low} low) · ARR exposed ${inr(i.exposure)} |`);
  if (i.arrRenewed || i.savedArr) L.push(`| Already secured | ${inr(i.arrRenewed)} renewed · ${inr(i.savedArr)} saved from cancellation |`);
  L.push("");
  L.push(`## Top ${b.top3.length} urgent exceptions`);
  for (const t of b.top3) {
    L.push("");
    L.push(`### ${t.rank}. ${t.name} — ${inrCompact(t.arr)} ARR · risk ${t.risk}/100 · notice deadline in ${t.daysToNotice} days`);
    L.push("");
    L.push(`**Expected loss:** ${inr(t.expectedLoss)} · **Renews:** ${t.renewalDate} · **Notice by:** ${t.noticeBy} · ${t.industry}`);
    L.push("");
    L.push("**Why it is flagged**");
    for (const w of t.why) L.push(`- ${w.text} ${w.cites.map((c) => `[${c}]`).join("")}`);
    if (t.exceptions.length) {
      L.push("");
      L.push("**Policy exceptions**");
      for (const e of t.exceptions) L.push(`- \`${e.ruleId}\` ${e.ruleName} (${e.severity}) — ${e.message} ${e.cite.split(",").map((c) => `[${c}]`).join("")}`);
    }
    L.push("");
    L.push(`**Recommended:** ${t.recommended}  `);
    L.push(`**Status:** ${t.status}`);
  }
  L.push("");
  L.push(`## All open exceptions (${b.exceptions.length})`);
  L.push("");
  L.push("| Severity | Rule | Account | Finding | Evidence | Source |");
  L.push("|---|---|---|---|---|---|");
  for (const e of [...b.exceptions].sort((x, y) => sevOrder.indexOf(x.severity) - sevOrder.indexOf(y.severity) || y.arr - x.arr)) {
    L.push(`| ${e.severity}${e.status === "new" ? " · NEW" : ""} | ${e.ruleId} | ${e.accountName}${e.offerLabel ? ` (offer ${e.offerLabel})` : ""} | ${e.message.replace(/\|/g, "/")} | ${e.evidence.map((x) => `${x.field}=${x.actual}`).join("; ")} | [${e.cite}] |`);
  }
  L.push("");
  L.push("## Sources");
  L.push("");
  for (const c of b.citations) {
    L.push(`**[${c.id}]** ${KIND_LABEL[c.kind]} — ${c.source}  `);
    L.push(`${c.detail}${c.quote ? `  \n> “${c.quote}”` : ""}`);
    L.push("");
  }
  L.push("## Method");
  L.push("");
  for (const m of b.method) L.push(`- ${m}`);
  L.push("");
  return L.join("\n");
}

// ------------------------------------------------------------------ csv

export function toCSV(b: Brief) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cite = new Map(b.citations.map((c) => [c.id, c]));
  const rows: unknown[][] = [["section", "rank", "account", "arr_inr", "risk", "severity", "item", "finding", "citation_id", "citation_type", "citation_source", "citation_detail", "citation_quote"]];
  const i = b.impact;
  const meta: [string, unknown][] = [
    ["brief_id", b.id],
    ["generated_ist", b.generatedLabel],
    ["audit_run", `#${b.run.auditN}`],
    ["policies_version", `v${b.run.rulesVersion}`],
    ["records_processed", b.processed.total],
    ["accounts_processed", b.processed.accounts],
    ["policy_checks", b.processed.checks],
    ["arr_renewing_120d", i.arrUpForRenewal],
    ["arr_at_risk", i.arrAtRisk],
    ["expected_loss", i.expectedLoss],
    ["exceptions_open", i.exceptionsOpen],
    ["exceptions_critical", i.bySeverity.critical],
    ["fingerprint", b.fingerprint],
  ];
  for (const [k, v] of meta) rows.push(["summary", "", "", "", "", "", k, v, "", "", "", "", ""]);
  for (const t of b.top3) {
    const items: { item: string; finding: string; cites: string[]; sev?: string }[] = [
      ...t.why.map((w) => ({ item: "reason", finding: w.text, cites: w.cites })),
      ...t.exceptions.map((e) => ({ item: e.ruleId, finding: `${e.ruleName}: ${e.message}`, cites: e.cite.split(","), sev: e.severity })),
    ];
    for (const it of items) {
      for (const cid of it.cites.length ? it.cites : [""]) {
        const c = cite.get(cid);
        rows.push(["urgent", t.rank, t.name, t.arr, t.risk, it.sev ?? t.tier, it.item, it.finding, cid, c ? KIND_LABEL[c.kind] : "", c?.source ?? "", c?.detail ?? "", c?.quote ?? ""]);
      }
    }
  }
  for (const e of b.exceptions) {
    const c = cite.get(e.cite);
    rows.push(["exception", "", e.accountName, e.arr, "", e.severity, e.ruleId, `${e.message} | evidence: ${e.evidence.map((x) => `${x.field}=${x.actual}`).join("; ")}`, e.cite, c ? KIND_LABEL[c.kind] : "", c?.source ?? "", c?.detail ?? "", ""]);
  }
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

// ------------------------------------------------------------------ pdf

const C = {
  ink: rgb(0.043, 0.043, 0.039),
  text: rgb(0.13, 0.13, 0.12),
  grey: rgb(0.43, 0.42, 0.39),
  faint: rgb(0.62, 0.6, 0.57),
  line: rgb(0.87, 0.85, 0.81),
  bone: rgb(0.965, 0.953, 0.93),
  signal: rgb(1, 0.353, 0.122),
  signalSoft: rgb(1, 0.93, 0.89),
  white: rgb(1, 1, 1),
  volt: rgb(0.843, 1, 0.239),
};

export async function toPDF(b: Brief): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), "assets", "fonts");
  const load = (f: string) => doc.embedFont(readFileSync(path.join(dir, f)), { subset: true });
  const [R, B, I, M] = await Promise.all([load("NotoSans-Regular.ttf"), load("NotoSans-Bold.ttf"), load("NotoSans-Italic.ttf"), load("NotoSansMono-Regular.ttf")]);
  const glyphs = new Set(R.getCharacterSet());
  const clean = (s: string) =>
    [...s.replace(/[ᵢ]/g, "i").replace(/≈/g, "~").replace(/[​﻿]/g, "")]
      .map((ch) => (glyphs.has(ch.codePointAt(0)!) || ch === "\n" ? ch : "?"))
      .join("");
  doc.setTitle(`Boardroom brief — ${b.workspace} — ${b.generatedLabel}`);
  doc.setAuthor("Clutch");
  doc.setSubject("Renewal risk executive summary with source citations");
  doc.setCreator("Clutch boardroom brief");

  const W = 595.28;
  const H = 841.89;
  const M0 = 46;
  const CW = W - M0 * 2;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M0;

  const width = (s: string, f: PDFFont, size: number) => f.widthOfTextAtSize(clean(s), size);
  const wrap = (s: string, f: PDFFont, size: number, maxW: number) => {
    const out: string[] = [];
    for (const para of clean(s).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(t, size) <= maxW) line = t;
        else {
          if (line) out.push(line);
          line = word;
          while (f.widthOfTextAtSize(line, size) > maxW && line.length > 4) {
            let cut = line.length - 1;
            while (cut > 1 && f.widthOfTextAtSize(line.slice(0, cut), size) > maxW) cut--;
            out.push(line.slice(0, cut));
            line = line.slice(cut);
          }
        }
      }
      out.push(line);
    }
    return out;
  };
  const ensure = (h: number) => {
    if (y - h < M0 + 24) {
      page = doc.addPage([W, H]);
      y = H - M0;
    }
  };
  const draw = (s: string, x: number, yy: number, f: PDFFont, size: number, color: RGB = C.text) => page.drawText(clean(s), { x, y: yy, size, font: f, color });
  const para = (s: string, o: { f?: PDFFont; size?: number; color?: RGB; x?: number; w?: number; lh?: number; gap?: number } = {}) => {
    const f = o.f ?? R;
    const size = o.size ?? 9.5;
    const lh = o.lh ?? size * 1.45;
    const x = o.x ?? M0;
    for (const ln of wrap(s, f, size, o.w ?? CW - (x - M0))) {
      ensure(lh);
      draw(ln, x, y - size, f, size, o.color);
      y -= lh;
    }
    y -= o.gap ?? 0;
  };
  const heading = (s: string, n?: string) => {
    ensure(40);
    y -= 10;
    if (n) draw(n, M0, y - 9, M, 8, C.signal);
    draw(s.toUpperCase(), M0 + (n ? 22 : 0), y - 9, B, 9, C.ink);
    y -= 16;
    page.drawLine({ start: { x: M0, y }, end: { x: W - M0, y }, thickness: 0.6, color: C.line });
    y -= 10;
  };

  // ---------- cover band
  page.drawRectangle({ x: 0, y: H - 168, width: W, height: 168, color: C.ink });
  page.drawRectangle({ x: 0, y: H - 171, width: W * 0.38, height: 3, color: C.signal });
  draw("clutch", M0, H - 52, B, 20, C.white);
  page.drawCircle({ x: M0 + width("clutch", B, 20) + 4, y: H - 51, size: 2.6, color: C.signal });
  draw("BOARDROOM BRIEF", W - M0 - width("BOARDROOM BRIEF", M, 8.5), H - 48, M, 8.5, C.faint);
  draw("Renewal risk — executive summary", M0, H - 96, B, 22, C.white);
  draw(`${b.workspace} · ${b.processed.accounts} accounts · generated ${b.generatedLabel} IST`, M0, H - 118, R, 10, rgb(0.8, 0.78, 0.74));
  draw(`Current run: audit #${b.run.auditN} · policies v${b.run.rulesVersion} (${b.run.file}) · ${b.citations.length} cited sources`, M0, H - 134, R, 9, C.faint);
  draw(`fingerprint ${b.fingerprint}`, M0, H - 152, M, 7.5, C.faint);
  y = H - 194;

  // ---------- KPI tiles
  const tiles: [string, string, string, boolean][] = [
    ["ARR at risk", inrCompact(b.impact.arrAtRisk), `${b.impact.atRiskCount} accounts, next 120 days`, true],
    ["Expected loss", inrCompact(b.impact.expectedLoss), "risk × ARR if no action", true],
    ["Renewing in 120 days", inrCompact(b.impact.arrUpForRenewal), `${b.impact.renewalsIn120} renewals`, false],
    ["Open exceptions", String(b.impact.exceptionsOpen), `${b.impact.bySeverity.critical} critical · ${b.impact.bySeverity.high} high`, false],
  ];
  const tw = (CW - 3 * 8) / 4;
  tiles.forEach(([label, value, sub, hot], k) => {
    const x = M0 + k * (tw + 8);
    page.drawRectangle({ x, y: y - 70, width: tw, height: 70, color: hot ? C.signalSoft : C.bone, borderColor: hot ? C.signal : C.line, borderWidth: 0.6 });
    draw(label.toUpperCase(), x + 10, y - 17, M, 6.8, C.grey);
    draw(value, x + 10, y - 44, B, 19, hot ? C.signal : C.ink);
    draw(sub, x + 10, y - 60, R, 7.4, C.grey);
  });
  y -= 84;
  para(
    `Items processed: ${b.processed.total.toLocaleString("en-IN")} records — ${b.processed.contracts} contracts (${b.processed.clauses} clauses), ${b.processed.usageDays.toLocaleString("en-IN")} usage-days, ${b.processed.tickets} tickets, ${b.processed.emails} emails, ${b.processed.invoices} invoices, ${b.processed.contacts} contacts · ${b.processed.checks} policy checks (${b.processed.rules} rules × ${b.processed.accounts} accounts).`,
    { size: 8, color: C.grey, gap: 4 },
  );

  // ---------- summary
  heading("Executive summary");
  para(b.summary.text, { size: 10.5, lh: 15.5, color: C.ink, gap: 4 });
  para(b.summary.model ? `Narrative by ${b.summary.model}; every number verified against the computed figures.` : "Narrative generated from the computed figures.", { f: I, size: 7.5, color: C.faint, gap: 6 });

  // ---------- top 3
  heading(`Top ${b.top3.length} urgent exceptions`);
  for (const t of b.top3) {
    ensure(110);
    page.drawCircle({ x: M0 + 9, y: y - 9, size: 9, color: C.signal });
    draw(String(t.rank), M0 + 9 - width(String(t.rank), B, 10) / 2, y - 12.5, B, 10, C.white);
    draw(t.name, M0 + 26, y - 13, B, 13, C.ink);
    const right = `${inrCompact(t.arr)} ARR · risk ${t.risk}/100`;
    draw(right, W - M0 - width(right, B, 10), y - 12, B, 10, C.signal);
    y -= 26;
    para(`${t.industry} · renews ${t.renewalDate} · notice deadline ${t.noticeBy} (${t.daysToNotice >= 0 ? `in ${t.daysToNotice} days` : "passed"}) · expected loss ${inr(t.expectedLoss)}`, { x: M0 + 26, size: 8.3, color: C.grey, gap: 3 });
    para("Why it is flagged", { x: M0 + 26, f: B, size: 8.3, color: C.ink });
    for (const w of t.why) {
      const cites = w.cites.map((c) => `[${c}]`).join(" ");
      para(`•  ${w.text}  ${cites}`, { x: M0 + 30, size: 8.8 });
    }
    if (t.exceptions.length) {
      y -= 2;
      para("Policy exceptions", { x: M0 + 26, f: B, size: 8.3, color: C.ink });
      for (const e of t.exceptions) para(`•  ${e.ruleId} ${e.ruleName} (${e.severity}) — ${e.message}  ${e.cite.split(",").map((c) => `[${c}]`).join(" ")}`, { x: M0 + 30, size: 8.8 });
    }
    y -= 2;
    para(`Recommended: ${t.recommended}`, { x: M0 + 26, f: B, size: 8.8, color: C.ink });
    para(`Status: ${t.status}`, { x: M0 + 26, size: 8.3, color: C.grey, gap: 8 });
  }

  // ---------- exceptions table
  heading(`All open exceptions (${b.exceptions.length})`);
  const cols = [
    { k: "Severity", w: 52 },
    { k: "Rule", w: 50 },
    { k: "Account", w: 104 },
    { k: "Finding · evidence", w: CW - 52 - 50 - 104 - 36 },
    { k: "Src", w: 36 },
  ];
  const row = (cells: string[], f: PDFFont, size: number, color: RGB, fill?: RGB) => {
    const wrapped = cells.map((c, k) => wrap(c, f, size, cols[k].w - 6));
    const h = Math.max(...wrapped.map((x) => x.length)) * size * 1.35 + 6;
    ensure(h);
    if (fill) page.drawRectangle({ x: M0, y: y - h, width: CW, height: h, color: fill });
    let x = M0;
    wrapped.forEach((lines, k) => {
      lines.forEach((ln, j) => draw(ln, x + 3, y - 4 - size - j * size * 1.35, k === 0 && cells[0].startsWith("critical") ? B : f, size, k === 0 && /critical|high/.test(cells[0]) ? C.signal : color));
      x += cols[k].w;
    });
    y -= h;
    page.drawLine({ start: { x: M0, y }, end: { x: W - M0, y }, thickness: 0.3, color: C.line });
  };
  row(cols.map((c) => c.k), B, 7.5, C.grey, C.bone);
  for (const e of [...b.exceptions].sort((x, z) => sevOrder.indexOf(x.severity) - sevOrder.indexOf(z.severity) || z.arr - x.arr)) {
    row([`${e.severity}${e.status === "new" ? " · new" : ""}`, e.ruleId, `${e.accountName} (${inrCompact(e.arr)})`, `${e.message} — ${e.evidence.map((x) => `${x.field} = ${x.actual}`).join(", ")}`, `[${e.cite}]`], R, 7.6, C.text);
  }

  // ---------- sources
  heading("Sources — exact citations", "§");
  for (const c of b.citations) {
    const lines = 2 + (c.quote ? Math.ceil(width(c.quote, I, 8) / (CW - 40)) : 0);
    ensure(lines * 12 + 8);
    draw(`[${c.id}]`, M0, y - 9, B, 8.5, C.signal);
    draw(KIND_LABEL[c.kind].toUpperCase(), M0 + 34, y - 9, M, 6.8, C.grey);
    y -= 2;
    para(c.source, { x: M0 + 34 + width(KIND_LABEL[c.kind].toUpperCase(), M, 6.8) + 8, f: B, size: 8.3, color: C.ink });
    para(c.detail, { x: M0 + 34, size: 8.3 });
    if (c.quote) para(`“${c.quote}”`, { x: M0 + 34, f: I, size: 8, color: C.grey });
    y -= 5;
  }

  // ---------- method
  heading("Method");
  for (const m of b.method) para(`•  ${m}`, { size: 8, color: C.grey });

  // ---------- footers
  const pages = doc.getPages();
  pages.forEach((p, k) => {
    p.drawLine({ start: { x: M0, y: 32 }, end: { x: W - M0, y: 32 }, thickness: 0.4, color: C.line });
    p.drawText(clean(`Clutch · Boardroom brief · ${b.id} · audit #${b.run.auditN} · fingerprint ${b.fingerprint}`), { x: M0, y: 20, size: 7, font: R, color: C.faint });
    const pn = `${k + 1} / ${pages.length}`;
    p.drawText(pn, { x: W - M0 - R.widthOfTextAtSize(pn, 7), y: 20, size: 7, font: R, color: C.faint });
  });
  return doc.save();
}
