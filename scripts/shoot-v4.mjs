// Product shots for the landing page (public/shots) + v4 review screens (docs/ui/v4-*)
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
const go = async (u, ms = 1800) => {
  await page.goto(base + u, { waitUntil: "load" });
  await wait(ms);
};

const landingOnly = process.argv.includes("--landing");
if (!landingOnly) {
await api("/api/reset", {});
// a little life in the world for the shots
const inbox = await api("/api/inbox");
await api(`/api/inbox/replies/${inbox.replies[0].id}`, {});

await go("/app", 2400);
await page.screenshot({ path: "public/shots/command.png" });
await go("/app/accounts/northwind-logistics");
await page.screenshot({ path: "public/shots/account.png" });
await go("/app/inbox");
await page.screenshot({ path: "public/shots/inbox.png" });
await go("/app/radar");
await page.screenshot({ path: "public/shots/radar.png" });
}

if (process.argv.includes("--review") || landingOnly) {
  if (!landingOnly) {
  for (const [n, u] of [
    ["inbox", "/app/inbox"],
    ["contracts", "/app/contracts"],
    ["settings", "/app/settings"],
    ["command", "/app"],
  ]) {
    await go(u);
    await page.screenshot({ path: `docs/ui/v4-${n}.png`, fullPage: n !== "command" });
  }
  await go("/app/contracts");
  await page.getByRole("button", { name: /Read a contract/ }).click();
  await wait(500);
  await page.getByText("use a sample MSA").click();
  await page.getByRole("button", { name: /Read contract/ }).click();
  await page.waitForSelector("text=What Clutch extracted", { timeout: 5000 });
  await wait(6000);
  await page.screenshot({ path: "docs/ui/v4-contract-read.png", fullPage: true });
  }
  await go("/", 2500);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0;
  for (let y = 0; y < H && i < 26; y += 900, i++) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await wait(900);
    await page.screenshot({ path: `docs/ui/v4-landing-${String(i).padStart(2, "0")}.png` });
  }
  console.log("landing frames:", i, "height", H);
}
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no browser errors");
await browser.close();
