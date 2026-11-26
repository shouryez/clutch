// Drives the app through a mini demo and screenshots each screen into docs/ui.
// usage: node scripts/shoot-app.mjs [baseUrl]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3210";
const out = "docs/ui";
mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const api = (p, body) =>
  fetch(base + p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: chromePath });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const shot = async (name, full = false) => {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  console.log("shot", name);
};

await api("/api/reset", {});
await page.goto(base + "/app", { waitUntil: "networkidle" });
await wait(2200);
await shot("09-command-center");

await page.goto(base + "/app/accounts/northwind-logistics", { waitUntil: "networkidle" });
await wait(2200);
await shot("10-account-northwind");

// a touchless renewal that waits for a real signature
await api("/api/plays", { accountId: "meridian-labs", play: "touchless", autoSign: false });
await page.goto(base + "/app/accounts/meridian-labs", { waitUntil: "networkidle" });
await wait(6500);
await shot("11-play-waiting-signature");

const acct = await api("/api/accounts/meridian-labs");
const offerId = acct.offers[0]?.id;
const phone = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
await phone.goto(`${base}/sign/${offerId}`, { waitUntil: "networkidle" });
await wait(800);
await phone.screenshot({ path: `${out}/12-sign-phone.png` });
console.log("shot 12-sign-phone");

await api(`/api/offers/${offerId}/sign`, { name: "Isha Verma" });
await wait(4500);
await shot("13-play-renewed");

await page.goto(base + "/app", { waitUntil: "networkidle" });
await wait(2200);
await shot("14-command-center-after");

await page.goto(base + "/app/radar", { waitUntil: "networkidle" });
await wait(1800);
await shot("15-radar");

await browser.close();
