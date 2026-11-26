// Full workflow test in a real browser. Screenshots → docs/ui/e2e-*.png
// usage: node scripts/e2e.mjs [baseUrl]
import { chromium } from "playwright-core";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3210";
const out = "docs/ui";
mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (p, body) => (await fetch(base + p, body !== undefined ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})).json();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch({ executablePath: chrome });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && errors.push(m.text().slice(0, 160)));
const shot = (n) => page.screenshot({ path: `${out}/e2e-${n}.png` });

await api("/api/reset", {});

// 1. every page renders
const pages = [
  ["command", "/app"], ["renewals", "/app/renewals"], ["accounts", "/app/accounts"], ["account", "/app/accounts/northwind-logistics"],
  ["calls", "/app/calls"], ["deal", "/app/deal/northwind-logistics"], ["mirror", "/app/call/northwind-logistics"], ["radar", "/app/radar"],
  ["analytics", "/app/analytics"], ["playbooks", "/app/playbooks"], ["integrations", "/app/integrations"], ["outbox", "/app/outbox"], ["value", "/value/northwind-logistics"], ["landing", "/"],
];
for (const [n, u] of pages) {
  const before = errors.length;
  await page.goto(base + u, { waitUntil: "load" });
  await wait(1600);
  const clipped = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4);
  await shot(`page-${n}`);
  check(`page ${u}`, errors.length === before && !clipped, clipped ? "horizontal overflow" : errors.slice(before).join(" | "));
}

// 2. Ask Clutch copilot
await page.goto(base + "/app", { waitUntil: "load" });
await wait(1200);
await page.getByRole("button", { name: "Ask Clutch", exact: true }).click();
await page.getByText("Which critical accounts renew in the next 60 days?").click();
await page.waitForFunction(() => [...document.querySelectorAll("aside div")].some((d) => /Northwind/.test(d.textContent ?? "") && !/thinking/.test(d.textContent ?? "")), null, { timeout: 30000 }).catch(() => {});
await wait(800);
await shot("copilot");
const copilotText = await page.locator("aside").last().innerText();
check("copilot answers from live data", /Northwind/i.test(copilotText), copilotText.split("\n").slice(-3).join(" ").slice(0, 140));
await page.keyboard.press("Escape");

// 3. Autopilot
await page.goto(base + "/app", { waitUntil: "load" });
await wait(1000);
await page.getByRole("button", { name: /Run autopilot/ }).click();
await wait(14000);
await shot("autopilot");
const st = await api("/api/state");
check("autopilot starts plays", st.runs.length >= 5, `${st.runs.length} plays, ${st.kpis.renewedCount} renewed`);

// 4. Deal room negotiation via UI (Kestrel → use Orbit to avoid autopilot collisions)
await api("/api/reset", {});
await page.goto(base + "/app/deal/northwind-logistics", { waitUntil: "load" });
await wait(1200);
const say = async (t) => {
  await page.fill('input[placeholder^="Type as the customer"]', t);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.body.innerText.includes("Clutch is typing"), null, { timeout: 30000 }).catch(() => {});
  await wait(900);
};
await say("Hi, what is this about? When does our contract end?");
await say("Exports keep failing and we're looking at Freshdesk. Give us 25% off.");
await say("15% and we sign today.");
let deal = await api("/api/deal/northwind-logistics");
if (deal.session.pendingApproval) {
  await page.getByRole("button", { name: "Approve" }).first().click();
  await wait(2500);
}
await say("Ok, that works. Send it.");
await wait(1500);
await shot("deal-room");
deal = await api("/api/deal/northwind-logistics");
const maxD = Math.max(0, ...deal.session.log.filter((l) => l.result.startsWith("✓")).map((l) => Number(/discount=([\d.]+)/.exec(l.args)?.[1] ?? 0)));
check("deal room: guardrails held (≤15%, >10% only with approval)", maxD <= 0.15 && (maxD <= 0.1 || deal.session.log.some((l) => l.fn === "approve")), `max approved discount ${maxD} · ${deal.session.log.length} offers checked`);
check("deal room: agreed + order form", deal.session.stage === "agreed" && !!deal.offer, deal.session.messages.at(-1)?.text.slice(0, 100));

// 5. Sign on a phone
if (deal.offer) {
  const phone = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
  await phone.goto(`${base}/sign/${deal.offer.id}`, { waitUntil: "load" });
  await phone.locator("canvas").waitFor();
  await wait(1200);
  const signBtn = phone.getByRole("button", { name: /Sign/ });
  for (let attempt = 0; attempt < 4 && (await signBtn.isDisabled()); attempt++) {
    await wait(600);
    const pad = await phone.locator("canvas").boundingBox();
    await phone.mouse.move(pad.x + 30, pad.y + 60);
    await phone.mouse.down();
    for (let i = 0; i < 14; i++) await phone.mouse.move(pad.x + 30 + i * 18, pad.y + 60 + Math.sin(i) * 24, { steps: 3 });
    await phone.mouse.up();
  }
  await phone.getByRole("button", { name: /Sign/ }).click();
  await wait(5000);
  await phone.screenshot({ path: `${out}/e2e-signed-phone.png` });
  const acct = await api("/api/accounts/northwind-logistics");
  check("e-sign → billing → renewed", !!acct.renewed, acct.runs[0]?.steps.map((s) => s.status).join(","));
  await phone.close();
}

