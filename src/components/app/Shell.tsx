"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/landing/Nav";
import type { AccountSummary } from "@/lib/types";
import { I } from "./icons";
import { LiveProvider, post, useApi, useLive } from "./live";
import { timeAgo } from "./ui";

type Counts = { inbox: number; atRisk: number; bugs: number; outbox: number; calls: number; policies: number };
type NavItem = { href: string; label: string; icon: keyof typeof I; external?: boolean; badge?: keyof Counts; hot?: boolean };
const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/app", label: "Command center", icon: "home" },
      { href: "/app/inbox", label: "Inbox", icon: "inbox", badge: "inbox", hot: true },
      { href: "/app/renewals", label: "Renewals", icon: "pipeline", badge: "atRisk" },
      { href: "/app/accounts", label: "Accounts", icon: "accounts" },
      { href: "/app/contracts", label: "Contracts", icon: "doc" },
      { href: "/app/brief", label: "Board brief", icon: "brief" },
    ],
  },
  {
    title: "Engage",
    items: [
      { href: "/app/calls", label: "Calls", icon: "phone", badge: "calls" },
      { href: "/app/deal/northwind-logistics", label: "Deal desk", icon: "deal" },
      { href: "/helpdeck/juniper-edu", label: "Customer app", icon: "store", external: true },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/app/radar", label: "Bug radar", icon: "bug", badge: "bugs", hot: true },
      { href: "/app/analytics", label: "Analytics", icon: "chart" },
    ],
  },
  {
    title: "Automation",
    items: [
      { href: "/app/playbooks", label: "Playbooks", icon: "bolt" },
      { href: "/app/policies", label: "Policies & audit", icon: "shield", badge: "policies", hot: true },
      { href: "/app/outbox", label: "Outbox", icon: "inbox", badge: "outbox" },
      { href: "/app/integrations", label: "Integrations", icon: "plug" },
      { href: "/app/settings", label: "Settings", icon: "gear" },
    ],
  },
];

function isActive(path: string, href: string) {
  if (href === "/app") return path === "/app";
  if (href.startsWith("/app/calls")) return path.startsWith("/app/calls") || path.startsWith("/app/call/");
  const root = href.split("/").slice(0, 3).join("/");
  return path.startsWith(root);
}

