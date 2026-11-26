// Drives deal room, phone call, call mirror and the cancel interceptor; screenshots into docs/ui.
// usage: node scripts/shoot-phase2.mjs [baseUrl]
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3210";
const out = "docs/ui";
const chromePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, body) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) }).then((r) => r.json());

const browser = await chromium.launch({ executablePath: chromePath, args: ["--use-fake-ui-for-media-stream"] });
const errors = [];
const watch = (p, tag) => {
  p.on("pageerror", (e) => errors.push(`${tag} pageerror: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${tag} console: ${m.text().slice(0, 200)}`));
};

await api("/api/reset");

/* ---- deal room ---- */
const desk = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
watch(desk, "desk");
await desk.goto(`${base}/app/deal/northwind-logistics`, { waitUntil: "load", timeout: 90000 });
await wait(1200);
const sendChat = async (t) => {
  await desk.fill('input[placeholder^="Type as the customer"]', t);
  await desk.keyboard.press("Enter");
  await wait(1300);
};
await sendChat("We're looking at Freshdesk. Exports keep failing.");
await sendChat("Give us 25% off or we leave.");
await sendChat("Nahi yaar, 15 percent karo na.");
await sendChat("Still too much. 12 and we sign.");
await wait(800);
await desk.screenshot({ path: `${out}/16-deal-room-approval.png` });
console.log("shot 16");
const approve = desk.getByRole("button", { name: "Approve" });
if (await approve.count()) {
  await approve.first().click();
  await wait(1500);
}
await sendChat("Theek hai, bhejo.");
await wait(1500);
await desk.screenshot({ path: `${out}/17-deal-room-agreed.png` });
console.log("shot 17");

/* ---- phone + mirror ---- */
await api("/api/reset");
await desk.goto(`${base}/app/call/northwind-logistics`, { waitUntil: "load", timeout: 90000 });
const phone = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
watch(phone, "phone");
await phone.goto(`${base}/call/northwind-logistics`, { waitUntil: "load", timeout: 90000 });
await wait(900);
await phone.screenshot({ path: `${out}/18-phone-ringing.png` });
console.log("shot 18");
await phone.getByText("Accept").click();
await wait(2500);
await phone.getByText("type", { exact: true }).click().catch(() => {});
const sendVoice = async (t) => {
  const box = phone.locator("input").first();
  await box.fill(t);
  await box.press("Enter");
  await wait(1800);
};
await sendVoice("Haan bolo. Exports bahut fail ho rahe hain, hum Freshdesk dekh rahe hain.");
await sendVoice("Fine, lekin 25% discount do warna mushkil hai.");
await wait(1200);
await phone.screenshot({ path: `${out}/19-phone-in-call.png` });
console.log("shot 19");
await wait(1500);
await desk.screenshot({ path: `${out}/20-call-mirror.png` });
console.log("shot 20");

/* ---- cancel interceptor ---- */
const app = await browser.newPage({ viewport: { width: 1440, height: 900 } });
watch(app, "helpdeck");
await app.goto(`${base}/helpdeck/juniper-edu`, { waitUntil: "load", timeout: 90000 });
await wait(800);
await app.screenshot({ path: `${out}/21-helpdeck-billing.png` });
console.log("shot 21");
await app.getByRole("button", { name: "Cancel subscription" }).click();
await wait(900);
await app.screenshot({ path: `${out}/22-cancel-why.png` });
console.log("shot 22");
await app.getByRole("button", { name: "Continue" }).click();
await wait(1100);
await app.screenshot({ path: `${out}/23-cancel-offers.png` });
console.log("shot 23");
await app.getByRole("button", { name: "Accept" }).first().click();
await wait(1400);
await app.screenshot({ path: `${out}/24-cancel-saved.png` });
console.log("shot 24");

await desk.goto(`${base}/app`, { waitUntil: "load", timeout: 90000 });
await wait(1500);
await desk.screenshot({ path: `${out}/25-command-after-save.png` });
console.log("shot 25");

console.log(errors.length ? errors.join("\n") : "no browser errors");
await browser.close();
