/**
 * Every external integration sits behind one function with a mock fallback,
 * so the demo never dies because one API key is missing or one service is down.
 * Each returns { mode } so the UI can show LIVE vs SIMULATED honestly.
 */
import { inr } from "./format";

export type Mode = "live" | "mock";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function integrationStatus() {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    slack: !!process.env.SLACK_WEBHOOK_URL,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    documenso: !!process.env.DOCUMENSO_API_KEY,
    email: !!process.env.RESEND_API_KEY,
    github: !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
    sarvam: !!process.env.SARVAM_API_KEY,
  };
}

export async function slackPost(text: string): Promise<{ mode: Mode }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    await sleep(250);
    return { mode: "mock" };
  }
  try {
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    return { mode: "live" };
  } catch {
    return { mode: "mock" };
  }
}

export async function sendEmail(msg: { to: string[]; subject: string; body: string }): Promise<{ mode: Mode; id: string }> {
  // plays draft emails continuously; only send them for real when explicitly switched on (the Send buttons always send)
  const key = process.env.AUTO_SEND_EMAILS === "1" ? process.env.RESEND_API_KEY : undefined;
  const from = process.env.EMAIL_FROM ?? "Clutch <renewals@clutch.dev>";
  if (key) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: process.env.DEMO_EMAIL_TO ? [process.env.DEMO_EMAIL_TO] : msg.to, subject: msg.subject, text: msg.body }),
      });
      const j = (await r.json()) as { id?: string };
      if (r.ok && j.id) return { mode: "live", id: j.id };
    } catch {
      /* fall through to mock */
    }
  }
  await sleep(400);
  return { mode: "mock", id: `msg_${Math.random().toString(36).slice(2, 10)}` };
}

export async function updateSubscription(sub: { id: string; annual: number; termMonths: number; seats: number }): Promise<{ mode: Mode; detail: string }> {
  // Real Stripe wiring lands when STRIPE_SECRET_KEY is set (test mode).
  await sleep(500);
  return { mode: "mock", detail: `${sub.id} → ${sub.seats} seats · ${inr(sub.annual)}/yr · ${sub.termMonths} mo` };
}

export async function createIssue(issue: { title: string; body: string; labels: string[] }): Promise<{ mode: Mode; number: number; url: string }> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/name"
  if (token && repo) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" },
        body: JSON.stringify(issue),
      });
      const j = (await r.json()) as { number?: number; html_url?: string };
      if (r.ok && j.number) return { mode: "live", number: j.number, url: j.html_url! };
    } catch {
      /* fall through */
    }
  }
  await sleep(450);
  const number = 412 + Math.floor(Math.random() * 3);
  return { mode: "mock", number, url: `https://github.com/helpdeck/core/issues/${number}` };
}

export async function bookMeeting(m: { with: string; title: string }): Promise<{ mode: Mode; when: string }> {
  await sleep(350);
  const d = new Date(Date.now() + 3 * 86_400_000);
  d.setHours(11, 30, 0, 0);
  return { mode: "mock", when: `${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, 11:30 with ${m.with}` };
}

/** Cached competitor pricing (Browser Use replaces this with a live page read). */
export async function competitorPricing(name: string): Promise<{ mode: Mode; perSeatMonth: number; plan: string; source: string }> {
  await sleep(900);
  const table: Record<string, { perSeatMonth: number; plan: string }> = {
    freshdesk: { perSeatMonth: 7000, plan: "Pro (annual, INR estimate)" },
  };
  const hit = table[name.toLowerCase()] ?? { perSeatMonth: 7500, plan: "comparable tier" };
  return { mode: "mock", ...hit, source: "cached snapshot · live browser read when enabled" };
}
