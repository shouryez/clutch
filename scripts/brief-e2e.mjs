// One-click boardroom brief: content, citations, all three formats, live recompile, and the UI buttons.
// usage: node scripts/brief-e2e.mjs [base]   (writes sample exports to docs/brief/)
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3210";
const get = async (p) => (await fetch(base + p, { cache: "no-store" })).json();
const post = async (p, b) => (await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b ?? {}) })).json();
let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
};
mkdirSync("docs/brief", { recursive: true });

try {
  await post("/api/reset");
  const t0 = Date.now();
  const b = await post("/api/boardroom");
  ok("compiles the current run", !!b.id && b.run.auditN >= 1, `${b.id} · audit #${b.run.auditN} · ${Date.now() - t0} ms`);
  ok("total items processed", b.processed.total > 1000 && b.processed.accounts === 60, `${b.processed.total} records · ${b.processed.checks} policy checks`);
  ok("quantified financial impact", b.impact.arrAtRisk > 0 && b.impact.expectedLoss > 0, `at risk ₹${(b.impact.arrAtRisk / 1e7).toFixed(2)} Cr · expected loss ₹${(b.impact.expectedLoss / 1e7).toFixed(2)} Cr`);
  ok("top three urgent exceptions", b.top3.length === 3, b.top3.map((t) => `${t.rank}. ${t.name} (risk ${t.risk})`).join(" · "));
  const ids = new Set(b.citations.map((c) => c.id));
  const allCites = b.top3.flatMap((t) => [...t.why.flatMap((w) => w.cites), ...t.exceptions.flatMap((e) => e.cite.split(","))]);
  ok("every top-3 reason carries a citation", b.top3.every((t) => t.why.every((w) => w.cites.length > 0)));
  ok("every citation resolves to a source", allCites.every((c) => ids.has(c)), `${allCites.length} links → ${b.citations.length} sources`);
  const kinds = new Set(b.citations.map((c) => c.kind));
  ok("citations cover clause, metric, CRM, ticket/email, rule and log", ["clause", "metric", "contact", "rule", "log"].every((k) => kinds.has(k)) && (kinds.has("ticket") || kinds.has("email")), [...kinds].join(", "));
  const clause = b.citations.find((c) => c.kind === "clause");
  ok("clause citations quote the contract with clause + page", !!clause?.quote && /Clause [\d.]+ · page \d/.test(clause.source), clause?.source);
  const rule = b.citations.find((c) => c.kind === "rule");
  ok("rule citations point at the YAML line", /config\/policies\.yaml line \d+/.test(rule?.source ?? ""), rule?.source);
  ok("every open exception is cited", b.exceptions.every((e) => ids.has(e.cite)), `${b.exceptions.length} exceptions`);
  ok("narrative is grounded", b.summary.grounded && b.summary.text.length > 80, b.summary.model ?? "template");

  // formats
  const pdf = await fetch(`${base}/api/boardroom/export?format=pdf`);
  const pbuf = Buffer.from(await pdf.arrayBuffer());
  ok("PDF export", pdf.headers.get("content-type") === "application/pdf" && pbuf.subarray(0, 5).toString() === "%PDF-" && pbuf.length > 20000, `${Math.round(pbuf.length / 1024)} KB · ${/attachment; filename="([^"]+)"/.exec(pdf.headers.get("content-disposition") ?? "")?.[1]}`);
  writeFileSync("docs/brief/sample-brief.pdf", pbuf);
  const md = await (await fetch(`${base}/api/boardroom/export?format=md`)).text();
  ok("Markdown export", md.startsWith("# Boardroom brief") && md.includes("## Top 3 urgent exceptions") && md.includes("## Sources") && /\[S1\]/.test(md));
  writeFileSync("docs/brief/sample-brief.md", md);
  const csv = await (await fetch(`${base}/api/boardroom/export?format=csv`)).text();
  const head = csv.replace(/^\uFEFF/, "").split("\r\n")[0];
  ok("CSV export", head.includes("citation_source") && csv.includes("urgent") && csv.includes("exception"), `${csv.split("\r\n").length - 1} rows`);
  writeFileSync("docs/brief/sample-brief.csv", csv);
  ok("all three formats come from the same brief", pdf.headers.get("x-brief-id") === b.id);

  // live: change a rule → recompile → the brief reflects the new run
  await post("/api/policies", { action: "upsert", rule: { id: "BRF-001", name: "Any account above 60 risk", category: "business", severity: "critical", scope: "account", when: "risk >= 60 && !renewed", message: "{{name}} at risk {{risk}}", action: "flag" } });
  const b2 = await post("/api/boardroom");
  ok("recompile picks up a rule change (auto re-audit)", b2.run.auditN > b.run.auditN && b2.exceptions.some((e) => e.ruleId === "BRF-001") && b2.fingerprint !== b.fingerprint, `audit #${b.run.auditN} → #${b2.run.auditN}, +${b2.exceptions.filter((e) => e.ruleId === "BRF-001").length} BRF-001`);
  await post("/api/policies", { action: "delete", id: "BRF-001" });

  // UI
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/app", { waitUntil: "load" });
  await page.waitForSelector('[data-testid="export-brief"]', { timeout: 8000 });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.getByTestId("export-brief").click()]);
  ok("one click on the command center downloads the PDF", /\.pdf$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  await page.goto(base + "/app/brief", { waitUntil: "load" });
  await page.waitForSelector('[data-testid="brief-paper"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: "docs/ui/brief-page.png" });
  await page.locator('[data-testid="urgent"] button', { hasText: /^S\d+$/ }).first().click();
  await page.waitForTimeout(700);
  const lit = await page.locator('[data-testid="source"].bg-\\[\\#ffe3d8\\]').count();
  ok("clicking a citation jumps to its source", lit === 1);
  await page.screenshot({ path: "docs/ui/brief-sources.png" });
  const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.getByRole("button", { name: /^CSV$/ }).click()]);
  ok("brief page exports CSV", /\.csv$/.test(dl2.suggestedFilename()), dl2.suggestedFilename());
  ok("no browser errors", errors.length === 0, errors.join(" | "));
  await browser.close();
} finally {
  await post("/api/reset");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
