"use client";

import { motion } from "motion/react";
import { useSyncExternalStore, type ReactNode } from "react";
import type { Health } from "@/lib/types";

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[10.5px] uppercase tracking-[0.16em] ${className ?? "text-ash"}`}>{children}</span>;
}

export function Panel({ title, right, children, className, pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded-[20px] border border-line bg-carbon ${className ?? ""}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <Mono>{title}</Mono>
          {right}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

const TIER = {
  critical: { label: "Critical", dot: "bg-signal", text: "text-signal", shape: "rotate-45 rounded-[1px]" },
  watch: { label: "Watch", dot: "bg-bone", text: "text-bone", shape: "rounded-full" },
  healthy: { label: "Healthy", dot: "bg-volt", text: "text-volt", shape: "rounded-full" },
} as const;

export function TierBadge({ tier, className }: { tier: Health["tier"]; className?: string }) {
  const t = TIER[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] ${t.text} ${className ?? ""}`}>
      <span className={`h-1.5 w-1.5 ${t.dot} ${t.shape}`} />
      {t.label}
    </span>
  );
}

export function tierColor(tier: Health["tier"]) {
  return tier === "critical" ? "#ff5a1f" : tier === "watch" ? "#eee9df" : "#d7ff3d";
}

export function RiskBar({ value, tier }: { value: number; tier: Health["tier"] }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-7 text-right font-mono text-[13px] tabular-nums">{value}</span>
      <div className="h-1 w-20 rounded-full bg-line">
        <motion.div className="h-full rounded-full" style={{ background: tierColor(tier) }} initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    </div>
  );
}

export function Dial({ value, tier, size = 220 }: { value: number; tier: Health["tier"]; size?: number }) {
  const r = 80;
  const c = Math.PI * r;
  return (
    <svg viewBox="0 0 200 116" width={size} role="img" aria-label={`Risk ${value} of 100`}>
      <path d="M20 106 A80 80 0 0 1 180 106" fill="none" stroke="#2a2925" strokeWidth="12" strokeLinecap="round" />
      <motion.path
        d="M20 106 A80 80 0 0 1 180 106"
        fill="none"
        stroke={tierColor(tier)}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - value / 100) }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <text x="100" y="98" textAnchor="middle" fill="#eee9df" fontSize="46" fontWeight="500" letterSpacing="-3">
        {value}
      </text>
    </svg>
  );
}

export function Btn({
  children,
  onClick,
  tone = "ghost",
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "ghost" | "volt";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const t =
    tone === "primary"
      ? "bg-signal text-ink hover:bg-[#ff7140]"
      : tone === "volt"
        ? "bg-volt text-ink hover:brightness-110"
        : "border border-line text-bone hover:border-ash";
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-40 ${t} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function timeAgo(at: number) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

const subscribeClock = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
/** Current time, ticking once a second (render-safe). */
export function useNow() {
  return useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 1000) * 1000, () => 0);
}

/** Compact product-style page header: eyebrow, title, subtitle, actions. */
export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ash">{eyebrow}</div>}
        <h1 className="truncate text-[26px] font-medium leading-tight tracking-[-0.035em]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13px] text-ash">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone, children }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "risk" | "good"; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-line bg-carbon p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">{label}</div>
      <div>
        <div className={`truncate text-[26px] font-medium leading-none tracking-[-0.04em] tabular-nums ${tone === "risk" ? "text-signal" : tone === "good" ? "text-volt" : ""}`}>{value}</div>
        {sub && <div className="mt-1.5 truncate text-[12px] text-ash">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export const page = "mx-auto w-full max-w-[1500px] px-5 py-6 md:px-7";
