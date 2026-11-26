"use client";

import { motion, useInView, useMotionValue, animate, useTransform } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

const ease = [0.16, 1, 0.3, 1] as const;

/** Each child line slides up from behind a mask. */
export function Lines({
  lines,
  className,
  lineClassName,
  delay = 0,
  stagger = 0.09,
  once = true,
}: {
  lines: ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "0px 0px -12% 0px" });
  return (
    <div ref={ref} className={className}>
      {lines.map((l, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
          <motion.span
            className={`block ${lineClassName ?? ""}`}
            initial={{ y: "108%", rotate: 2 }}
            animate={inView ? { y: "0%", rotate: 0 } : { y: "108%", rotate: 2 }}
            transition={{ duration: 1.1, ease, delay: delay + i * stagger }}
          >
            {l}
          </motion.span>
        </span>
      ))}
    </div>
  );
}

/** Generic fade-rise. */
export function Rise({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Rolls a number up when it scrolls into view. */
export function Counter({
  to,
  from = 0,
  duration = 2,
  format = (n: number) => Math.round(n).toString(),
  className,
}: {
  to: number;
  from?: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(from);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration, ease });
    return () => c.stop();
  }, [inView, mv, to, duration]);
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

export function Label({ n, children, className }: { n: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] ${className ?? "text-ash"}`}>
      <span className="text-signal">§{n}</span>
      <span className="h-px w-8 bg-current opacity-40" />
      <span>{children}</span>
    </div>
  );
}
