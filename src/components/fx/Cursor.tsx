"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";

const FINE = "(pointer: fine)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(FINE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * Dot + ring cursor. The ring swells over anything interactive and
 * shows a label when the element has data-cursor="Label".
 */
export function Cursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 420, damping: 38, mass: 0.6 });
  const ry = useSpring(y, { stiffness: 420, damping: 38, mass: 0.6 });
  const [label, setLabel] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const enabled = useSyncExternalStore(subscribe, () => window.matchMedia(FINE).matches, () => false);

  useEffect(() => {
    if (!enabled) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = (e.target as HTMLElement).closest<HTMLElement>("a,button,[data-cursor]");
      setHover(!!t);
      setLabel(t?.dataset.cursor ?? null);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [enabled, x, y]);

  if (!enabled) return null;

  const size = label ? 96 : hover ? 56 : 28;

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[80] h-1.5 w-1.5 rounded-full bg-signal"
        style={{ x, y, translateX: "-50%", translateY: "-50%" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[80] flex items-center justify-center rounded-full border border-bone/60 mix-blend-difference"
        style={{ x: rx, y: ry, translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: size,
          height: size,
          backgroundColor: label ? "rgba(238,233,223,1)" : "rgba(238,233,223,0)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
      >
        {label && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink">{label}</span>
        )}
      </motion.div>
    </>
  );
}
