"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { FeedEvent } from "@/lib/types";

type LiveCtx = { version: number; last: FeedEvent | null; connected: boolean; events: FeedEvent[] };
const Ctx = createContext<LiveCtx>({ version: 0, last: null, connected: false, events: [] });

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveCtx>({ version: 0, last: null, connected: false, events: [] });
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setState((s) => ({ ...s, connected: true }));
    es.onerror = () => setState((s) => ({ ...s, connected: false }));
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as FeedEvent;
      // trace pulses refresh the views but never enter the activity feed
      if (ev.kind === "trace") setState((s) => ({ ...s, version: s.version + 1, connected: true }));
      else setState((s) => ({ version: s.version + 1, last: ev, connected: true, events: [ev, ...s.events].slice(0, 100) }));
    };
    return () => es.close();
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useLive = () => useContext(Ctx);

/** Fetch JSON and refetch (throttled) whenever a live event arrives. */
export function useApi<T>(url: string | null) {
  const { version } = useLive();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status}`);
      setData((await r.json()) as T);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [url]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, version === 0 ? 0 : 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load, version]);

  return { data, error, refresh: load };
}

export async function post<T = unknown>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `${r.status}`);
  return j;
}

/* The phone-reachable base URL (cloudflare tunnel) is read at runtime from /api/public-url,
   so a new tunnel never needs a rebuild — just reload the page. */
let pubBase = "";
let pubFetched = false;
const pubSubs = new Set<() => void>();
function subscribePub(cb: () => void) {
  pubSubs.add(cb);
  if (!pubFetched) {
    pubFetched = true;
    fetch("/api/public-url")
      .then((r) => r.json())
      .then((j: { url?: string }) => {
        pubBase = j.url ?? "";
        pubSubs.forEach((f) => f());
      })
      .catch(() => {});
  }
  return () => void pubSubs.delete(cb);
}

/** Returns publicUrl(path): a URL a phone can open — the tunnel if one is running, else this origin. */
export function usePublicUrl() {
  const base = useSyncExternalStore(subscribePub, () => pubBase, () => "");
  return useCallback((path: string) => (base || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "") + path, [base]);
}
