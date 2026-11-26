// Renders UI previews into docs/ui using the locally installed Chrome.
// usage: node scripts/shoot.mjs [baseUrl]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3210";
const out = "docs/ui";
mkdirSync(out, { recursive: true });

const chromePath =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ executablePath: chromePath });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 }, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(2600);

// [file, sectionIndex, progress through the section (0..1 of its scrollable length), extra px]
const shots = [
  ["01-hero", 0, 0, 0],
  ["02-timeline", 2, 0.5, 0],
  ["03-agents", 3, 0, 1400],
  ["04-call", 4, 0.8, 0],
  ["05-negotiation", 5, 0, 420],
  ["06-touchless", 6, 0.92, 0],
  ["07-bug-radar", 7, 0, 60],
  ["08-cta", 9, 1, 0],
];

for (const [name, idx, prog, extra] of shots) {
  const y = await page.evaluate(
    ([idx, prog, extra]) => {
      const s = document.querySelectorAll("main > section")[idx];
      const top = s.getBoundingClientRect().top + window.scrollY;
      const len = Math.max(0, s.offsetHeight - window.innerHeight);
      return top + len * prog + extra;
    },
    [idx, prog, extra],
  );
  // walk there in steps so scroll-linked + in-view animations fire
  const from = await page.evaluate(() => window.scrollY);
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((v) => window.scrollTo(0, v), from + ((y - from) * i) / steps);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1900);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("shot", name);
}

await browser.close();
