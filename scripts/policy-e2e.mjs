// Zero-code policy hot-swap: file edit, broken edit, API, UI form, audit highlights, deal enforcement.
// usage: node scripts/policy-e2e.mjs [base]   (server must be running; restores config/policies.yaml)
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3210";
const FILE = "config/policies.yaml";
const original = readFileSync(FILE, "utf8");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (p) => (await fetch(base + p, { cache: "no-store" })).json();
const post = async (p, b) => (await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b ?? {}) })).json();
let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
};
const until = async (fn, ms = 4000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const v = await fn();
    if (v) return v;
    await wait(150);
  }
  return null;
};

try {
  await post("/api/reset");
  const v0 = await get("/api/policies");
  ok("rules load from config/policies.yaml", v0.rules.length >= 8 && !v0.error, `v${v0.version}, ${v0.rules.length} rules`);
  await post("/api/audit");

  // 1 — edit the FILE on disk, no UI, no restart
  const t0 = Date.now();
  writeFileSync(
    FILE,
    original +
      `
  - id: FILE-001
    name: Retail account at risk
    category: business
    severity: high
    scope: account
    when: industry == "Retail" && risk >= 30
    message: "{{name}} is at {{risk}} risk — retail board review"
    action: notify
`,
  );
  const v1 = await until(async () => {
    const v = await get("/api/policies");
    return v.rules.some((r) => r.id === "FILE-001") ? v : null;
  });
  ok("file edit on disk hot-reloads (no restart)", !!v1, v1 ? `v${v1.version} live in ${Date.now() - t0} ms, stale=${v1.stale}` : "not picked up");
  ok("change log records the file edit", v1?.changelog[0]?.source === "file" && v1.changelog[0].summary.some((s) => s.includes("FILE-001")));

  const a1 = await post("/api/audit");
  const fresh = a1.audit.exceptions.filter((e) => e.status === "new");
  ok("re-run audit highlights the newly flagged exceptions", fresh.length > 0 && fresh.every((e) => e.ruleId === "FILE-001"), `${fresh.length} new: ${fresh.map((e) => e.accountName).join(", ")}`);
  ok("new exceptions say a rule change caused them", fresh.every((e) => e.why === "rule"));
  ok("notify action fired once", fresh.every((e) => e.actionTaken === "alerted #renewals"));
  const a1b = await post("/api/audit");
  ok("a second re-run marks them open, not new", a1b.audit.counts.new === 0 && a1b.audit.exceptions.some((e) => e.ruleId === "FILE-001" && e.status === "open"));

  // 2 — a broken edit is rejected with line numbers; last good version keeps running
  const goodV = (await get("/api/policies")).version;
  writeFileSync(FILE, original.replace("severity: critical", "severity: critcal").replace("when: arr >= 30L", "when: arrr >= 30L"));
  const bad = await until(async () => {
    const v = await get("/api/policies");
    return v.error ? v : null;
  });
  ok("broken file is rejected with line numbers", !!bad && bad.error.issues.every((i) => i.line), bad ? bad.error.issues.map((i) => `line ${i.line}: ${i.message}`).join(" | ") : "");
  ok("…and the last good rules keep running", bad?.version === goodV && bad.rules.some((r) => r.id === "FILE-001"));
  writeFileSync(FILE, original);
  const back = await until(async () => {
    const v = await get("/api/policies");
    return !v.error && !v.rules.some((r) => r.id === "FILE-001") ? v : null;
  });
  ok("fixing the file restores cleanly", !!back);
  const a2 = await post("/api/audit");
  ok("removed rule's exceptions show as resolved", a2.audit.resolved.some((e) => e.ruleId === "FILE-001"), `${a2.audit.counts.resolved} resolved`);

  // 3 — JSON via API (external config, no UI)
  const j = await (await fetch(`${base}/api/policies/config?format=json`)).json();
  j.rules.push({ id: "API-001", name: "Thin feature adoption", category: "business", severity: "low", scope: "account", when: { all: [{ field: "featureCount", op: "<=", value: 2 }] }, message: "Uses {{featureCount}} core features", action: "flag" });
  const put = await post("/api/policies/config", { text: JSON.stringify(j) });
  ok("JSON config accepted via API", put.ok && put.summary.some((s) => s.includes("API-001")), `v${put.version}`);
  const disk = readFileSync(FILE, "utf8");
  ok("…and written back to disk as readable YAML", /^#/.test(disk) && /\nrules:\n {2}- id: /.test(disk) && disk.includes("API-001"));
  const badJson = await post("/api/policies/config", { text: JSON.stringify({ rules: [{ id: "X", name: "x", when: "risk >>> 3" }] }) });
  ok("bad JSON rule rejected atomically", badJson.ok === false && badJson.issues.length > 0, badJson.issues?.[0]?.message);

  // 4 — dry-run preview
  const pv = await post("/api/policies/preview", { rule: { id: "P", name: "p", when: "upsell >= 60", category: "business" } });
  ok("dry-run preview counts matches without saving", pv.ok && typeof pv.count === "number" && (await get("/api/policies")).rules.every((r) => r.id !== "P"), `${pv.count} would match in ${pv.ms} ms`);

  // 5 — the UI: build a deal rule in the form, save & re-run, see it highlighted, see it enforced
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/app/policies", { waitUntil: "load" });
  await page.waitForSelector("text=Policies & audit");
  await page.getByRole("button", { name: /New rule/ }).first().click();
  await page.getByRole("button", { name: "Open P1 near renewal" }).click();
  await page.getByTestId("rule-name").fill("Open P1 close to renewal (UI)");
  await page.waitForSelector('[data-testid="rule-preview"]', { timeout: 6000 });
  const previewText = await page.getByTestId("rule-preview").innerText();
  ok("UI form shows a live dry-run", /would be flagged/.test(previewText), previewText.split("\n")[0]);
  await page.getByRole("button", { name: "Save & re-run audit" }).click();
  await page.waitForSelector('[data-testid="policy-toast"]', { timeout: 8000 });
  await wait(1200);
  const newRows = await page.locator('[data-testid="exceptions"] li[data-status="new"]').count();
  ok("Save & re-run audit highlights new exceptions in the UI", newRows > 0, `${newRows} rows marked NEW`);
  await page.screenshot({ path: "docs/ui/policy-audit.png" });

  // formula with a typo → precise error, save disabled
  await page.getByRole("button", { name: /New rule/ }).first().click();
  await page.getByRole("button", { name: "formula" }).click();
  await page.getByTestId("rule-formula").fill("industry == 'Healthcare' && discountt > 5");
  await page.waitForSelector('[data-testid="rule-issues"]', { timeout: 5000 });
  const iss = await page.getByTestId("rule-issues").innerText();
  ok("formula typo gets a did-you-mean", /discountPct|only exists on deals/.test(iss), iss.split("\n").slice(1, 3).join(" "));
  await page.keyboard.press("Escape");

  // deal rule through the UI template, then enforced by the deal desk
  await page.getByRole("button", { name: /New rule/ }).first().click();
  await page.getByRole("button", { name: "Industry discount cap" }).click();
  await page.waitForSelector('[data-testid="rule-preview"]', { timeout: 6000 });
  await wait(900);
  await page.screenshot({ path: "docs/ui/policy-editor.png" });
  await page.getByRole("button", { name: "Save & re-run audit" }).click();
  await page.waitForSelector('[data-testid="policy-toast"]', { timeout: 8000 });
  await wait(600);
  const pol = await get("/api/policies");
  const cap = pol.rules.find((r) => r.name === "Healthcare discount cap");
  ok("deal rule saved from the UI into the YAML file", !!cap && readFileSync(FILE, "utf8").includes("Healthcare discount cap"), cap?.id);

  const chat = await post("/api/deal/kestrel-health", { text: "We'll renew if you give us 12% off for 24 months." });
  const log = JSON.stringify(chat.log ?? chat.session?.log ?? chat);
  ok("live deal desk enforces the new rule", /policy [A-Z]+-\d+/.test(log) || /Healthcare discount cap/i.test(log), (log.match(/policy [A-Z]+-\d+[^"]{0,80}/) ?? [""])[0]);

  await page.getByRole("button", { name: /Config file/ }).click();
  await page.waitForSelector('[data-testid="config-editor"]');
  await wait(800);
  await page.screenshot({ path: "docs/ui/policy-config.png" });
  await page.getByRole("button", { name: /^Rules/ }).click();
  await wait(600);
  await page.screenshot({ path: "docs/ui/policy-rules.png", fullPage: true });
  ok("no browser errors", errors.length === 0, errors.join(" | "));
  await browser.close();
} finally {
  writeFileSync(FILE, original);
  await wait(400);
  await post("/api/reset");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
