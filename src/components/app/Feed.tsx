"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FeedEvent } from "@/lib/types";
import { timeAgo } from "./ui";

const TONE: Record<FeedEvent["tone"], string> = {
  neutral: "bg-ash",
  risk: "bg-signal",
  good: "bg-volt",
  action: "bg-bone",
};

export function Feed({ events, accountFilter }: { events: FeedEvent[]; accountFilter?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const list = (accountFilter ? events.filter((e) => e.accountId === accountFilter) : events).filter((e) => e.title !== "transcript").slice(0, 40);

  return (
    <ol className="relative">
      <AnimatePresence initial={false}>
        {list.map((e) => (
          <motion.li
            key={e.id}
            layout
            initial={{ opacity: 0, y: -12, backgroundColor: "rgba(215,255,61,0.06)" }}
            animate={{ opacity: 1, y: 0, backgroundColor: "rgba(215,255,61,0)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-[10px_1fr_auto] gap-x-3 border-b border-line px-5 py-3 last:border-0"
          >
            <span className={`mt-[7px] h-1.5 w-1.5 rounded-full ${TONE[e.tone]}`} />
            <div className="min-w-0">
              {e.accountName && !accountFilter && (
                <Link href={`/app/accounts/${e.accountId}`} className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash hover:text-bone">
                  {e.accountName}
                </Link>
              )}
              <div className="text-[13.5px] leading-snug">{e.title}</div>
              {e.detail && <div className="mt-0.5 truncate text-[12px] text-ash" title={e.detail}>{e.detail}</div>}
            </div>
            <span className="font-mono text-[10px] tabular-nums text-ash">{timeAgo(e.at)}</span>
          </motion.li>
        ))}
      </AnimatePresence>
      {!list.length && <li className="px-5 py-8 text-sm text-ash">Nothing yet.</li>}
    </ol>
  );
}