// 6. Cancel interceptor
const app = await browser.newPage({ viewport: { width: 1366, height: 800 } });
await app.goto(`${base}/helpdeck/juniper-edu`, { waitUntil: "load" });
await wait(800);
await app.getByRole("button", { name: "Cancel subscription" }).click();
await wait(700);
await app.getByRole("button", { name: "Continue" }).click();
await wait(1000);
await app.getByRole("button", { name: "Accept" }).first().click();
await wait(1400);
await app.screenshot({ path: `${out}/e2e-cancel-saved.png` });
const s2 = await api("/api/state");
check("cancel interceptor saves account", s2.kpis.saves >= 1, `${s2.kpis.saves} saves`);
await app.close();

// 7. Bug radar → file P0
await page.goto(base + "/app/radar", { waitUntil: "load" });
await wait(1000);
const fileBtn = page.getByRole("button", { name: /File P0/ });
if (await fileBtn.count()) {
  await fileBtn.click();
  await wait(1500);
}
const radar = await api("/api/radar");
check("bug radar files P0 with ₹", !!radar.clusters[0].issue, radar.clusters[0].issue ? `#${radar.clusters[0].issue.number} (${radar.clusters[0].title})` : "");
await page.getByRole("button", { name: /Fix shipped/ }).click();
await wait(3000);
const after = await api("/api/radar");
const closed = after.resolved.at(-1);
check("fix shipped → customers told + risk re-scored", !!closed?.notified?.length && closed.notified.every((n) => n.after <= n.before), closed ? `${closed.notified.length} customers emailed` : "");
const ob = await api("/api/outbox");
check("outbox records what Clutch produced", ob.artifacts.length >= 10, `${ob.artifacts.length} artifacts · ${[...new Set(ob.artifacts.map((a) => a.kind))].join(", ")}`);
const pv = await api("/api/plays/preview?accountId=kestrel-health&play=champion");
check("play preview is personalised", pv.steps?.length === 4 && /Farah|Kavya|Siddharth/.test(JSON.stringify(pv.steps)), pv.steps?.[0]?.detail?.slice(0, 90));
const br = await api("/api/brief");
check("morning brief from live data", br.items?.length > 0 && br.text.includes("Good morning"), br.text.slice(0, 90));

// 7b. Inbox agent, contracts, settings, call summary
const ib = await api("/api/inbox");
const kestrelReply = ib.replies.find((r) => r.accountId === "kestrel-health");
const handled = (await api(`/api/inbox/replies/${kestrelReply.id}`, {})).reply;
check("inbox agent: contact change understood + acted", handled?.triage?.intent === "contact_change" && handled.triage.actions.some((a) => /champion/i.test(a)), `${handled?.triage?.intent} · ${handled?.triage?.model} · ${handled?.triage?.actions?.[0]}`);
const typed = (await api("/api/inbox/replies", { accountId: "dune-pharma", body: "Hi, can we add 5 more seats at renewal?" })).reply;
const t2 = (await api(`/api/inbox/replies/${typed.id}`, {})).reply;
check("inbox agent: typed change request re-quotes in policy", t2?.triage?.intent === "change_request" && t2.triage.actions.some((a) => /Re-priced/.test(a)), t2?.triage?.actions?.[0]);
const ct = await api("/api/contracts");
const ex = await api("/api/contracts/extract", { text: ct.sample });
check("contract reader extracts renewal mechanics", ex.extracted?.noticeDays === 60 && ex.extracted?.upliftPct === 8 && ex.extracted?.autoRenew === true, `${ex.model} · ${ex.extracted?.customer} · notice by ${ex.noticeBy}`);
const imp = await api("/api/contracts/import", { extracted: ex.extracted });
const impAcct = await api(`/api/accounts/${imp.id}`);
check("imported contract becomes a scored account", !!impAcct?.health?.risk || impAcct?.health?.risk === 0, `${imp.id} · risk ${impAcct?.health?.risk}`);
await api("/api/settings", { maxDiscount: 0.12 });
const guard = await api("/api/settings");
await api("/api/settings", { maxDiscount: 0.15 });
check("settings move the deal-desk guardrail", guard.policy.maxDiscount === 0.12, `max → ${guard.policy.maxDiscount}`);
const sum = await api("/api/deal/northwind-logistics/summary", {});
check("chat summary logged to CRM", !!sum.summary?.outcome, `${sum.summary?.model} · ${sum.summary?.outcome}`);
for (const u of ["/app/inbox", "/app/contracts", "/app/settings"]) {
  const before = errors.length;
  await page.goto(base + u, { waitUntil: "load" });
  await wait(1400);
  check(`page ${u}`, errors.length === before, errors.slice(before).join(" | "));
}

// 8. Phone call with fake microphone (real VAD + STT + agent + TTS)
const mic = await chromium.launch({
  executablePath: chrome,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${resolve("scripts/.voice-test/customer.wav")}`, "--autoplay-policy=no-user-gesture-required"],
});
const mctx = await mic.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, permissions: ["microphone"], isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
await mp.goto(`${base}/call/kestrel-health`, { waitUntil: "load" });
await wait(1200);
await mp.getByText("Accept").click();
await wait(40000);
await mp.screenshot({ path: `${out}/e2e-phone-call.png` });
const call = await api("/api/deal/kestrel-health");
const turns = call.session.messages.filter((m) => m.who === "customer");
check("voice call: heard customer + replied", turns.length >= 1 && call.session.messages.at(-1).who !== "customer", turns.map((t) => t.text).join(" / ").slice(0, 120));
await mic.close();

// 9. Final command center
await page.goto(base + "/app", { waitUntil: "load" });
await wait(1500);
await shot("final-command");

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
if (errors.length) console.log("browser errors:", [...new Set(errors)].slice(0, 6));
await browser.close();
