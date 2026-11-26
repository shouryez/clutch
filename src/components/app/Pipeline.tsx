"use client";

import { motion } from "motion/react";
import { inrCompact } from "@/lib/format";
import type { AccountSummary } from "@/lib/types";
import { STAGES, stageOf, type Stage } from "./plays";

/** The renewal pipeline: every account renewing in 120 days sits in exactly one stage. */
export function Pipeline({ accounts, active, onSelect }: { accounts: AccountSummary[]; active?: Stage | null; onSelect?: (s: Stage | null) => void }) {
  const moving = accounts.some((a) => {
    const s = stageOf(a);
    return s === "working" || s === "waiting";
  });
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-0">
      {STAGES.map((st, i) => {
        const xs = accounts.filter((a) => stageOf(a) === st.key && (st.key !== "renewed" || (a.renewedDue ?? 0) <= 120));
        const arr = xs.reduce((t, a) => t + a.arr, 0);
        const on = active === st.key;
        return (
          <div key={st.key} className="relative flex md:pr-6">
            <button
              onClick={() => onSelect?.(on ? null : st.key)}
              className={`group flex w-full flex-col rounded-2xl border p-4 text-left transition ${on ? "border-bone/60 bg-ink" : "border-line bg-carbon hover:border-ash/60"} ${onSelect ? "" : "cursor-default"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[12.5px] font-medium">
                  <span className={`h-2 w-2 rounded-full ${st.dot} ${st.key === "working" && xs.length ? "animate-pulse" : ""}`} />
                  {st.title}
                </span>
                <span className="font-mono text-[10px] text-ash">{i + 1}</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <motion.span key={xs.length} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-[30px] font-medium leading-none tracking-[-0.04em] tabular-nums">
                  {xs.length}
                </motion.span>
                <span className="font-mono text-[12px] tabular-nums text-ash">{inrCompact(arr)}</span>
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-ash">{st.hint}</p>
            </button>
            {i < STAGES.length - 1 && (
              <div className="pointer-events-none absolute right-0 top-1/2 hidden h-px w-6 -translate-y-1/2 overflow-hidden bg-line md:block">
                {moving && (
                  <motion.span className="absolute top-0 h-px w-2 bg-signal" initial={{ x: -8 }} animate={{ x: 24 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear", delay: i * 0.2 }} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
