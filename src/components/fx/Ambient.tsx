"use client";

import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import type { ReactNode } from "react";

/** Slow-drifting light behind a section — warm signal + a hint of volt, never loud. */
export function Aurora({ className, tone = "signal", intensity = 1 }: { className?: string; tone?: "signal" | "volt" | "mixed"; intensity?: number }) {
  const a = tone === "volt" ? "215,255,61" : "255,90,31";
  const b = tone === "signal" ? "255,140,60" : "215,255,61";
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      <div
        className="absolute -left-[10%] top-[-20%] h-[70%] w-[60%] rounded-full blur-[110px] animate-[drift_22s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, rgba(${a},${0.16 * intensity}) 0%, transparent 65%)` }}
      />
      <div
        className="absolute -right-[12%] bottom-[-25%] h-[75%] w-[55%] rounded-full blur-[120px] animate-[drift_28s_ease-in-out_infinite_reverse]"
        style={{ background: `radial-gradient(circle, rgba(${b},${0.1 * intensity}) 0%, transparent 65%)` }}
      />
    </div>
  );
}

/** Hairline grid that fades out toward the edges. */
export function GridBg({ className, size = 64, dots = false }: { className?: string; size?: number; dots?: boolean }) {
  const img = dots
    ? "radial-gradient(rgba(238,233,223,0.13) 1px, transparent 1px)"
    : "linear-gradient(rgba(238,233,223,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(238,233,223,0.05) 1px, transparent 1px)";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className ?? ""}`}
      style={{
        backgroundImage: img,
        backgroundSize: `${size}px ${size}px`,
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)",
      }}
    />
  );
}

/** Card with a light that follows the cursor and a glowing border on hover. */
export function Spotlight({ children, className, color = "255,90,31" }: { children: ReactNode; className?: string; color?: string }) {
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const bg = useMotionTemplate`radial-gradient(420px circle at ${x}px ${y}px, rgba(${color},0.13), transparent 70%)`;
  const border = useMotionTemplate`radial-gradient(260px circle at ${x}px ${y}px, rgba(${color},0.55), transparent 70%)`;
  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        x.set(-400);
        y.set(-400);
      }}
      className={`group relative overflow-hidden rounded-[24px] border border-line bg-carbon/70 ${className ?? ""}`}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[24px] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: border, padding: 1, WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: bg }} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
