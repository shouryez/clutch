// Screens for the v3 product pass → docs/ui/v3-*.png
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3210";
const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (p, body) => (await fetch(base + p, body !== undefined ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})).json();

const browser = await chromium.launch({ executablePath: chrome });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && errors.push(m.text().slice(0, 200)));
const shot = async (n, full = false) => page.screenshot({ path: `docs/ui/v3-${n}.png`, fullPage: full });
const go = async (u, ms = 1500) => {
  await page.goto(base + u, { waitUntil: "load" });
  await wait(ms);
};

await api("/api/reset", {});
await go("/app", 2200);
await shot("command", true);
await page.getByRole("button", { name: /Competitor save/ }).first().click();
await wait(1500);
await shot("preview");
await page.keyboard.press("Escape");

// run a touchless play on a healthy account and watch artifacts
await api("/api/plays", { accountId: "saffron-logistics", play: "touchless", autoSign: true });
await api("/api/plays", { accountId: "kestrel-health", play: "champion" });
await wait(12000);
await go("/app/accounts/saffron-logistics", 2000);
const peek = page.getByRole("button", { name: /view email/ }).first();
if (await peek.count()) await peek.click();
await wait(800);
await shot("account-renewed", true);
await go("/app/accounts/northwind-logistics", 1800);
await shot("account", true);

for (const [n, u] of [
  ["renewals", "/app/renewals"],
  ["accounts", "/app/accounts"],
  ["playbooks", "/app/playbooks"],
  ["integrations", "/app/integrations"],
  ["analytics", "/app/analytics"],
  ["outbox", "/app/outbox"],
  ["calls", "/app/calls"],
  ["deal", "/app/deal/northwind-logistics"],
  ["mirror", "/app/call/northwind-logistics"],
]) {
  await go(u);
  const clipped = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4);
  if (clipped) errors.push(`horizontal overflow on ${u}`);
  await shot(n, true);
}

await go("/app/radar");
await page.getByRole("button", { name: /Preview the issue/ }).click();
await wait(700);
await shot("radar", true);
await page.getByRole("button", { name: /File P0/ }).click();
await wait(1500);
await page.getByRole("button", { name: /Fix shipped/ }).click();
await wait(3500);
await shot("radar-closed", true);

await go("/app", 2000);
await shot("command-after", true);

const phone = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
await phone.goto(base + "/value/northwind-logistics", { waitUntil: "load" });
await wait(1600);
await phone.screenshot({ path: "docs/ui/v3-value-phone.png", fullPage: true });

const brief = await api("/api/brief");
console.log("brief:", brief.text.slice(0, 200));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no browser errors");
await browser.close();