function NavLinks({ path, collapsed }: { path: string; collapsed: boolean }) {
  const { data } = useApi<{ counts: Counts }>("/api/state");
  const counts = data?.counts;
  return (
    <nav className="mt-5 space-y-5">
      {GROUPS.map((g) => (
        <div key={g.title}>
          {collapsed ? <div className="mx-auto mb-1.5 h-px w-6 bg-line" /> : <div className="px-2.5 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ash/60">{g.title}</div>}
          <div className="space-y-0.5">
            {g.items.map((n) => {
              const Icon = I[n.icon];
              const active = !n.external && isActive(path, n.href);
              const count = n.badge && counts ? counts[n.badge] : 0;
              const cls = `group relative flex items-center gap-2.5 rounded-lg py-[7px] text-[13.5px] transition-colors ${collapsed ? "justify-center px-0" : "px-2.5"} ${active ? "text-bone" : "text-ash hover:text-bone"}`;
              const inner = (
                <>
                  {active && (
                    <motion.span layoutId="nav-active" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-lg border border-line bg-gradient-to-r from-carbon to-[#181815]">
                      <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-signal shadow-[0_0_12px_rgba(255,90,31,0.8)]" />
                    </motion.span>
                  )}
                  <Icon className={`relative shrink-0 transition ${active ? "text-signal" : "opacity-70 group-hover:opacity-100"}`} />
                  {!collapsed && <span className="relative flex-1 truncate">{n.label}</span>}
                  {!collapsed && n.external && <span className="relative text-[10px] opacity-50">↗</span>}
                  {count > 0 &&
                    (collapsed ? (
                      <span className={`absolute right-2 top-1 h-1.5 w-1.5 rounded-full ${n.hot ? "bg-signal" : "bg-ash"}`} />
                    ) : (
                      <span className={`relative min-w-5 rounded-full px-1.5 text-center font-mono text-[10px] leading-[18px] tabular-nums ${n.hot ? "bg-signal/15 text-signal" : "bg-line/70 text-ash"}`}>{count}</span>
                    ))}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-line bg-carbon px-2 py-1 text-[12px] text-bone opacity-0 shadow-xl transition group-hover:opacity-100">
                      {n.label}
                      {count > 0 ? ` · ${count}` : ""}
                    </span>
                  )}
                </>
              );
              return n.external ? (
                <a key={n.href} href={n.href} target="_blank" className={cls}>
                  {inner}
                </a>
              ) : (
                <Link key={n.href} href={n.href} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ActiveNav({ collapsed }: { collapsed: boolean }) {
  return <NavLinks path={usePathname()} collapsed={collapsed} />;
}

function Status({ collapsed }: { collapsed: boolean }) {
  const { connected } = useLive();
  return (
    <span className="relative flex h-2 w-2 shrink-0" title={connected ? "Agents online" : "Reconnecting"}>
      {connected && <span className="absolute inset-0 animate-ping rounded-full bg-volt opacity-60" />}
      <span className={`relative h-2 w-2 rounded-full ${connected ? "bg-volt" : "bg-ash"}`} />
      {!collapsed && <span className="sr-only">{connected ? "Agents online" : "Reconnecting"}</span>}
    </span>
  );
}

function UserCard({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const { connected } = useLive();
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`flex w-full items-center gap-2.5 rounded-xl border border-transparent p-1.5 text-left transition hover:border-line hover:bg-carbon ${collapsed ? "justify-center" : ""}`}>
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-bone to-[#cfc8b8] text-[11px] font-semibold text-ink">
          MK
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#0d0d0c]">
            <Status collapsed />
          </span>
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium">Meera Kapoor</span>
            <span className="block truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">{connected ? "agents online" : "reconnecting"}</span>
          </span>
        )}
        {!collapsed && <span className="text-[10px] text-ash">⋯</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-xl border border-line bg-carbon p-1 shadow-2xl">
            <div className="px-3 py-2">
              <div className="text-[13px] font-medium">Meera Kapoor</div>
              <div className="text-[11.5px] text-ash">Head of Customer Success · Helpdeck</div>
            </div>
            <div className="my-1 h-px bg-line" />
            <Link href="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-bone/85 hover:bg-ink">
              <I.gear /> Settings & guardrails
            </Link>
            <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-bone/85 hover:bg-ink">
              <I.arrow className="rotate-180" /> Back to website
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                void post("/api/reset");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-bone/85 hover:bg-ink"
            >
              <I.refresh width={14} height={14} /> Reset demo world
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TITLES: [RegExp, string, string][] = [
  [/^\/app$/, "Overview", "Command center"],
  [/^\/app\/inbox/, "Overview", "Inbox"],
  [/^\/app\/renewals/, "Overview", "Renewals"],
  [/^\/app\/accounts\/.+/, "Accounts", "Account"],
  [/^\/app\/accounts/, "Overview", "Accounts"],
  [/^\/app\/contracts/, "Overview", "Contracts"],
  [/^\/app\/brief/, "Overview", "Board brief"],
  [/^\/app\/calls/, "Engage", "Calls"],
  [/^\/app\/call\//, "Engage", "Live call"],
  [/^\/app\/deal/, "Engage", "Deal desk"],
  [/^\/app\/radar/, "Intelligence", "Bug radar"],
  [/^\/app\/analytics/, "Intelligence", "Analytics"],
  [/^\/app\/playbooks/, "Automation", "Playbooks"],
  [/^\/app\/policies/, "Automation", "Policies & audit"],
  [/^\/app\/outbox/, "Automation", "Outbox"],
  [/^\/app\/integrations/, "Automation", "Integrations"],
  [/^\/app\/settings/, "Workspace", "Settings"],
];

function Crumbs() {
  const path = usePathname();
  const t = TITLES.find(([re]) => re.test(path));
  if (!t) return null;
  return (
    <div className="hidden items-center gap-2 whitespace-nowrap text-[13px] lg:flex">
      <span className="text-ash">Helpdeck</span>
      <span className="text-line">/</span>
      <span className="text-ash">{t[1]}</span>
      <span className="text-line">/</span>
      <span className="font-medium text-bone">{t[2]}</span>
    </div>
  );
}

/* ---------------- command palette (Ctrl/⌘ K) ---------------- */

function Palette({ open, onClose, onAsk }: { open: boolean; onClose: () => void; onAsk: (q: string) => void }) {
  const { data } = useApi<{ accounts: AccountSummary[] }>(open ? "/api/state" : null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
  }, [open]);
  const items = useMemo(() => {
    const pages = GROUPS.flatMap((g) => g.items).map((n) => ({ kind: "Page", label: n.label, href: n.href }));
    const accts = (data?.accounts ?? []).map((a) => ({ kind: a.health.tier === "critical" ? "Critical" : "Account", label: a.name, href: `/app/accounts/${a.id}` }));
    const all = [...pages, ...accts].filter((x) => x.label.toLowerCase().includes(q.toLowerCase()));
    return q.trim() ? [{ kind: "Ask", label: `Ask Clutch: “${q}”`, href: "" }, ...all].slice(0, 9) : all.slice(0, 9);
  }, [data, q]);
  const go = (i: number) => {
    const it = items[i];
    if (!it) return;
    onClose();
    setQ("");
    if (it.kind === "Ask") onAsk(q);
    else if (it.href.startsWith("/helpdeck")) window.open(it.href, "_blank");
    else router.push(it.href);
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] grid place-items-start bg-ink/70 pt-[14vh] backdrop-blur-sm" onClick={onClose}>
          <motion.div initial={{ y: -10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-carbon shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <I.search className="text-ash" />
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") setSel((s) => Math.min(items.length - 1, s + 1));
                  if (e.key === "ArrowUp") setSel((s) => Math.max(0, s - 1));
                  if (e.key === "Enter") go(sel);
                  if (e.key === "Escape") onClose();
                }}
                placeholder="Search accounts, pages — or ask Clutch anything…"
                className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ash"
              />
              <kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-ash">esc</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-1.5">
              {items.map((it, i) => (
                <li key={it.kind + it.label}>
                  <button onMouseEnter={() => setSel(i)} onClick={() => go(i)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13.5px] ${sel === i ? "bg-ink text-bone" : "text-bone/80"}`}>
                    <span className="flex items-center gap-2.5">
                      {it.kind === "Ask" ? <I.spark className="text-signal" /> : null}
                      {it.label}
                    </span>
                    <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${it.kind === "Critical" ? "text-signal" : "text-ash"}`}>{it.kind}</span>
                  </button>
                </li>
              ))}
              {!items.length && <li className="px-3 py-6 text-center text-sm text-ash">No matches</li>}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Ask Clutch copilot ---------------- */

type ChatMsg = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = ["Which critical accounts renew in the next 60 days?", "How much ARR is at risk and why?", "Which bug costs us the most revenue?", "Run autopilot on my book"];

function Copilot({ open, onClose, seed, clearSeed }: { open: boolean; onClose: () => void; seed: string | null; clearSeed: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const r = await post<{ reply: string }>("/api/copilot", { messages: next });
      setMsgs([...next, { role: "assistant", content: r.reply || "…" }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Something went wrong — try again." }]);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (open && seed) {
      const q = seed;
      clearSeed();
      setTimeout(() => void ask(q), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="fixed inset-y-0 right-0 z-[85] flex w-full max-w-[420px] flex-col border-l border-line bg-[#0e0e0d] shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.6)]"
        >
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-signal text-[13px] font-semibold text-ink">c.</span>
              <div>
                <div className="text-[14px] font-medium">Ask Clutch</div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ash">portfolio copilot · sarvam-105b</div>
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-ash hover:bg-carbon hover:text-bone" aria-label="Close">
              <I.close />
            </button>
          </header>
          <div ref={box} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {!msgs.length && (
              <div>
                <p className="text-[13.5px] leading-relaxed text-ash">Ask about any account, renewal or risk — or tell Clutch to act.</p>
                <div className="mt-4 space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="block w-full rounded-xl border border-line px-3.5 py-2.5 text-left text-[13px] text-bone/85 transition hover:border-ash">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-10 rounded-2xl rounded-br-md bg-bone px-3.5 py-2.5 text-[13.5px] text-ink" : "mr-4 whitespace-pre-wrap text-[13.5px] leading-relaxed text-bone/90"}>
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 font-mono text-[11px] text-ash">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" /> thinking with live data…
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(text);
            }}
            className="border-t border-line p-4"
          >
            <div className="flex items-center gap-2 rounded-xl border border-line bg-ink px-3 focus-within:border-ash">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or instruct…" className="h-11 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ash" />
              <button disabled={busy || !text.trim()} className="rounded-lg bg-signal px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink disabled:opacity-40">
                Send
              </button>
            </div>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ---------------- notifications ---------------- */

function Bell() {
  const { events } = useLive();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const important = events.filter((e) => (e.tone === "good" || e.tone === "risk" || e.tone === "action") && e.title !== "transcript");
  const unread = Math.max(0, important.length - seen);
  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setSeen(important.length);
        }}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-line text-ash transition hover:text-bone"
        aria-label="Notifications"
      >
        <I.bell />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 font-mono text-[9px] text-ink">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-line bg-carbon shadow-2xl">
            <div className="border-b border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ash">Notifications</div>
            <ul className="max-h-80 overflow-y-auto">
              {important.slice(0, 12).map((e) => (
                <li key={e.id} className="border-b border-line/60 px-4 py-2.5 last:border-0">
                  <div className="flex justify-between gap-3 text-[12.5px]">
                    <span className={e.tone === "risk" ? "text-signal" : e.tone === "good" ? "text-volt" : "text-bone"}>{e.title}</span>
                    <span className="font-mono text-[10px] text-ash">{timeAgo(e.at)}</span>
                  </div>
                  {e.accountName && <div className="text-[11.5px] text-ash">{e.accountName}</div>}
                </li>
              ))}
              {!important.length && <li className="px-4 py-6 text-center text-[12.5px] text-ash">You&apos;re all caught up.</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TopBar({ onPalette, onAsk }: { onPalette: () => void; onAsk: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-line bg-ink/75 px-5 backdrop-blur-xl md:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-5">
        <Suspense fallback={null}>
          <Crumbs />
        </Suspense>
        <button onClick={onPalette} className="group flex h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-line bg-carbon/60 px-3 text-left text-[13px] text-ash transition hover:border-ash/60 hover:text-bone">
          <I.search />
          <span className="flex-1 truncate">Search or ask anything…</span>
          <kbd className="rounded border border-line bg-ink px-1.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ash xl:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-volt" /> live
        </span>
        <Bell />
        <button onClick={onAsk} className="relative flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-lg bg-signal px-3.5 text-[13px] font-medium text-ink shadow-[0_0_24px_-6px_rgba(255,90,31,0.7)] transition hover:brightness-110">
          <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shine_3.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <I.spark className="relative" /> <span className="relative">Ask Clutch</span>
        </button>
      </div>
    </header>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState(false);
  const [ask, setAsk] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAsk((p) => !p);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <LiveProvider>
      <div className="flex min-h-screen bg-ink text-bone">
        <motion.aside
          animate={{ width: collapsed ? 68 : 236 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="sticky top-0 hidden h-screen shrink-0 flex-col justify-between border-r border-line bg-[#0d0d0c] bg-[radial-gradient(120%_40%_at_0%_0%,rgba(255,90,31,0.07),transparent_60%)] px-2.5 py-4 md:flex"
        >
          <div className="min-h-0 overflow-y-auto overflow-x-hidden">
            <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
              <Link href="/" className="text-[22px]">
                {collapsed ? <span className="font-semibold tracking-tight">c<span className="text-signal">.</span></span> : <Wordmark />}
              </Link>
              {!collapsed && (
                <button onClick={() => setCollapsed(true)} className="rounded-md p-1 text-ash hover:bg-carbon hover:text-bone" title="Collapse (Ctrl \)" aria-label="Collapse sidebar">
                  <I.sidebar />
                </button>
              )}
            </div>
            {collapsed ? (
              <button onClick={() => setCollapsed(false)} className="mx-auto mt-4 grid h-8 w-8 place-items-center rounded-lg border border-line text-ash hover:text-bone" title="Expand (Ctrl \)" aria-label="Expand sidebar">
                <I.sidebar />
              </button>
            ) : (
              <div className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-line bg-carbon/50 px-2.5 py-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-[12px] font-semibold ring-1 ring-line">H</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">Helpdeck</span>
                  <span className="block truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-ash">production · 60 accts</span>
                </span>
                <span className="h-2 w-2 rounded-full bg-volt shadow-[0_0_8px_rgba(215,255,61,0.8)]" />
              </div>
            )}
            <Suspense fallback={<NavLinks path="" collapsed={collapsed} />}>
              <ActiveNav collapsed={collapsed} />
            </Suspense>
          </div>
          <div className="border-t border-line pt-2.5">
            <UserCard collapsed={collapsed} />
          </div>
        </motion.aside>
        <div className="min-w-0 flex-1">
          <TopBar onPalette={() => setPalette(true)} onAsk={() => setAsk(true)} />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
      <Palette
        open={palette}
        onClose={() => setPalette(false)}
        onAsk={(q) => {
          setSeed(q);
          setAsk(true);
        }}
      />
      <Copilot open={ask} onClose={() => setAsk(false)} seed={seed} clearSeed={() => setSeed(null)} />
    </LiveProvider>
  );
}
