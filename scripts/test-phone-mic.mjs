// Real-browser test of the phone call page with a FAKE MICROPHONE.
// Chrome plays scripts/.voice-test/customer.wav into getUserMedia, exactly like a person talking:
// VAD → MediaRecorder → /api/voice/turn (Sarvam STT → agent → Sarvam TTS) → audio playback.
// usage: node scripts/test-phone-mic.mjs [baseUrl]
import { chromium } from "playwright-core";
import { resolve } from "node:path";

const base = process.argv[2] ?? "http://localhost:3210";
const wav = resolve("scripts/.voice-test/customer.wav");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`, "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, permissions: ["microphone"], isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const log = [];
page.on("console", (m) => log.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => log.push(`pageerror: ${e.message}`));
page.on("response", async (r) => {
  if (r.url().includes("/api/voice/")) {
    let extra = "";
    try {
      const j = await r.json();
      extra = j.heard !== undefined ? ` heard="${j.heard}"` : "";
      if (j.timing) extra += ` timing=${JSON.stringify(j.timing)}`;
      if (j.audios) extra += ` audios=${j.audios.length}`;
    } catch {}
    console.log(`  ${r.status()} ${new URL(r.url()).pathname}${extra}`);
  }
});

await fetch(base + "/api/reset", { method: "POST" });
await page.goto(`${base}/call/northwind-logistics`, { waitUntil: "load" });
await page.waitForTimeout(1500);
console.log("tap Accept…");
await page.getByText("Accept").click();
// let a couple of conversational turns happen
await page.waitForTimeout(45000);
await page.screenshot({ path: "docs/ui/26-phone-real-mic.png" });

const deal = await (await fetch(`${base}/api/deal/northwind-logistics`)).json();
console.log("\nTRANSCRIPT (server):");
for (const m of deal.session.messages) console.log(`  ${m.who.padEnd(8)} ${m.text}`);
const errs = log.filter((l) => l.startsWith("error") || l.startsWith("pageerror"));
console.log(errs.length ? "\nBROWSER ERRORS:\n" + errs.join("\n") : "\nno browser errors");
await browser.close();
