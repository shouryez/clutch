/**
 * In-memory world, kept on globalThis so it survives hot reloads.
 * The demo runs on one laptop; persistence is deliberately out of scope.
 */
import { computeHealth } from "./risk";
import { seedWorld } from "./seed";
import type { DealSession } from "./negotiator";
import type { SaveRecord } from "./retention";
import { seedReplies, type Reply } from "./replies-seed";
import { applyPolicy, defaultSettings, type Settings } from "./settings";
import type { Account, AccountSummary, Artifact, FeedEvent, Health, Offer, PlayKey, PlayRun } from "./types";

export type Issue = {
  number: number;
  topic: string;
  title: string;
  arr: number;
  accounts: string[];
  url: string;
  at: number;
  mode: "live" | "mock";
  body: string;
  fixedAt?: number;
  notified?: { id: string; name: string; contact: string; before: number; after: number }[];
};

type Store = {
  accounts: Account[];
  health: Map<string, Health>;
  runs: PlayRun[];
  offers: Offer[];
  feed: FeedEvent[];
  renewed: Map<string, { offerId: string; touchless: boolean; at: number; due: number }>;
  issues: Issue[];
  artifacts: Artifact[];
  settings: Settings;
  replies: Reply[];
  suggestions: { id: string; accountId: string; play: PlayKey; at: number; reason: string }[];
  listeners: Set<(e: FeedEvent) => void>;
  waiters: Map<string, (value: string) => void>; // key -> resolver (signatures, manual advances)
  deals: Map<string, DealSession>;
  saves: SaveRecord[];
  churned: Map<string, { reason: string; at: number }>;
  seq: number;
};

const g = globalThis as unknown as { __clutch?: Store };

function init(): Store {
  const accounts = seedWorld();
  const health = new Map(accounts.map((a) => [a.id, computeHealth(a)]));
  const s: Store = {
    accounts,
    health,
    runs: [],
    offers: [],
    feed: [],
    renewed: new Map(),
    issues: [],
    artifacts: [],
    settings: defaultSettings(),
    replies: seedReplies(accounts, Date.now()),
    suggestions: [],
    listeners: new Set(),
    waiters: new Map(),
    deals: new Map(),
    saves: [],
    churned: new Map(),
    seq: 0,
  };
  applyPolicy(s.settings);
  const now = Date.now();
  const critical = accounts.filter((a) => health.get(a.id)!.tier === "critical");
  s.feed.push(
    { id: "boot-3", at: now - 60_000, kind: "signal", title: `${critical.length} accounts crossed the critical line`, detail: critical.map((a) => a.name).join(" · "), tone: "risk" },
    { id: "boot-2", at: now - 240_000, kind: "system", title: "Parsed 60 contracts", detail: "renewal dates, notice periods and uplift clauses extracted", tone: "neutral" },
    { id: "boot-1", at: now - 300_000, kind: "system", title: "Nightly scan complete", detail: "60 accounts · 10,800 usage days · tickets, emails, invoices", tone: "neutral" },
  );
  return s;
}

export function store(): Store {
  if (!g.__clutch) g.__clutch = init();
  return g.__clutch;
}

export function resetStore() {
  const old = g.__clutch;
  g.__clutch = init();
  // keep live SSE subscribers attached across resets
  if (old) for (const l of old.listeners) g.__clutch.listeners.add(l);
  emit({ kind: "system", title: "Demo reset", detail: "world re-seeded", tone: "neutral" });
}

export function uid(prefix: string) {
  const s = store();
  s.seq += 1;
  return `${prefix}_${Date.now().toString(36)}${s.seq.toString(36)}`;
}

export function emit(e: Omit<FeedEvent, "id" | "at">) {
  const s = store();
  const ev: FeedEvent = { id: uid("ev"), at: Date.now(), ...e };
  s.feed.unshift(ev);
  if (s.feed.length > 300) s.feed.length = 300;
  for (const l of s.listeners) {
    try {
      l(ev);
    } catch {
      /* listener gone */
    }
  }
  return ev;
}

/** Live UI nudge that is NOT written to the activity feed (agent trace lines, progress). */
export function pulse(accountId?: string, detail?: string) {
  const ev: FeedEvent = { id: uid("tr"), at: Date.now(), kind: "trace", accountId, title: "trace", detail, tone: "neutral" };
  for (const l of store().listeners) {
    try {
      l(ev);
    } catch {
      /* listener gone */
    }
  }
}

export function subscribe(fn: (e: FeedEvent) => void) {
  const s = store();
  s.listeners.add(fn);
  return () => {
    store().listeners.delete(fn);
  };
}

export function getAccount(id: string) {
  return store().accounts.find((a) => a.id === id);
}

export function getHealth(id: string) {
  return store().health.get(id)!;
}

export function recompute(id: string) {
  const a = getAccount(id);
  if (!a) return;
  const h = computeHealth(a);
  if (store().renewed.has(id)) {
    // signed: the renewal risk is retired; keep watching the residual signals
    const residual = [...h.signals].sort((x, y) => y.contribution - x.contribution).filter((s) => s.value > 0.3)[0];
    h.risk = Math.min(h.risk, Math.round(h.risk * 0.2));
    h.tier = "healthy";
    h.cause = "touchless";
    h.why = `Renewed through ${a.contract.end}.${residual ? ` Still watching: ${residual.evidence}.` : ""}`;
  }
  store().health.set(id, h);
}

export function summaries(): AccountSummary[] {
  const s = store();
  return s.accounts.map((a) => {
    const run = [...s.runs].reverse().find((r) => r.accountId === a.id);
    return {
      id: a.id,
      name: a.name,
      industry: a.industry,
      plan: a.plan,
      seats: a.seats,
      arr: a.arr,
      story: a.story,
      renewalDate: a.contract.end,
      health: s.health.get(a.id)!,
      champion: a.contacts.find((c) => c.isChampion)?.name,
      activeRun: run
        ? {
            id: run.id,
            play: run.play,
            status: run.status,
            step: (run.steps.find((x) => x.status === "running" || x.status === "waiting") ?? run.steps.findLast((x) => x.status === "done"))?.label ?? "",
            done: run.steps.filter((x) => x.status === "done").length,
            total: run.steps.length,
          }
        : undefined,
      renewed: s.renewed.has(a.id),
      renewedDue: s.renewed.get(a.id)?.due,
    };
  });
}

/** Wait for an external event (customer signature, manual "continue"). */
export function waitFor(key: string) {
  return new Promise<string>((resolve) => store().waiters.set(key, resolve));
}
export function resolveWait(key: string, value: string) {
  const w = store().waiters.get(key);
  if (!w) return false;
  store().waiters.delete(key);
  w(value);
  return true;
}

/** Keep a record of what Clutch produced, so every automated step can be opened and read. */
export function record(a: Omit<Artifact, "id" | "at">) {
  const art: Artifact = { id: uid("art"), at: Date.now(), ...a };
  store().artifacts.unshift(art);
  if (store().artifacts.length > 400) store().artifacts.length = 400;
  return art;
}
