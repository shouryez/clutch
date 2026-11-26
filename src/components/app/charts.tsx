"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { inr, inrCompact } from "@/lib/format";
import type { AccountSummary } from "@/lib/types";
import { tierColor } from "./ui";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------------- Renewal runway: next 120 days ---------------- */

const LANES = ["critical", "watch", "healthy"] as const;

export function Runway({ accounts }: { accounts: AccountSummary[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const router = useRouter();
  const [hover, setHover] = useState<{ a: AccountSummary; x: number; y: number } | null>(null);
  const H = 250;
  const padL = 86;
  const padR = 20;
  const top = 18;
  const laneH = (H - top - 34) / 3;
  const X = (d: number) => padL + (Math.max(0, Math.min(120, d)) / 120) * (w - padL - padR);
  const maxArr = Math.max(...accounts.map((a) => a.arr), 1);
  const R = (arr: number) => 4 + Math.sqrt(arr / maxArr) * 11;

  const inWindow = accounts
    .filter((a) => a.health.daysToRenewal >= 0 && a.health.daysToRenewal <= 120)
    .sort((x, y) => x.health.daysToRenewal - y.health.daysToRenewal);

  // simple beeswarm offsets within a lane
  const placed: Record<string, { x: number; y: number; r: number }[]> = { critical: [], watch: [], healthy: [] };
  const pos = new Map<string, { x: number; y: number; r: number }>();
  for (const a of inWindow) {
    const lane = LANES.indexOf(a.health.tier);
    const cx = X(a.health.daysToRenewal);
    const r = R(a.arr);
    const mid = top + lane * laneH + laneH / 2;
    let cy = mid;
    for (let k = 0; k < 8; k++) {
      const off = k === 0 ? 0 : Math.ceil(k / 2) * 9 * (k % 2 ? -1 : 1);
      cy = mid + off;
      if (!placed[a.health.tier].some((p) => Math.hypot(p.x - cx, p.y - cy) < p.r + r + 2)) break;
    }
    const p = { x: cx, y: cy, r };
    placed[a.health.tier].push(p);
    pos.set(a.id, p);
  }

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={H} className="block" role="img" aria-label="Renewals in the next 120 days by risk tier">
        {LANES.map((l, i) => (
          <g key={l}>
            <line x1={padL} x2={w - padR} y1={top + (i + 1) * laneH} y2={top + (i + 1) * laneH} stroke="#2a2925" />
            <text x={0} y={top + i * laneH + laneH / 2 + 4} fill="#8c877d" fontSize="10.5" fontFamily="var(--font-geist-mono)" letterSpacing="1.5">
              {l.toUpperCase()}
            </text>
          </g>
        ))}
        {[0, 15, 30, 45, 60, 75, 90, 105, 120].map((d) => (
          <g key={d}>
            <line x1={X(d)} x2={X(d)} y1={top} y2={H - 30} stroke="#2a2925" strokeDasharray={d === 0 ? undefined : "2 4"} />
            <text x={X(d)} y={H - 12} fill="#8c877d" fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)">
              {d === 0 ? "TODAY" : `+${d}d`}
            </text>
          </g>
        ))}
        {/* notice tails: when the cancellation window closes */}
        {inWindow.map((a) => {
          const p = pos.get(a.id)!;
          if (a.health.tier === "healthy" || a.health.daysToNotice > a.health.daysToRenewal) return null;
          return <line key={a.id + "t"} x1={X(a.health.daysToNotice)} x2={p.x} y1={p.y} y2={p.y} stroke={tierColor(a.health.tier)} strokeOpacity={0.35} strokeWidth={2} />;
        })}
        {inWindow.map((a) => {
          const p = pos.get(a.id)!;
          const done = a.renewed;
          return (
            <g key={a.id}>
              {a.health.tier !== "healthy" && a.health.daysToNotice >= 0 && (
                <line x1={X(a.health.daysToNotice)} x2={X(a.health.daysToNotice)} y1={p.y - 5} y2={p.y + 5} stroke={tierColor(a.health.tier)} strokeWidth={2} />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={done ? "transparent" : tierColor(a.health.tier)}
                fillOpacity={a.health.tier === "watch" ? 0.75 : 0.9}
                stroke={done ? "#d7ff3d" : "#141412"}
                strokeWidth={2}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={Math.max(p.r + 6, 12)}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHover({ a, x: p.x, y: p.y })}
                onMouseLeave={() => setHover(null)}
                onClick={() => router.push(`/app/accounts/${a.id}`)}
              />
            </g>
          );
        })}
        {/* direct labels for the two biggest critical accounts */}
        {inWindow
          .filter((a) => a.health.tier === "critical")
          .sort((x, y) => y.arr - x.arr)
          .slice(0, 3)
          .map((a) => {
            const p = pos.get(a.id)!;
            return (
              <text key={a.id + "l"} x={p.x + p.r + 6} y={p.y + 4} fill="#eee9df" fontSize="11.5">
                {a.name}
              </text>
            );
          })}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-ink/95 p-3 text-[12px] shadow-2xl backdrop-blur"
          style={{ left: hover.x, top: hover.y - 14 }}
        >
          <div className="text-[13.5px] font-medium">{hover.a.name}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-y-1 font-mono text-[11px] text-ash">
            <span>ARR</span>
            <span className="text-right text-bone">{inr(hover.a.arr)}</span>
            <span>Risk</span>
            <span className="text-right text-bone">{hover.a.health.risk}</span>
            <span>Renews in</span>
            <span className="text-right text-bone">{hover.a.health.daysToRenewal}d</span>
            <span>Notice closes</span>
            <span className={`text-right ${hover.a.health.daysToNotice < 15 ? "text-signal" : "text-bone"}`}>
              {hover.a.health.daysToNotice < 0 ? "closed" : `${hover.a.health.daysToNotice}d`}
            </span>
          </div>
          {hover.a.renewed && <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-volt">renewed</div>}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ash">
        <span>dot size = ARR</span>
        <span>tick = notice window closes</span>
        <span>{inWindow.length} renewals · {inrCompact(inWindow.reduce((t, a) => t + a.arr, 0))}</span>
      </div>
    </div>
  );
}

/* ---------------- Usage: weekday active users per week vs seats ---------------- */

export function UsageChart({ weeks, seats, alarm = true }: { weeks: { week: string; active: number }[]; seats: number; alarm?: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const H = 200;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 24;
  const max = Math.max(seats, ...weeks.map((x) => x.active)) * 1.08;
  const X = (i: number) => padL + (i / Math.max(1, weeks.length - 1)) * (w - padL - padR);
  const Y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const line = weeks.map((p, i) => `${i ? "L" : "M"}${X(i)},${Y(p.active)}`).join("");
  const area = `${line}L${X(weeks.length - 1)},${Y(0)}L${X(0)},${Y(0)}Z`;
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={H}
        className="block"
        role="img"
        aria-label="Weekday active users per week"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left - padL) / (w - padL - padR)) * (weeks.length - 1));
          setHi(Math.max(0, Math.min(weeks.length - 1, i)));
        }}
        onMouseLeave={() => setHi(null)}
      >
        <defs>
          <linearGradient id="ua" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#eee9df" stopOpacity="0.16" />
            <stop offset="1" stopColor="#eee9df" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={w - padR} y1={Y(max * f)} y2={Y(max * f)} stroke="#2a2925" />
            <text x={padL - 8} y={Y(max * f) + 3} fill="#8c877d" fontSize="10" textAnchor="end" fontFamily="var(--font-geist-mono)">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={w - padR} y1={Y(seats)} y2={Y(seats)} stroke="#8c877d" strokeDasharray="4 4" />
        <text x={w - padR} y={Y(seats) - 6} fill="#8c877d" fontSize="10" textAnchor="end" fontFamily="var(--font-geist-mono)">
          {seats} SEATS LICENSED
        </text>
        <path d={area} fill="url(#ua)" />
        <path d={line} fill="none" stroke="#eee9df" strokeWidth={2} strokeLinejoin="round" />
        {/* last 6 weeks emphasised */}
        <path
          d={weeks
            .slice(-7)
            .map((p, i) => `${i ? "L" : "M"}${X(weeks.length - 7 + i)},${Y(p.active)}`)
            .join("")}
          fill="none"
          stroke={alarm ? "#ff5a1f" : "#d7ff3d"}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {[0, Math.floor(weeks.length / 2), weeks.length - 1].map((i) => (
          <text key={i} x={X(i)} y={H - 6} fill="#8c877d" fontSize="10" textAnchor={i === 0 ? "start" : i === weeks.length - 1 ? "end" : "middle"} fontFamily="var(--font-geist-mono)">
            {fmt(weeks[i].week)}
          </text>
        ))}
        {hi !== null && (
          <g>
            <line x1={X(hi)} x2={X(hi)} y1={padT} y2={H - padB} stroke="#8c877d" />
            <circle cx={X(hi)} cy={Y(weeks[hi].active)} r={4.5} fill={hi >= weeks.length - 7 ? (alarm ? "#ff5a1f" : "#d7ff3d") : "#eee9df"} stroke="#141412" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hi !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-ink/95 px-3 py-2 font-mono text-[11px]"
          style={{ left: Math.min(X(hi) + 10, w - 150) }}
        >
          <div className="text-ash">week of {fmt(weeks[hi].week)}</div>
          <div className="text-bone">{weeks[hi].active} active / {seats} seats</div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Renewal status: one colour per state ---------------- */

export type Status = "renewed" | "play" | "risk" | "ok";
export const STATUS: Record<Status, { label: string; short: string; color: string; hint: string }> = {
  risk: { label: "At risk · no play yet", short: "At risk", color: "#ff5a1f", hint: "needs a go" },
  play: { label: "Clutch working", short: "In play", color: "#eee9df", hint: "play running or waiting on customer" },
  ok: { label: "Healthy · not started", short: "Healthy", color: "#6e6a61", hint: "autopilot can renew" },
  renewed: { label: "Renewed", short: "Renewed", color: "#d7ff3d", hint: "signed and billed" },
};
const ORDER: Status[] = ["renewed", "ok", "play", "risk"]; // bottom → top

export function statusOf(a: AccountSummary): Status {
  if (a.renewed) return "renewed";
  if (a.activeRun && (a.activeRun.status === "running" || a.activeRun.status === "waiting")) return "play";
  return a.health.tier === "healthy" ? "ok" : "risk";
}
const dueIn = (a: AccountSummary) => (a.renewed ? (a.renewedDue ?? 0) : a.health.daysToRenewal);

export function inRenewalWindow(accounts: AccountSummary[]) {
  return accounts.filter((a) => (a.renewed && (a.renewedDue ?? 0) <= 120) || (!a.renewed && a.health.daysToRenewal >= 0 && a.health.daysToRenewal <= 120));
}

/** Where the money renewing in 120 days stands — one 100% bar. */
export function ArrSplit({ accounts }: { accounts: AccountSummary[] }) {
  const list = inRenewalWindow(accounts);
  const total = list.reduce((t, a) => t + a.arr, 0) || 1;
  const parts = (["renewed", "play", "risk", "ok"] as Status[]).map((s) => {
    const xs = list.filter((a) => statusOf(a) === s);
    return { s, arr: xs.reduce((t, a) => t + a.arr, 0), n: xs.length };
  });
  return (
    <div>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="ARR renewing in 120 days by status">
        {parts.map((p) =>
          p.arr ? (
            <motion.div
              key={p.s}
              initial={{ width: 0 }}
              animate={{ width: `${(p.arr / total) * 100}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{ background: STATUS[p.s].color }}
              title={`${STATUS[p.s].label}: ${inrCompact(p.arr)} · ${p.n} accounts`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {parts.map((p) => (
          <div key={p.s} className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11.5px] text-ash">
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: STATUS[p.s].color }} />
              <span className="truncate">{STATUS[p.s].short}</span>
            </div>
            <div className="mt-0.5 font-mono text-[17px] tabular-nums">{inrCompact(p.arr)}</div>
            <div className="text-[11px] text-ash">
              {p.n} account{p.n === 1 ? "" : "s"} · {Math.round((p.arr / total) * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** ARR renewing each week for the next 18 weeks, stacked by status (one block per account). */
export function RenewalBars({ accounts }: { accounts: AccountSummary[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const router = useRouter();
  const [hi, setHi] = useState<number | null>(null);
  const H = 230;
  const padL = 44;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const N = 18;
  const list = inRenewalWindow(accounts);
  const weeks = Array.from({ length: N }, (_, i) => {
    const xs = list.filter((a) => Math.min(N - 1, Math.floor(dueIn(a) / 7)) === i).sort((x, y) => ORDER.indexOf(statusOf(x)) - ORDER.indexOf(statusOf(y)) || y.arr - x.arr);
    return { i, xs, total: xs.reduce((t, a) => t + a.arr, 0) };
  });
  const rawMax = Math.max(...weeks.map((x) => x.total), 1);
  const step = rawMax > 1.5e7 ? 5e6 : rawMax > 6e6 ? 2.5e6 : 1e6;
  const max = Math.ceil(rawMax / step) * step;
  const band = (w - padL - padR) / N;
  const bw = Math.min(34, band * 0.64);
  const X = (i: number) => padL + i * band + (band - bw) / 2;
  const Y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const label = (i: number) => {
    if (i === 0) return "this wk";
    const d = new Date(startOfDay() + i * 7 * 86_400_000);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, k) => k * step);
  const h = hi !== null ? weeks[hi] : null;

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHi(null)}>
      <svg width={w} height={H} className="block" role="img" aria-label="ARR renewing per week, next 4 months">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} stroke="#2a2925" strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={padL - 8} y={Y(t) + 3} fill="#8c877d" fontSize="10" textAnchor="end" fontFamily="var(--font-geist-mono)">
              {t === 0 ? "0" : inrCompact(t).replace("₹", "")}
            </text>
          </g>
        ))}
        {weeks.map((wk) => {
          let y = Y(0);
          return (
            <g key={wk.i} opacity={hi === null || hi === wk.i ? 1 : 0.45} style={{ transition: "opacity .2s" }}>
              {wk.xs.map((a, k) => {
                const hgt = Math.max(2, Y(0) - Y(a.arr) - 2);
                y -= hgt + 2;
                const top = k === wk.xs.length - 1;
                return (
                  <motion.rect
                    key={a.id}
                    x={X(wk.i)}
                    width={bw}
                    initial={{ y: Y(0), height: 0 }}
                    animate={{ y, height: hgt }}
                    transition={{ duration: 0.7, delay: wk.i * 0.025, ease: [0.16, 1, 0.3, 1] }}
                    rx={top ? 4 : 1.5}
                    fill={STATUS[statusOf(a)].color}
                  />
                );
              })}
              <rect
                x={padL + wk.i * band}
                y={padT}
                width={band}
                height={H - padT - padB}
                fill="transparent"
                onMouseEnter={() => setHi(wk.i)}
                onClick={() => wk.xs.length && router.push(`/app/accounts/${wk.xs[wk.xs.length - 1].id}`)}
                className="cursor-pointer"
              />
            </g>
          );
        })}
        {weeks.map((wk) =>
          wk.i % 3 === 0 ? (
            <text key={wk.i} x={X(wk.i) + bw / 2} y={H - 8} fill={wk.i === 0 ? "#eee9df" : "#8c877d"} fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)">
              {label(wk.i)}
            </text>
          ) : null,
        )}
      </svg>
      {h && h.xs.length > 0 && (
        <div className="pointer-events-none absolute top-0 z-10 w-64 rounded-xl border border-line bg-ink/95 p-3 shadow-2xl backdrop-blur" style={{ left: Math.max(0, Math.min(X(h.i) + bw + 10, w - 264)) }}>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ash">{h.i === 0 ? "This week" : `Week of ${label(h.i)}`}</span>
            <span className="font-mono text-[12px] tabular-nums">{inrCompact(h.total)}</span>
          </div>
          <ul className="mt-2 space-y-1">
            {[...h.xs]
              .reverse()
              .slice(0, 6)
              .map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: STATUS[statusOf(a)].color }} />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="font-mono text-[11px] tabular-nums text-ash">{inrCompact(a.arr)}</span>
                </li>
              ))}
            {h.xs.length > 6 && <li className="text-[11px] text-ash">+{h.xs.length - 6} more</li>}
          </ul>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {(["risk", "play", "ok", "renewed"] as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[11.5px] text-ash">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: STATUS[s].color }} />
            {STATUS[s].label}
          </span>
        ))}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-ash">one block = one account</span>
      </div>
    </div>
  );
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
